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
import User from "../models/User.js";
import { hasActivePolicy, getActivePolicyTypes } from "../utils/policyCheck.js";

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

    // Quick-submit heuristic: if user explicitly asks to submit and we have an in-progress workflow with a submit function, submit now.
    try {
      const submitKeywords = /\b(submit|submit my claim|submit claim|submit application|please submit|proceed to submit|yes submit|submit now)\b/i;
      if (userState?.workflow && submitKeywords.test(String(message || ""))) {
        const wf = userState.workflow;
        if (wf && wf.submit && wf.submit.function) {
          const payloadField = wf.submit.payload_field || "data";
          const fnPayload = {
            user_id: userId,
            workflow_id: wf.workflow_id,
            verification: wf.verification || {},
            [payloadField]: wf.collected_fields || {}
          };
          const fnResult = await runFunctionByName(wf.submit.function, fnPayload);
          // mark workflow submitted and persist
          wf.status = "submitted";
          await setUserState(userId, { workflow: wf });

          const reply = fnResult && fnResult.id
            ? `Your ${wf.workflow_id || 'request'} has been submitted (id: ${fnResult.id}). Admins will review and contact you.`
            : `Your ${wf.workflow_id || 'request'} has been submitted. Admins will review and contact you.`;

          writeAudit({ at: new Date().toISOString(), userId, message, aiResponse: { reply, function_to_call: { name: wf.submit.function, result: fnResult } } });

          return res.json({ reply, workflow: wf, function_to_call: { name: wf.submit.function, result: fnResult } });
        }
      }
    } catch (e) {
      console.error('Submit heuristic failed:', e?.message || e);
    }

    if (isClaimIntent(message)) {
      const activeTypes = await getActivePolicyTypes(userId);
      if (!activeTypes || activeTypes.length === 0) {
        let reply =
          "I can’t file a claim yet because there’s no active policy on your account. If you want, I can help you start a policy first.";

        if (process.env.MOCK_AI !== "true") {
          try {
            const systemPrompt =
              "You are InsureMe support. Reply in 1-2 sentences, natural and empathetic. " +
              "Explain that there is no active policy on the account, so a claim cannot be filed yet, " +
              "and offer to help start a policy. Do not mention internal checks, databases, or policies.";
            const aiReply = await callAIMessage({ systemPrompt, userMessage: message });
            if (aiReply && aiReply.trim()) reply = aiReply.trim();
          } catch {
            // Fallback to default reply
          }
        }

        return res.json({ reply, workflow: userState?.workflow || null, function_to_call: null });
      }

      // If user only has one active policy, prompt to proceed specifically for that type
      if (activeTypes.length === 1) {
        const only = activeTypes[0];
        return res.json({
          reply: `You have an active ${only} policy. I can help you file a claim for that policy — shall I proceed to collect the claim details?`,
          workflow: userState?.workflow || null,
          function_to_call: null
        });
      }

      // Multiple active policies: ask which one
      return res.json({
        reply: `You have active policies for: ${activeTypes.join(", ")}. Which policy would you like to file a claim for? (car, house, health, or life)`,
        workflow: userState?.workflow || null,
        function_to_call: null
      });
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

    // Heuristic: if user message includes an email and mentions updating/changing contact, create an admin request immediately.
    try {
      const emailMatch = String(message || "").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      const triggerKeywords = /(update|change|new|replace).*(email|contact)|email.*(update|change|new)|tell.*admin|notify.*admin|contacting me/i;
      if (emailMatch && triggerKeywords.test(message || "")) {
        const latest = submissions && submissions.length ? submissions[0] : null;
        const submissionId = latest?._id?.toString() || null;
        const userRec = isMongoConnected() ? await User.findOne({ userId }).lean() : null;

        const params = {
          user_id: userId,
          user_name: userRec?.profile?.full_name || latest?.data?.full_name || null,
          user_phone: userRec?.profile?.phone || latest?.data?.phone || null,
          title: "Update contact email",
          message: String(message || ""),
          type: "contact_update",
          data: { submissionId, newEmail: emailMatch[0] }
        };

        const fnResult = await runFunctionByName("request_admin_action", params);
        writeAudit({ at: new Date().toISOString(), userId, message, aiResponse: { reply: `Created admin request ${fnResult.request?._id || fnResult.request}`, function_to_call: { name: "request_admin_action", parameters: params, result: fnResult } } });

        return res.json({
          reply: `Request created (id: ${fnResult.request?._id || "unknown"}). Admins will review and contact you.`,
          workflow: userState?.workflow || null,
          function_to_call: { name: "request_admin_action", parameters: params, result: fnResult }
        });
      }
    } catch (e) {
      // don't block the main flow on heuristic errors
      console.error("Request heuristic failed:", e?.message || e);
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

    // If the model suggested a backend function to call (function_to_call), execute it here.
    if (aiResponse.function_to_call && aiResponse.function_to_call.name && !aiResponse.function_to_call.result) {
      try {
        const fnName = aiResponse.function_to_call.name;
        const params = aiResponse.function_to_call.parameters || aiResponse.function_to_call.params || {};
        const fnResult = await runFunctionByName(fnName, params);
        aiResponse.function_to_call = { name: fnName, parameters: params, result: fnResult };
      } catch (err) {
        aiResponse.function_to_call = {
          ...aiResponse.function_to_call,
          error: err?.message || String(err)
        };
      }
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

// Chat history endpoint (reads audit log)
router.get("/history/:userId", async (req, res) => {
  const { userId } = req.params;
  const fs = await import("fs");
  const path = await import("path");
  const ROOT = process.cwd();
  const auditPath = path.join(ROOT, "data", "audit.jsonl");

  try {
    if (!fs.existsSync(auditPath)) return res.json({ messages: [] });
    const raw = fs.readFileSync(auditPath, "utf8");
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const messages = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.userId !== userId) continue;
        const at = entry.at || entry.timestamp || new Date().toISOString();
        if (entry.message !== undefined) {
          messages.push({ who: "user", text: String(entry.message), time: at });
        }
        if (entry.aiResponse && entry.aiResponse.reply) {
          messages.push({ who: "bot", text: String(entry.aiResponse.reply), time: at });
        }
        if (entry.aiResponse && entry.aiResponse.function_to_call && entry.aiResponse.function_to_call.name) {
          const fn = entry.aiResponse.function_to_call;
          // create a user-friendly summary for known functions to avoid exposing raw JSON
          function summarizeFunction(fn) {
            const name = fn.name || "function";
            const res = fn.result || {};
            if (name.startsWith("submit_") && res.id) {
              const amount = res.premium_estimate?.amount;
              const currency = res.premium_estimate?.currency || "";
              const period = res.premium_estimate?.period ? `/${res.premium_estimate.period}` : "";
              const parts = [`Submitted ${name.replace("submit_", "").replace(/_/g, " ")}`];
              parts.push(`id: ${res.id}`);
              if (amount) parts.push(`Estimated premium: ${amount} ${currency}${period}`);
              return parts.join(" — ");
            }
            if (name === "request_admin_action" && res.request) {
              const rid = res.request._id || (typeof res.request === "string" ? res.request : null);
              return rid ? `Request created (id: ${rid}). Admins will review and contact you.` : `Request created. Admins will review and contact you.`;
            }
            // generic safe summary
            if (res?.ok) return `${name} completed successfully.`;
            if (res?.error) return `${name} failed: ${res.error}`;
            return `${name} ran.`;
          }

          const summary = summarizeFunction(fn);
          messages.push({ who: "bot", text: summary, time: at });
        }
      } catch (e) {
        // ignore parse errors per-line
        continue;
      }
    }

    // sort by time
    messages.sort((a, b) => new Date(a.time) - new Date(b.time));
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

