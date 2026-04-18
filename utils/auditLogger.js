import fs from "fs";
import path from "path";
import { isMongoConnected } from "./db.js";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const AUDIT_PATH = path.join(DATA_DIR, "audit.jsonl");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export async function writeAudit(entry) {
  try {
    ensureDataDir();
    fs.appendFileSync(AUDIT_PATH, JSON.stringify(entry) + "\n", "utf8");
  } catch (err) {
    console.error("Failed to write audit file:", err?.message || err);
  }

  // Also persist to MongoDB if available
  try {
    if (isMongoConnected()) {
      const { default: Audit } = await import("../models/Audit.js");
      const doc = new Audit({
        userId: entry.userId,
        at: entry.at ? new Date(entry.at) : new Date(),
        message: entry.message,
        aiResponse: entry.aiResponse,
      });
      await doc.save();
    }
  } catch (err) {
    console.error("Failed to write audit to MongoDB:", err?.message || err);
  }
}

export default writeAudit;
