import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set in environment");
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB");

  const Audit = (await import("../models/Audit.js")).default;

  const ROOT = process.cwd();
  const auditPath = path.join(ROOT, "data", "audit.jsonl");
  if (!fs.existsSync(auditPath)) {
    console.error(`No audit file at ${auditPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(auditPath, "utf8");
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  console.log(`Found ${lines.length} audit lines`);

  let inserted = 0;
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const at = entry.at
        ? new Date(entry.at)
        : entry.timestamp
          ? new Date(entry.timestamp)
          : new Date();
      const filter = { userId: entry.userId, at };
      const doc = {
        userId: entry.userId,
        at,
        message: entry.message || null,
        aiResponse: entry.aiResponse || null,
      };
      const res = await Audit.updateOne(
        filter,
        { $setOnInsert: doc },
        { upsert: true },
      );
      // upsertedCount isn't always present; check modifiedCount/ack
      if (res.upsertedCount || res.upsertedId) inserted += 1;
    } catch (err) {
      console.error("Failed to parse or insert line:", err?.message || err);
    }
  }

  console.log(`Backfill complete. Inserted ~${inserted} new records.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err?.message || err);
  process.exit(1);
});
