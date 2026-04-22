// /routes/chat.js
import express from "express";
import { loadContext } from "../utils/contextLoader.js";
import {
  getUserState,
  setUserState,
  clearUserState,
} from "../utils/userStateStore.js";
import { callAI, callAIMessage } from "../utils/aiClient.js";
import { runVerifications } from "../utils/verification/index.js";
import { runFunctionByName } from "../utils/functionRunner.js";
import { evaluateWorkflowReady } from "../utils/workflowUtils.js";
import { writeAudit } from "../utils/auditLogger.js";
import { ensureImagesStored } from "../utils/imageStore.js";

import { isMongoConnected } from "../utils/db.js";
import Submission from "../models/Submission.js";
import User from "../models/User.js";
import { hasActivePolicy } from "../utils/policyCheck.js";

const router = express.Router();

// Load recent audit messages for a user to provide chat history context to the LLM
async function loadUserAudit(userId, maxMessages = 100) {
  try {
    // Prefer loading chat history from MongoDB Audit collection when connected
    const { isMongoConnected } = await import("../utils/db.js");
    if (isMongoConnected()) {
      try {
        const { default: Audit } = await import("../models/Audit.js");
        const docs = await Audit.find({ userId }).sort({ at: 1 }).lean();
        const messages = [];
        for (const entry of docs) {
          const at = entry.at || entry.createdAt || new Date().toISOString();
          if (entry.message !== undefined)
            messages.push({
              who: "user",
              text: String(entry.message),
              time: at,
            });
          if (entry.aiResponse && entry.aiResponse.reply)
            messages.push({
              who: "bot",
              text: String(entry.aiResponse.reply),
              time: at,
            });
        }
        return messages.slice(-maxMessages);
      } catch (err) {
        console.error(
          "Failed to load audit from MongoDB:",
          err?.message || err,
        );
        // fallback to file
      }
    }

    const fs = await import("fs");
    const path = await import("path");
    const ROOT = process.cwd();
    const auditPath = path.join(ROOT, "data", "audit.jsonl");
    if (!fs.existsSync(auditPath)) return [];
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
          messages.push({
            who: "bot",
            text: String(entry.aiResponse.reply),
            time: at,
          });
        }
      } catch (e) {
        continue;
      }
    }
    // return last N messages (chronological)
    messages.sort((a, b) => new Date(a.time) - new Date(b.time));
    return messages.slice(-maxMessages);
  } catch (err) {
    console.error("loadUserAudit error:", err?.message || err);
    return [];
  }
}

function buildPayload({ userId, message, userState, context, submissions }) {
  const paidPolicies = Array.isArray(submissions)
    ? submissions.filter(
        (s) => s.status === "paid" || s.paymentStatus === "success",
      )
    : [];

  return {
    user_id: userId,
    message,
    current_workflow: userState?.workflow || null,
    user_submissions: submissions || [],
    active_policies: paidPolicies,
    policies: context.policies,
    workflows: context.workflows,
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
      status: "in_progress",
    },
    function_to_call: null,
  };
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

    // No server-side quick-submit heuristics: let the LLM decide using full chat_history.



    // Let the LLM determine claim intent and next steps using chat_history and context.

    const context = loadContext();
    // No pre-AI refusal/request heuristics here; we pass full context and history to the LLM.

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
      submissions,
    });

    // Attach recent user-specific chat history so the model can make informed, contextual decisions
    try {
      const recent = await loadUserAudit(userId, 80);
      if (recent && recent.length) payload.chat_history = recent;
    } catch (err) {
      // continue without history if loading fails
      console.error("Failed to attach chat_history:", err?.message || err);
    }

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
            s.workflowId === workflow?.workflow_id,
        )
      : false;

    if (
      workflow?.submit?.ready &&
      workflow.submit.function &&
      !hasPaidSubmission
    ) {
      // Respect workflow-level guardrail: require explicit user confirmation by default.
      const requireConfirmation =
        workflow.submit.require_user_confirmation !== false;
      if (requireConfirmation) {
        // Ask user to confirm submission instead of auto-submitting.
        workflow.submit.confirmation_requested = true;
        aiResponse.reply = aiResponse.reply
          ? `${aiResponse.reply}\n\nYour application looks ready to submit. Reply 'yes submit' to confirm.`
          : "Your application looks ready to submit. Reply 'yes submit' to confirm.";
      } else {
        // workflow explicitly allows auto submit
        const payloadField = workflow.submit.payload_field || "data";
        const fnPayload = {
          user_id: userId,
          workflow_id: workflow.workflow_id,
          verification: workflow.verification || {},
          [payloadField]: workflow.collected_fields,
        };
        const fnResult = await runFunctionByName(
          workflow.submit.function,
          fnPayload,
        );
        aiResponse.function_to_call = {
          name: workflow.submit.function,
          result: fnResult,
        };
        workflow.status = "submitted";
        submittedByBackend = true;
      }
    }

    if (
      workflow &&
      !submittedByBackend &&
      workflow.status === "submitted" &&
      !hasPaidSubmission &&
      !workflow.submit?.confirmation_requested
    ) {
      const wfDef = workflow.submit?.function
        ? workflow
        : context.workflows?.find(
            (w) => w?.data?.workflow_id === workflow.workflow_id,
          )?.data;

      if (wfDef?.submit?.function) {
        const exists = await submissionExists({
          userId,
          workflowId: workflow.workflow_id,
        });
        if (!exists) {
          const payloadField = wfDef.submit.payload_field || "data";
          const fnPayload = {
            user_id: userId,
            workflow_id: workflow.workflow_id,
            verification: workflow.verification || {},
            [payloadField]: workflow.collected_fields,
          };
          const fnResult = await runFunctionByName(
            wfDef.submit.function,
            fnPayload,
          );
          aiResponse.function_to_call = {
            name: wfDef.submit.function,
            result: fnResult,
          };
          submittedByBackend = true;
        }
      }
    }

    if (workflow) {
      await setUserState(userId, { workflow });
      aiResponse.workflow = workflow;
    }

    // If the model suggested a backend function to call (function_to_call), execute it here.
    // BUT only if we haven't already submitted something via the workflow blocks above.
    if (
      aiResponse.function_to_call &&
      aiResponse.function_to_call.name &&
      !aiResponse.function_to_call.result &&
      !submittedByBackend
    ) {
      try {
        const fnName = aiResponse.function_to_call.name;
        const params =
          aiResponse.function_to_call.parameters ||
          aiResponse.function_to_call.params ||
          {};
        const fnResult = await runFunctionByName(fnName, params);
        aiResponse.function_to_call = {
          name: fnName,
          parameters: params,
          result: fnResult,
        };
        submittedByBackend = true;
      } catch (err) {
        aiResponse.function_to_call = {
          ...aiResponse.function_to_call,
          error: err?.message || String(err),
        };
      }
    }

    writeAudit({
      at: new Date().toISOString(),
      userId,
      message,
      aiResponse,
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
          messages.push({
            who: "bot",
            text: String(entry.aiResponse.reply),
            time: at,
          });
        }
        if (
          entry.aiResponse &&
          entry.aiResponse.function_to_call &&
          entry.aiResponse.function_to_call.name
        ) {
          const fn = entry.aiResponse.function_to_call;
          // create a user-friendly summary for known functions to avoid exposing raw JSON
          function summarizeFunction(fn) {
            const name = fn.name || "function";
            const res = fn.result || {};
            if (name.startsWith("submit_") && res.id) {
              const amount = res.premium_estimate?.amount;
              const currency = res.premium_estimate?.currency || "";
              const period = res.premium_estimate?.period
                ? `/${res.premium_estimate.period}`
                : "";
              const parts = [
                `Submitted ${name.replace("submit_", "").replace(/_/g, " ")}`,
              ];
              parts.push(`id: ${res.id}`);
              if (amount)
                parts.push(`Estimated premium: ${amount} ${currency}${period}`);
              return parts.join(" — ");
            }
            if (name === "request_admin_action" && res.request) {
              const rid =
                res.request._id ||
                (typeof res.request === "string" ? res.request : null);
              return rid
                ? `Request created (id: ${rid}). Admins will review and contact you.`
                : `Request created. Admins will review and contact you.`;
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
