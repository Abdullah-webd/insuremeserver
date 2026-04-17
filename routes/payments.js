import express from "express";
import Submission from "../models/Submission.js";
import User from "../models/User.js";
import { isMongoConnected } from "../utils/db.js";
import { paystackSignatureIsValid, verifyTransaction } from "../utils/paystack.js";
import { sendEmail } from "../utils/emailer.js";
import { buildPaymentSuccessEmail } from "../utils/emailTemplates.js";

const router = express.Router();

router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!isMongoConnected()) {
      return res.status(503).json({ error: "MongoDB not connected" });
    }

    const signature = req.headers["x-paystack-signature"];
    const rawBody = req.body;
    const secret = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackSignatureIsValid({ rawBody, signature, secret })) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(rawBody.toString("utf8"));

    if (event?.event === "charge.success") {
      const reference = event?.data?.reference;
      if (reference) {
        const verify = await verifyTransaction(reference);
        const data = verify?.data || {};

        const submission = await Submission.findOne({ paymentReference: reference });
        if (submission) {
          submission.paymentStatus = "success";
          submission.paymentVerifiedAt = new Date();
          submission.status = "paid";
          await submission.save();

          const user = await User.findOne({ userId: submission.userId }).lean();
          const email = user?.profile?.email;
          if (email) {
            const emailContent = buildPaymentSuccessEmail({
              userName: user?.profile?.full_name || submission.data?.full_name,
              premium: submission.premiumFinal
            });
            await sendEmail({ to: email, ...emailContent });
          }
        }

        return res.json({ ok: true });
      }
    }

    res.json({ ok: true });
  }
);

export default router;
