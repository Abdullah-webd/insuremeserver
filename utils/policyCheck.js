import fs from "fs";
import path from "path";
import Submission from "../models/Submission.js";
import { isMongoConnected } from "./db.js";

const POLICY_TYPES = [
  "car_insurance_application",
  "house_insurance_application",
  "health_insurance_application",
  "life_insurance_application",
];

function isActiveRecord(rec) {
  const status = rec?.status || rec?.status?.toLowerCase?.();
  const paymentStatus = rec?.paymentStatus || rec?.payment_status;
  return status === "paid" || paymentStatus === "success";
}

function findActiveInJsonl(userId) {
  const filePath = path.join(process.cwd(), "data", "submissions.jsonl");
  if (!fs.existsSync(filePath)) return false;

  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const rec = JSON.parse(lines[i]);
      const recUser = rec.userId || rec.user_id;
      if (recUser !== userId) continue;
      if (!POLICY_TYPES.includes(rec.type)) continue;
      if (isActiveRecord(rec)) return true;
    } catch {
      // Ignore malformed JSON lines
    }
  }
  return false;
}

export async function hasActivePolicy(userId) {
  if (!userId) return false;

  if (isMongoConnected()) {
    const record = await Submission.findOne({
      userId,
      type: { $in: POLICY_TYPES },
      $or: [{ status: "paid" }, { paymentStatus: "success" }],
    })
      .select("_id")
      .lean();
    return Boolean(record);
  }

  return findActiveInJsonl(userId);
}

export async function getActivePolicyTypes(userId) {
  if (!userId) return [];

  const normalize = (t) => {
    if (!t) return null;
    const lower = String(t).toLowerCase();
    if (lower.includes("car")) return "car";
    if (lower.includes("house") || lower.includes("home")) return "house";
    if (lower.includes("health")) return "health";
    if (lower.includes("life")) return "life";
    return null;
  };

  if (isMongoConnected()) {
    const records = await Submission.find({
      userId,
      type: { $in: POLICY_TYPES },
      $or: [{ status: "paid" }, { paymentStatus: "success" }],
    })
      .select("type")
      .lean();
    const types = new Set();
    for (const r of records) {
      const n = normalize(r.type);
      if (n) types.add(n);
    }
    return Array.from(types);
  }

  // fallback to scanning jsonl
  const filePath = path.join(process.cwd(), "data", "submissions.jsonl");
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  const types = new Set();
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const rec = JSON.parse(lines[i]);
      const recUser = rec.userId || rec.user_id;
      if (recUser !== userId) continue;
      if (!POLICY_TYPES.includes(rec.type)) continue;
      if (!isActiveRecord(rec)) continue;
      const n = normalize(rec.type);
      if (n) types.add(n);
    } catch {
      // ignore
    }
  }
  return Array.from(types);
}
