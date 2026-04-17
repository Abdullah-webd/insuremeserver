import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const AUDIT_PATH = path.join(DATA_DIR, "audit.jsonl");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function writeAudit(entry) {
  ensureDataDir();
  fs.appendFileSync(AUDIT_PATH, JSON.stringify(entry) + "\n", "utf8");
}
