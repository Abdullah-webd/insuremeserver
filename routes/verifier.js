import express from "express";
import Submission from "../models/Submission.js";
import User from "../models/User.js";
import { isMongoConnected } from "../utils/db.js";
import mongoose from "mongoose";

const router = express.Router();

function parseObjectIdOrNull(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (!str) return null;
  const lowered = str.toLowerCase();
  if (lowered === "undefined" || lowered === "null") return null;
  if (!mongoose.Types.ObjectId.isValid(str)) return null;
  return new mongoose.Types.ObjectId(str);
}

async function resolveVerifierObjectId(value) {
  const asObjectId = parseObjectIdOrNull(value);
  if (asObjectId) return asObjectId;

  const str = String(value ?? "").trim();
  if (!str) return null;
  const lowered = str.toLowerCase();
  if (lowered === "undefined" || lowered === "null") return null;

  // Fallback: accept app-level `userId` (string) and map to Mongo `_id`.
  const verifier = await User.findOne({ userId: str, role: "verifier" })
    .select("_id")
    .lean();
  return verifier?._id ? new mongoose.Types.ObjectId(verifier._id) : null;
}

// Get submissions assigned to the logged-in verifier
router.get("/my-tasks", async (req, res) => {
  if (!isMongoConnected()) return res.status(503).json({ error: "DB not connected" });
  
  // In a real app, verifierId would come from req.user (from JWT)
  // For now, we take it from query or assume one for testing if needed
  const verifierId = await resolveVerifierObjectId(req.query.verifierId);
  if (!verifierId) {
    return res.status(400).json({
      error: "verifierId is required and must be a valid ObjectId (or a verifier userId)",
    });
  }

  try {
    const tasks = await Submission.find({ verifierId })
      .sort({ createdAt: -1 })
      .lean();

    // Enrich claim tasks with user profile + related application for the same policy type (latest non-claim).
    const enriched = await Promise.all(
      tasks.map(async (task) => {
        const isClaim =
          String(task?.type || "").toLowerCase().includes("claim") ||
          String(task?.workflowId || "").toLowerCase().includes("claim");
        if (!isClaim) return task;

        const user = task.userId
          ? await User.findOne({ userId: task.userId })
              .select("name userId email profile")
              .lean()
          : null;

        const policyType = task?.data?.policy_type || null;
        let relatedApplication = null;
        if (task.userId && policyType) {
          relatedApplication = await Submission.findOne({
            userId: task.userId,
            status: { $ne: "rejected" },
            $and: [
              { type: { $not: /claim/i } },
              { type: new RegExp(String(policyType), "i") },
            ],
          })
            .sort({ createdAt: -1 })
            .lean();
        }

        return {
          ...task,
          claimant: user
            ? {
                name:
                  user?.profile?.full_name ||
                  user?.name ||
                  relatedApplication?.data?.full_name ||
                  task.userId,
                email: user?.profile?.email || user?.email || task?.data?.email || null,
                phone:
                  user?.profile?.phone ||
                  relatedApplication?.data?.phone ||
                  task?.data?.phone ||
                  null,
                userId: user?.userId || task.userId,
              }
            : null,
          relatedApplication: relatedApplication
            ? {
                _id: relatedApplication._id,
                type: relatedApplication.type,
                status: relatedApplication.status,
                data: relatedApplication.data,
                premiumFinal: relatedApplication.premiumFinal || null,
                riskScoreFinal: relatedApplication.riskScoreFinal || null,
                createdAt: relatedApplication.createdAt,
              }
            : null,
        };
      }),
    );

    res.json({ items: enriched });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to load tasks" });
  }
});

// Update verification status
router.post("/submissions/:id/verify", async (req, res) => {
  if (!isMongoConnected()) return res.status(503).json({ error: "DB not connected" });
  
  const { status, notes } = req.body;
  const submission = await Submission.findById(req.params.id);
  if (!submission) return res.status(404).json({ error: "Submission not found" });

  submission.verificationStatus = status;
  submission.verifierNotes = notes || "";
  await submission.save();

  res.json({ ok: true, submission });
});

// Get a single task (enriched for claims)
router.get("/submissions/:id", async (req, res) => {
  if (!isMongoConnected())
    return res.status(503).json({ error: "DB not connected" });

  const verifierId = await resolveVerifierObjectId(req.query.verifierId);
  if (!verifierId) {
    return res.status(400).json({
      error:
        "verifierId is required and must be a valid ObjectId (or a verifier userId)",
    });
  }

  const submission = await Submission.findById(req.params.id).lean();
  if (!submission) return res.status(404).json({ error: "Submission not found" });

  if (String(submission.verifierId || "") !== String(verifierId)) {
    return res.status(403).json({ error: "Not allowed" });
  }

  const isClaim =
    String(submission?.type || "").toLowerCase().includes("claim") ||
    String(submission?.workflowId || "").toLowerCase().includes("claim");

  if (!isClaim) return res.json({ submission });

  const user = submission.userId
    ? await User.findOne({ userId: submission.userId })
        .select("name userId email profile")
        .lean()
    : null;

  const policyType = submission?.data?.policy_type || null;
  let relatedApplication = null;
  if (submission.userId && policyType) {
    relatedApplication = await Submission.findOne({
      userId: submission.userId,
      status: { $ne: "rejected" },
      $and: [{ type: { $not: /claim/i } }, { type: new RegExp(String(policyType), "i") }],
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  res.json({
    submission,
    claimant: user
      ? {
          name:
            user?.profile?.full_name ||
            user?.name ||
            relatedApplication?.data?.full_name ||
            submission.userId,
          email:
            user?.profile?.email || user?.email || submission?.data?.email || null,
          phone:
            user?.profile?.phone ||
            relatedApplication?.data?.phone ||
            submission?.data?.phone ||
            null,
          userId: user?.userId || submission.userId,
        }
      : null,
    relatedApplication: relatedApplication
      ? {
          _id: relatedApplication._id,
          type: relatedApplication.type,
          status: relatedApplication.status,
          data: relatedApplication.data,
          createdAt: relatedApplication.createdAt,
        }
      : null,
  });
});

export default router;
