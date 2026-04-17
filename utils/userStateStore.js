import User from "../models/User.js";
import { isMongoConnected } from "./db.js";

const userStore = new Map();

export async function getUserState(userId) {
  if (userStore.has(userId)) return userStore.get(userId);
  if (isMongoConnected()) {
    const doc = await User.findOne({ userId }).lean();
    if (doc) {
      userStore.set(userId, { workflow: doc.workflow || null });
      return userStore.get(userId);
    }
  }
  return null;
}

export async function setUserState(userId, state) {
  userStore.set(userId, state);
  if (isMongoConnected()) {
    await User.updateOne(
      { userId },
      { $set: { workflow: state.workflow || null } },
      { upsert: true }
    );
  }
}

export async function clearUserState(userId) {
  userStore.delete(userId);
  if (isMongoConnected()) {
    await User.deleteOne({ userId });
  }
}
