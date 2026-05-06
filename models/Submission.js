import mongoose from "mongoose";

const SubmissionSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    userId: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    workflowId: { type: String, default: null },
    status: { type: String, default: "submitted" },
    riskScoreFinal: { type: Number, default: null },
    premiumFinal: { type: mongoose.Schema.Types.Mixed, default: null },
    adminNotes: { type: mongoose.Schema.Types.Mixed, default: null },
    paymentStatus: { type: String, default: "pending" },
    paymentReference: { type: String, default: null },
    paymentAuthUrl: { type: String, default: null },
    paymentAccessCode: { type: String, default: null },
    paymentVerifiedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
    verifierId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verificationStatus: { 
      type: String, 
      enum: ["pending", "verified", "suspicious", "info_needed"], 
      default: "pending" 
    },
    verifierNotes: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },
    rejectedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.models.Submission ||
  mongoose.model("Submission", SubmissionSchema);
