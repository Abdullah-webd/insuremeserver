export function buildApprovalEmail({ userName, premium, currency, payUrl }) {
  const displayName = userName || "Customer";
  const amount = premium?.amount || 0;
  const curr = currency || premium?.currency || "NGN";

  const subject = "Your insurance application has been approved";
  const text =
    `Hello ${displayName},\n\n` +
    `Your insurance application has been approved. Your premium is ${curr} ${amount} per ${premium?.period || "year"}.\n` +
    `Please complete your payment using this link: ${payUrl}\n\n` +
    "Thank you.";

  const html = `
    <p>Hello ${displayName},</p>
    <p>Your insurance application has been approved.</p>
    <p>Your premium is <strong>${curr} ${amount}</strong> per ${premium?.period || "year"}.</p>
    <p>Please complete your payment using this link:</p>
    <p><a href="${payUrl}">${payUrl}</a></p>
    <p>Thank you.</p>
  `;

  return { subject, text, html };
}

export function buildPaymentSuccessEmail({ userName, premium }) {
  const displayName = userName || "Customer";
  const amount = premium?.amount || 0;
  const curr = premium?.currency || "NGN";

  const subject = "Payment successful";
  const text =
    `Hello ${displayName},\n\n` +
    `We have received your payment of ${curr} ${amount}. Your policy is now active.\n\n` +
    "Thank you.";

  const html = `
    <p>Hello ${displayName},</p>
    <p>We have received your payment of <strong>${curr} ${amount}</strong>.</p>
    <p>Your policy is now active.</p>
    <p>Thank you.</p>
  `;

  return { subject, text, html };
}

export function buildRejectionEmail({ userName, kind, reason }) {
  const displayName = userName || "Customer";
  const displayKind = kind || "submission";
  const safeReason =
    typeof reason === "string" && reason.trim()
      ? reason.trim()
      : "Your submission did not meet our review requirements at this time.";

  const subject = `Your ${displayKind} has been rejected`;
  const text =
    `Hello ${displayName},\n\n` +
    `Your ${displayKind} has been rejected.\n\n` +
    `Reason: ${safeReason}\n\n` +
    "You can submit a new one at any time.\n\n" +
    "Thank you.";

  const html = `
    <p>Hello ${displayName},</p>
    <p>Your <strong>${displayKind}</strong> has been rejected.</p>
    <p><strong>Reason:</strong> ${safeReason}</p>
    <p>You can submit a new one at any time.</p>
    <p>Thank you.</p>
  `;

  return { subject, text, html };
}
