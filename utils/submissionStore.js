import { isMongoConnected } from "./db.js";
import Submission from "../models/Submission.js";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const SUBMISSIONS_PATH = path.join(DATA_DIR, "submissions.jsonl");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export async function appendSubmission(entry) {
  if (isMongoConnected()) {
    await Submission.create({
      type: entry.type,
      userId: entry.user_id || entry.userId,
      data: entry.data,
      workflowId: entry.workflow_id || null,
      status: entry.status || "submitted",
      riskScoreFinal: entry.risk_score || entry.riskScoreFinal || null,
      premiumFinal: entry.premium_estimate || entry.premiumFinal || null,
      adminNotes: entry.admin_notes || entry.adminNotes || null,
      paymentStatus: entry.payment_status || "pending",
      paymentReference: entry.payment_reference || null,
      paymentAuthUrl: entry.payment_auth_url || null,
      paymentAccessCode: entry.payment_access_code || null,
      paymentVerifiedAt: entry.payment_verified_at
        ? new Date(entry.payment_verified_at)
        : null,
      submittedAt: entry.submitted_at ? new Date(entry.submitted_at) : new Date()
    });
  }

  ensureDataDir();
  fs.appendFileSync(SUBMISSIONS_PATH, JSON.stringify(entry) + "\n", "utf8");
}
