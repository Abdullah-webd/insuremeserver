// /routes/chat.js
import express from "express";
import { loadContext } from "../utils/contextLoader.js";
import { getUserState, setUserState } from "../utils/userStateStore.js";
import { callAI, callAIMessage } from "../utils/aiClient.js";
import { runVerifications } from "../utils/verification/index.js";
import { runFunctionByName } from "../utils/functionRunner.js";
import { evaluateWorkflowReady } from "../utils/workflowUtils.js";
import { writeAudit } from "../utils/auditLogger.js";
import { ensureImagesStored } from "../utils/imageStore.js";
import { handleRefusal } from "../utils/refusalHandler.js";
import { isMongoConnected } from "../utils/db.js";
import Submission from "../models/Submission.js";
import { hasActivePolicy } from "../utils/policyCheck.js";

const router = express.Router();

function buildPayload({ userId, message, userState, context, submissions }) {
  const paidPolicies = Array.isArray(submissions)
    ? submissions.filter((s) => s.status === "paid" || s.paymentStatus === "success")
    : [];

  return {
    user_id: userId,
    message,
    current_workflow: userState?.workflow || null,
    user_submissions: submissions || [],
    active_policies: paidPolicies,
    policies: context.policies,
    workflows: context.workflows
  };
}

function mockAIResponse({ userId, message }) {
  return {
    reply: `AI received: ${message}`,
    workflow: {
      user_id: userId,
      workflow_id: "registration",
      current_step: 0,
      collected_fields: { full_name: null, email: null, phone: null },
      status: "in_progress"
    },
    function_to_call: null
  };
}

function isClaimIntent(message) {
  if (!message) return false;
  return /(claim|file\s+claim|make\s+a\s+claim|submit\s+a\s+claim|insurance\s+claim)/i.test(
    message
  );
}

async function submissionExists({ userId, workflowId }) {
  if (!isMongoConnected()) return false;
  if (!userId || !workflowId) return false;
  const existing = await Submission.findOne({ userId, workflowId })
    .select("_id")
    .lean();
  return Boolean(existing);
}

router.post("/", async (req, res) => {
  const { userId, message } = req.body || {};
  if (!userId || !message) {
    return res.status(400).json({ error: "userId and message are required" });
  }

  try {
    const userState = await getUserState(userId);

    if (isClaimIntent(message)) {
      const active = await hasActivePolicy(userId);
      if (!active) {
        let reply =
          "I can’t file a claim yet because there’s no active policy on your account. If you want, I can help you start a policy first.";

        if (process.env.MOCK_AI !== "true") {
          try {
            const systemPrompt =
              "You are InsureMe support. Reply in 1-2 sentences, natural and empathetic. " +
              "Explain that there is no active policy on the account, so a claim cannot be filed yet, " +
              "and offer to help start a policy. Do not mention internal checks, databases, or policies.";
            const aiReply = await callAIMessage({
              systemPrompt,
              userMessage: message
            });
            if (aiReply && aiReply.trim()) reply = aiReply.trim();
          } catch {
            // Fallback to default reply
          }
        }

        return res.json({
          reply,
          workflow: userState?.workflow || null,
          function_to_call: null
        });
      }
    }

    const context = loadContext();
    if (userState?.workflow) {
      const refusal = handleRefusal({
        message,
        workflow: userState.workflow,
        userId
      });
      if (refusal) {
        await setUserState(userId, { workflow: refusal.workflow });
        writeAudit({
          at: new Date().toISOString(),
          userId,
          message,
          aiResponse: refusal
        });
        return res.json(refusal);
      }
    }

    let submissions = [];
    if (isMongoConnected()) {
      submissions = await Submission.find({ userId })
        .sort({ createdAt: -1 })
        .lean();
    }

    const payload = buildPayload({
      userId,
      message,
      userState,
      context,
      submissions
    });

    const aiResponse =
      process.env.MOCK_AI === "true"
        ? mockAIResponse({ userId, message })
        : await callAI(payload);

    let workflow = aiResponse.workflow || null;
    workflow = await ensureImagesStored(workflow);
    workflow = await runVerifications(workflow);
    workflow = evaluateWorkflowReady(workflow);

    // Restrict claim policy types to only active policies
    const activeTypes = Array.isArray(submissions)
      ? submissions
          .filter((s) => s.status === "paid" || s.paymentStatus === "success")
          .map((s) => {
            if (s.type?.includes("car")) return "car";
            if (s.type?.includes("house")) return "house";
            if (s.type?.includes("health")) return "health";
            if (s.type?.includes("life")) return "life";
            return null;
          })
          .filter(Boolean)
      : [];
    const uniqueActive = [...new Set(activeTypes)];

    if (
      workflow?.workflow_id === "file_claim" &&
      workflow.collected_fields?.policy_type == null &&
      workflow.current_step === 0
    ) {
      if (uniqueActive.length === 1) {
        workflow.collected_fields.policy_type = uniqueActive[0];
        workflow.current_step = 1;
        const nextStep = workflow.steps?.[1];
        if (nextStep?.prompt) {
          aiResponse.reply = `You can only file a claim for your active ${uniqueActive[0]} policy. ${nextStep.prompt}`;
        }
      } else if (uniqueActive.length > 1) {
        aiResponse.reply =
          "You can only file a claim for active policies. Which one do you want to claim: " +
          uniqueActive.join(", ") +
          "?";
      }
    }

    let submittedByBackend = false;
    const hasPaidSubmission = Array.isArray(submissions)
      ? submissions.some(
          (s) =>
            (s.status === "paid" || s.paymentStatus === "success") &&
            s.workflowId === workflow?.workflow_id
        )
      : false;

    if (workflow?.submit?.ready && workflow.submit.function && !hasPaidSubmission) {
      const payloadField = workflow.submit.payload_field || "data";
      const fnPayload = {
        user_id: userId,
        workflow_id: workflow.workflow_id,
        verification: workflow.verification || {},
        [payloadField]: workflow.collected_fields
      };
      const fnResult = await runFunctionByName(
        workflow.submit.function,
        fnPayload
      );
      aiResponse.function_to_call = {
        name: workflow.submit.function,
        result: fnResult
      };
      workflow.status = "submitted";
      submittedByBackend = true;
    }

    if (
      workflow &&
      !submittedByBackend &&
      workflow.status === "submitted" &&
      !hasPaidSubmission
    ) {
      const wfDef =
        workflow.submit?.function
          ? workflow
          : context.workflows?.find(
              (w) => w?.data?.workflow_id === workflow.workflow_id
            )?.data;

      if (wfDef?.submit?.function) {
        const exists = await submissionExists({
          userId,
          workflowId: workflow.workflow_id
        });
        if (!exists) {
          const payloadField = wfDef.submit.payload_field || "data";
          const fnPayload = {
            user_id: userId,
            workflow_id: workflow.workflow_id,
            verification: workflow.verification || {},
            [payloadField]: workflow.collected_fields
          };
          const fnResult = await runFunctionByName(
            wfDef.submit.function,
            fnPayload
          );
          aiResponse.function_to_call = {
            name: wfDef.submit.function,
            result: fnResult
          };
        }
      }
    }

    if (workflow) {
      await setUserState(userId, { workflow });
      aiResponse.workflow = workflow;
    }

    writeAudit({
      at: new Date().toISOString(),
      userId,
      message,
      aiResponse
    });

    res.json(aiResponse);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;
