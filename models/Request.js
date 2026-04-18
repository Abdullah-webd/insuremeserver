import mongoose from "mongoose";

const RequestSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String, default: null },
    userPhone: { type: String, default: null },
    type: { type: String, default: "general" },
    title: { type: String, default: null },
    message: { type: String, default: null },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, default: "open" },
  },
  { timestamps: true },
);

export default mongoose.models.Request ||
  mongoose.model("Request", RequestSchema);
