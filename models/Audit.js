import mongoose from "mongoose";

const AuditSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    at: { type: Date, default: () => new Date() },
    message: { type: mongoose.Schema.Types.Mixed },
    aiResponse: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

export default mongoose.models.Audit || mongoose.model("Audit", AuditSchema);
