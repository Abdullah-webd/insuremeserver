import express from "express";
import { writeAudit } from "../utils/auditLogger.js";
import { translateToEnglish, translateFromEnglish } from "../utils/translator.js";
import { isMongoConnected } from "../utils/db.js";
import Submission from "../models/Submission.js";
import { createGraph } from "../src/agent/graph.js";
import { HumanMessage } from "@langchain/core/messages";

const router = express.Router();
let compiledGraph = null;

async function getGraph() {
    if (!compiledGraph) {
        compiledGraph = await createGraph();
    }
    return compiledGraph;
}

router.post("/", async (req, res) => {
  const { userId, message, language = "English" } = req.body || {};
  if (!userId || !message) {
    return res.status(400).json({ error: "userId and message are required" });
  }

  try {
    // 1. Pre-process translation
    let processedMessage = message;
    if (language && language !== "English") {
      processedMessage = await translateToEnglish(message, language);
      console.log(`Translated [${language}] "${message}" to English: "${processedMessage}"`);
    }

    // 2. Fetch context
    let submissions = [];
    if (isMongoConnected()) {
      submissions = await Submission.find({ userId }).sort({ createdAt: -1 }).lean();
    }
    const paidPolicies = submissions.filter(s => s.status === "paid" || s.paymentStatus === "success");

    // 3. Prepare Graph Invocation
    const graph = await getGraph();
    const config = { configurable: { thread_id: userId } };
    
    // We send the new user message to the graph
    const result = await graph.invoke({
        messages: [new HumanMessage(processedMessage)],
        userId,
        language,
        active_policies: paidPolicies.map(p => p.type),
        user_submissions: submissions.map((s) => ({
            status: s.status,
            paymentStatus: s.paymentStatus,
            type: s.type,
            workflowId: s.workflowId,
            policyType: s?.data?.policy_type || null,
            rejectionReason: s.rejectionReason || "",
            rejectedAt: s.rejectedAt || null,
        }))
    }, config);

    // 4. Extract results
    const lastMessage = result.messages[result.messages.length - 1];
    let replyText = lastMessage?.content || "I'm sorry, I couldn't process that.";
    const workflowId = result.workflow_id === "__CLEAR__" ? null : result.workflow_id;
    const collectedFields = result.collected_fields === "__CLEAR__" ? {} : (result.collected_fields || {});
    
    // Convert to old aiResponse format for frontend compatibility
    const aiResponse = {
        reply: replyText,
        english_reply: replyText,
        workflow: workflowId ? {
            workflow_id: workflowId,
            collected_fields: collectedFields,
            status: "in_progress"
        } : null,
        function_to_call: result.ai_function_call === "__CLEAR__" ? null : result.ai_function_call
    };

    // 5. Post-process translation
    if (language && language !== "English" && aiResponse.reply) {
      aiResponse.reply = await translateFromEnglish(aiResponse.english_reply, language);
    }

    // 6. Audit
    writeAudit({
      at: new Date().toISOString(),
      userId,
      message,
      english_message: processedMessage,
      aiResponse,
    });

    // 7. Send Response
    if (req.body.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const charsPerChunk = 3;
      for (let i = 0; i < aiResponse.reply.length; i += charsPerChunk) {
        const chunk = aiResponse.reply.slice(i, i + charsPerChunk);
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        await new Promise(r => setTimeout(r, 20));
      }

      res.write(`data: ${JSON.stringify({ 
        done: true, 
        workflow: aiResponse.workflow, 
        function_to_call: aiResponse.function_to_call 
      })}\n\n`);
      return res.end();
    }

    res.json(aiResponse);
  } catch (err) {
    console.error("Chat error:", err);
    if (req.body.stream) {
      res.write(`data: ${JSON.stringify({ error: err.message || String(err) })}\n\n`);
      return res.end();
    }
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
            if (res?.ok) return `${name} completed successfully.`;
            if (res?.error) return `${name} failed: ${res.error}`;
            return `${name} ran.`;
          }

          const summary = summarizeFunction(fn);
          messages.push({ who: "bot", text: summary, time: at });
        }
      } catch (e) {
        continue;
      }
    }

    messages.sort((a, b) => new Date(a.time) - new Date(b.time));
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});
