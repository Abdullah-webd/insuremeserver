import User from "../models/User.js";
import { isMongoConnected } from "./db.js";

const userStore = new Map();

export async function getUserState(userId) {
  if (userStore.has(userId)) return userStore.get(userId);
  if (isMongoConnected()) {
    const doc = await User.findOne({ userId }).lean();
    if (doc) {
      userStore.set(userId, {
        workflow: doc.workflow || null,
        profile: doc.profile || {},
      });
      return userStore.get(userId);
    }
  }
  return null;
}

export async function setUserState(userId, state) {
  // merge with existing in-memory profile if present
  const existing = userStore.get(userId) || {};
  const merged = { ...existing, ...state };
  userStore.set(userId, merged);
  if (isMongoConnected()) {
    await User.updateOne(
      { userId },
      {
        $set: {
          workflow: merged.workflow || null,
          profile: merged.profile || {},
        },
      },
      { upsert: true },
    );
  }
}

export async function clearUserState(userId) {
  userStore.delete(userId);
  if (isMongoConnected()) {
    await User.deleteOne({ userId });
  }
}

export async function getUserProfile(userId) {
  const state = await getUserState(userId);
  return state?.profile || {};
}

export async function setUserProfile(userId, profile) {
  const state = (await getUserState(userId)) || { workflow: null, profile: {} };
  const merged = {
    ...state,
    profile: { ...(state.profile || {}), ...(profile || {}) },
  };
  userStore.set(userId, merged);
  if (isMongoConnected()) {
    await User.updateOne(
      { userId },
      {
        $set: {
          profile: merged.profile || {},
          workflow: merged.workflow || null,
        },
      },
      { upsert: true },
    );
  }
}

export async function setUserLanguage(userId, language) {
  await setUserProfile(userId, { language });
}
