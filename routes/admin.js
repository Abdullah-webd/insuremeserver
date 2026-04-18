import express from "express";
import mongoose from "mongoose";
import Submission from "../models/Submission.js";
import User from "../models/User.js";
import { isMongoConnected } from "../utils/db.js";
import { initializeTransaction, verifyTransaction } from "../utils/paystack.js";
import { sendEmail } from "../utils/emailer.js";
import { buildApprovalEmail } from "../utils/emailTemplates.js";
import { uploadImagesInData } from "../utils/imageStore.js";
import { clearUserState } from "../utils/userStateStore.js";
import Request from "../models/Request.js";

const router = express.Router();

async function fetchSubmissionByIdOrUserId(id, lean = false) {
  if (!id) return null;
  if (mongoose.Types.ObjectId.isValid(String(id))) {
    return lean ? Submission.findById(id).lean() : Submission.findById(id);
  }
  return lean ? Submission.findOne({ userId: id }).lean() : Submission.findOne({ userId: id });
}

function validateIdentityField({ field, value }) {
  const v = String(value ?? "").trim();

  if (field === "bvn") {
    const ok = /^\d{11}$/.test(v);
    return { ok, reason: ok ? "BVN format looks valid (11 digits)." : "BVN must be exactly 11 digits." };
  }

  if (field === "nin") {
    const ok = /^\d{11}$/.test(v);
    return { ok, reason: ok ? "NIN format looks valid (11 digits)." : "NIN must be exactly 11 digits." };
  }

  if (field === "plate_number") {
    // MVP format check only (real integrations later).
    const ok = /^[A-Za-z0-9-]{5,12}$/.test(v) && /[A-Za-z]/.test(v) && /\d/.test(v);
    return {
      ok,
      reason: ok
        ? "Plate number format looks valid (basic pattern check)."
        : "Plate number must be 5-12 chars and contain letters and numbers."
    };
  }

  return { ok: false, reason: "Unsupported field for verification." };
}

router.post("/media/upload", async (req, res) => {
  const { dataUrl, url, folder } = req.body || {};
  const input = dataUrl || url;
  if (!input || typeof input !== "string") {
    return res.status(400).json({ error: "dataUrl or url is required" });
  }

  try {
    const uploadFolder = folder || "insureme/admin_uploads";
    const uploaded = await uploadImagesInData({
      data: { evidence: [input] },
      folder: uploadFolder
    });
    const secureUrl = uploaded?.evidence?.[0] || null;
    if (!secureUrl) return res.status(500).json({ error: "Upload failed" });
    res.json({ url: secureUrl });
  } catch (err) {
    const message = err?.message || String(err);
    // If Cloudinary rejected the upload (usually 400), surface it as a 400 to the client.
    if (/Cloudinary error:\s*400\b/i.test(message)) {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

router.post("/submissions/:id/verify-field", async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ error: "MongoDB not connected" });
  }

  const submission = await fetchSubmissionByIdOrUserId(req.params.id);
  if (!submission) return res.status(404).json({ error: "Submission not found" });

  if (submission.status === "approved" || submission.status === "paid") {
    return res.status(400).json({ error: "Cannot verify fields after approval/payment" });
  }

  const { field, value } = req.body || {};
  if (!field || typeof field !== "string") {
    return res.status(400).json({ error: "field is required" });
  }

  const actual = value !== undefined ? value : submission.data?.[field];
  if (actual === undefined || actual === null || actual === "") {
    return res.status(400).json({ error: `No value found for field ${field}` });
  }

  const result = validateIdentityField({ field, value: actual });

  const notes = submission.adminNotes || {};
  const manual = notes.manual_verifications || {};
  manual[field] = {
    status: result.ok ? "verified" : "failed",
    provider: "format_only",
    checkedAt: new Date().toISOString(),
    reason: result.reason
  };
  submission.adminNotes = { ...notes, manual_verifications: manual };

  await submission.save();
  res.json({ ok: true, result, submission });
});

router.get("/submissions", async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ error: "MongoDB not connected" });
  }

  const { userId, type, limit = 20, skip = 0 } = req.query;
  const query = {};
  if (userId) query.userId = userId;
  if (type) query.type = type;

  const items = await Submission.find(query)
    .sort({ createdAt: -1 })
    .skip(Number(skip))
    .limit(Number(limit))
    .lean();

  res.json({ items });
});

router.get("/submissions/:id", async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ error: "MongoDB not connected" });
  }

  const submission = await fetchSubmissionByIdOrUserId(req.params.id, true);
  if (!submission) return res.status(404).json({ error: "Submission not found" });

  res.json({ submission });
});

router.get("/users/:userId", async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ error: "MongoDB not connected" });
  }

  const user = await User.findOne({ userId: req.params.userId }).lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

router.get("/users", async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ error: "MongoDB not connected" });
  }

  const { limit = 50, skip = 0 } = req.query;
  const items = await User.find({})
    .sort({ createdAt: -1 })
    .skip(Number(skip))
    .limit(Number(limit))
    .lean();

  res.json({ items });
});

// Requests endpoints for admin
router.get("/requests", async (req, res) => {
  if (!isMongoConnected()) return res.status(503).json({ error: "MongoDB not connected" });
  const { limit = 50, skip = 0 } = req.query;
  const items = await Request.find({})
    .sort({ createdAt: -1 })
    .skip(Number(skip))
    .limit(Number(limit))
    .lean();
  res.json({ items });
});

router.get("/requests/:id", async (req, res) => {
  if (!isMongoConnected()) return res.status(503).json({ error: "MongoDB not connected" });
  const request = await Request.findById(req.params.id).lean();
  if (!request) return res.status(404).json({ error: "Request not found" });
  res.json({ request });
});

router.post("/requests/:id/send-email", async (req, res) => {
  if (!isMongoConnected()) return res.status(503).json({ error: "MongoDB not connected" });
  const request = await Request.findById(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });

  const { subject, html, text } = req.body || {};
  // Prefer user profile email if available
  const user = await User.findOne({ userId: request.userId }).lean();
  const to = user?.profile?.email || req.body?.to || null;
  if (!to) return res.status(400).json({ error: "No recipient email available" });

  await sendEmail({ to, subject: subject || `Response to your request: ${request.title}`, html, text });
  res.json({ ok: true });
});

router.patch("/users/:userId/profile", async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ error: "MongoDB not connected" });
  }

  const user = await User.findOne({ userId: req.params.userId });
  if (!user) return res.status(404).json({ error: "User not found" });

  const incoming = req.body?.user?.workflow?.collected_fields || req.body?.collected_fields || {};
  const currentWorkflow = user.workflow || {};
  const currentFields = currentWorkflow.collected_fields || {};
  const currentProfile = user.profile || {};
  const targetSubmissionId = req.body?.submissionId || null;

  const submission = targetSubmissionId
    ? await Submission.findOne({ _id: targetSubmissionId, userId: user.userId })
    : await Submission.findOne({ userId: user.userId }).sort({ createdAt: -1 });

  if (targetSubmissionId && !submission) {
    return res.status(404).json({ error: "Submission not found for this user" });
  }

  const isInReviewSubmission =
    submission && !["approved", "paid"].includes(submission.status);

  const allowedKeys = new Set([
    ...Object.keys(currentFields),
    ...Object.keys(submission?.data || {}),
    ...Object.keys(currentProfile)
  ]);

  const updates = {};
  for (const [k, v] of Object.entries(incoming)) {
    // While a submission is still under review, allow the admin to add missing fields (e.g. email).
    if (isInReviewSubmission || allowedKeys.has(k)) updates[k] = v;
  }

  const meta = req.body?.submission_updates || {};
  const hasMetaUpdates = Object.keys(meta).length > 0;
  const replacements = req.body?.url_replacements || {};
  const replaceList = Array.isArray(replacements.items) ? replacements.items : [];

  if (
    Object.keys(updates).length === 0 &&
    !hasMetaUpdates &&
    replaceList.length === 0
  ) {
    return res.status(400).json({
      error: "No allowed collected_fields or submission updates provided"
    });
  }

  if (Object.keys(updates).length > 0) {
    user.workflow = {
      ...currentWorkflow,
      collected_fields: {
        ...currentFields,
        ...updates
      }
    };

    user.profile = {
      ...currentProfile,
      ...Object.fromEntries(
        Object.entries(updates).filter(([key]) => key in currentProfile)
      )
    };
  }

  if (submission) {
    submission.data = { ...(submission.data || {}), ...updates };

    // Optional meta updates
    const allowedStatuses = new Set(["submitted", "approved", "rejected", "paid"]);
    if (meta.riskScoreFinal !== undefined) submission.riskScoreFinal = meta.riskScoreFinal;
    if (meta.premiumFinal !== undefined) submission.premiumFinal = meta.premiumFinal;
    if (meta.adminNotes !== undefined) submission.adminNotes = meta.adminNotes;
    if (meta.status !== undefined && allowedStatuses.has(meta.status)) {
      submission.status = meta.status;
    }

    // Optional URL replacement for evidence/images
    const requireCloudinary = req.body?.require_cloudinary === true;

    if (replaceList.length > 0) {
      const replaceInValue = (val) => {
        if (typeof val === "string") {
          const hit = replaceList.find((r) => r.from === val);
          return hit ? hit.to : val;
        }
        if (Array.isArray(val)) {
          return val.map((v) => {
            const hit = replaceList.find((r) => r.from === v);
            return hit ? hit.to : v;
          });
        }
        return val;
      };

      const urlFields = ["evidence", "car_image", "property_images"];
      for (const key of urlFields) {
        if (submission.data && key in submission.data) {
          submission.data[key] = replaceInValue(submission.data[key]);
        }
        if (user.workflow?.collected_fields && key in user.workflow.collected_fields) {
          user.workflow.collected_fields[key] = replaceInValue(
            user.workflow.collected_fields[key]
          );
        }
      }
    }

    if (requireCloudinary) {
      const isCloudinary = (url) =>
        typeof url === "string" && url.includes("res.cloudinary.com/");
      const urlFields = ["evidence", "car_image", "property_images"];

      for (const key of urlFields) {
        if (submission.data && key in submission.data) {
          const val = submission.data[key];
          if (typeof val === "string" && !isCloudinary(val)) {
            return res.status(400).json({
              error: `Non-Cloudinary URL not allowed for ${key}`
            });
          }
          if (Array.isArray(val) && val.some((u) => !isCloudinary(u))) {
            return res.status(400).json({
              error: `Non-Cloudinary URL not allowed for ${key}`
            });
          }
        }
        if (user.workflow?.collected_fields && key in user.workflow.collected_fields) {
          const val = user.workflow.collected_fields[key];
          if (typeof val === "string" && !isCloudinary(val)) {
            return res.status(400).json({
              error: `Non-Cloudinary URL not allowed for ${key}`
            });
          }
          if (Array.isArray(val) && val.some((u) => !isCloudinary(u))) {
            return res.status(400).json({
              error: `Non-Cloudinary URL not allowed for ${key}`
            });
          }
        }
      }
    }

    await submission.save();
  }

  await user.save();

  res.json({ user, submission });
});



router.post("/submissions/:id/approve", async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ error: "MongoDB not connected" });
  }

  const submission = await fetchSubmissionByIdOrUserId(req.params.id);
  if (!submission) return res.status(404).json({ error: "Submission not found" });

  const user = await User.findOne({ userId: submission.userId }).lean();
  const email =
    req.body.email || user?.profile?.email || submission.data?.email || null;
  if (!email) return res.status(400).json({ error: "User email is required" });

  const premium = req.body.premiumFinal || submission.premiumFinal;
  const amount = premium?.amount || 0;
  const amountKobo = Math.round(Number(amount) * 100);
  if (!amountKobo || amountKobo <= 0) {
    return res.status(400).json({ error: "Premium amount is invalid" });
  }

  const reference = `insureme_${submission.userId}_${Date.now()}`;
  const paystackInit = await initializeTransaction({
    email,
    amount: String(amountKobo),
    reference,
    metadata: { submissionId: submission._id.toString(), userId: submission.userId }
  });

  const authUrl = paystackInit?.data?.authorization_url;
  const accessCode = paystackInit?.data?.access_code;

  submission.status = "approved";
  submission.paymentStatus = "pending";
  submission.paymentReference = reference;
  submission.paymentAuthUrl = authUrl;
  submission.paymentAccessCode = accessCode;
  await submission.save();

  const emailContent = buildApprovalEmail({
    userName: user?.profile?.full_name || submission.data?.full_name,
    premium: premium,
    currency: premium?.currency || "NGN",
    payUrl: authUrl
  });
  await sendEmail({ to: email, ...emailContent });

  res.json({
    ok: true,
    authorization_url: authUrl,
    reference
  });
});

router.post("/submissions/:id/reject", async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ error: "MongoDB not connected" });
  }

  const submission = await Submission.findById(req.params.id);
  if (!submission) return res.status(404).json({ error: "Submission not found" });

  submission.status = "rejected";
  await submission.save();

  res.json({ ok: true, submission });
});

router.post("/submissions/:id/verify-payment", async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ error: "MongoDB not connected" });
  }

  const submission = await fetchSubmissionByIdOrUserId(req.params.id);
  if (!submission) return res.status(404).json({ error: "Submission not found" });

  if (!submission.paymentReference) {
    return res.status(400).json({ error: "No payment reference on submission" });
  }

  const verify = await verifyTransaction(submission.paymentReference);
  const data = verify?.data || {};

  if (data.status === "success") {
    submission.paymentStatus = "success";
    submission.paymentVerifiedAt = new Date();
    submission.status = "paid";
    await submission.save();
  }

  res.json({ ok: true, verify, submission });
});

router.post("/email", async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ error: "MongoDB not connected" });
  }

  const { userId, to, subject, html, text } = req.body || {};
  let recipient = to;

  if (!recipient && userId) {
    const user = await User.findOne({ userId }).lean();
    recipient = user?.profile?.email || null;
  }

  if (!recipient) return res.status(400).json({ error: "Recipient email is required" });
  if (!subject) return res.status(400).json({ error: "Subject is required" });

  await sendEmail({ to: recipient, subject, html, text });
  res.json({ ok: true });
});

router.post("/users/:userId/clear-workflow", async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ error: "MongoDB not connected" });
  }

  const user = await User.findOne({ userId: req.params.userId });
  if (!user) return res.status(404).json({ error: "User not found" });

  user.workflow = null;
  await user.save();
  await clearUserState(req.params.userId);

  res.json({ ok: true });
});

export default router;
