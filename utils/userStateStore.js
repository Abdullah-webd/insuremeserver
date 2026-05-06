import User from "../models/User.js";
import { isMongoConnected } from "./db.js";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const USER_PROFILES_PATH = path.join(ROOT, "data", "user_profiles.jsonl");

export async function getUserProfile(userId) {
  if (isMongoConnected()) {
    const user = await User.findOne({ userId }).lean();
    return user ? user.profile || {} : {};
  }
  
  if (!fs.existsSync(USER_PROFILES_PATH)) return {};
  const lines = fs.readFileSync(USER_PROFILES_PATH, "utf8").split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const p = JSON.parse(lines[i]);
    if (p.userId === userId) return p.profile || {};
  }
  return {};
}

export async function setUserProfile(userId, profile) {
  if (isMongoConnected()) {
    const user = await User.findOne({ userId });
    if (user) {
      user.profile = { ...(user.profile || {}), ...profile };
      await user.save();
    } else {
      await User.create({ userId, profile });
    }
    return;
  }
  
  const entry = { userId, profile, updatedAt: new Date().toISOString() };
  fs.appendFileSync(USER_PROFILES_PATH, JSON.stringify(entry) + "\n", "utf8");
}

export async function setUserLanguage(userId, language) {
  const current = await getUserProfile(userId);
  await setUserProfile(userId, { ...current, language });
}

export async function clearUserState(userId) {
  // We no longer clear workflow state here since LangGraph manages it.
  // This is kept as a no-op so routes/admin.js doesn't crash when calling it.
  console.log(`clearUserState called for ${userId}. Workflow state is now managed by LangGraph checkpointer.`);
}
