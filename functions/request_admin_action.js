import Request from "../models/Request.js";
import { sendEmail } from "../utils/emailer.js";

// payload example:
// { user_id, user_name, user_phone, title, message, type, data }
export default async function request_admin_action(payload = {}) {
  const userId = payload.user_id || payload.userId || payload.user || null;
  if (!userId) throw new Error("user_id is required");

  const req = new Request({
    userId,
    userName: payload.user_name || payload.userName || null,
    userPhone: payload.user_phone || payload.userPhone || null,
    type: payload.type || "general",
    title: payload.title || payload.subject || "User request",
    message: payload.message || payload.body || null,
    data: payload.data || {},
  });

  await req.save();

  // Optionally notify admins by email (simple): send to configured admin email if present
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const subject = `New user request: ${req.title || "Request"}`;
    const html = `<p>A new request was submitted by <b>${req.userName || req.userId}</b> (${req.userId}).</p>
      <p>Title: ${req.title}</p>
      <p>Message: ${req.message || "(no message)"}</p>`;
    try {
      await sendEmail({
        to: adminEmail,
        subject,
        html,
        text: `${req.message || ""}`,
      });
    } catch (e) {
      // ignore email errors
    }
  }

  return { ok: true, request: req };
}
