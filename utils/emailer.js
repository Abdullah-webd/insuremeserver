export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "no-reply@insureme.example";
  const baseUrl = process.env.RESEND_BASE_URL || "https://api.resend.com";

  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!to) throw new Error("Email 'to' is required");

  const res = await fetch(`${baseUrl}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Email send error: ${res.status} ${errText}`);
  }

  return res.json();
}
