import mongoose from "mongoose";

let connected = false;

export async function connectMongo() {
  if (connected) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000
  });
  connected = true;
}

export function isMongoConnected() {
  return mongoose.connection?.readyState === 1;
}
