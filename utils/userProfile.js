import User from "../models/User.js";
import { isMongoConnected } from "./db.js";

export async function upsertUserProfile({ userId, profile }) {
  if (!isMongoConnected()) return null;

  await User.updateOne(
    { userId },
    { $set: { profile } },
    { upsert: true }
  );

  return User.findOne({ userId }).lean();
}

export function buildProfileFromRegistration(data) {
  return {
    full_name: data.full_name || null,
    email: data.email || null,
    phone: data.phone || null
  };
}
