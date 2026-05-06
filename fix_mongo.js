import mongoose from "mongoose";
import dotenv from "dotenv";
import { normalizeSubmissionData, buildAdminPackage } from "./utils/adminPackage.js";
import Submission from "./models/Submission.js";

dotenv.config();

async function fix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const submissions = await Submission.find({});
    for (const sub of submissions) {
      if (sub.data && sub.data.collected_fields) {
        console.log(`Fixing submission ${sub._id} for user ${sub.userId}`);
        const verification = sub.data.verification || {};
        const normalized = normalizeSubmissionData(sub.data);
        
        const summary = buildAdminPackage({
            type: sub.type.split('_')[0], // e.g. "house" from "house_insurance_application"
            data: normalized,
            verification
        });

        sub.data = normalized;
        sub.riskScoreFinal = summary.risk_score;
        sub.premiumFinal = summary.premium_estimate;
        sub.adminNotes = summary.admin_notes;
        
        await sub.save();
        console.log(`Updated ${sub._id}`);
      }
    }

    console.log("Done");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fix();
