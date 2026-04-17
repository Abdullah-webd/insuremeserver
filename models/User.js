import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    workflow: { type: mongoose.Schema.Types.Mixed, default: null },
    profile: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
