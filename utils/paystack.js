import crypto from "crypto";

export function paystackSignatureIsValid({ rawBody, signature, secret }) {
  if (!secret || !signature) return false;
  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
}

export async function initializeTransaction({ email, amount, reference, metadata }) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const baseUrl = process.env.PAYSTACK_BASE_URL || "https://api.paystack.co";

  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not set");
  if (!email) throw new Error("email is required for Paystack init");
  if (!amount) throw new Error("amount is required for Paystack init");

  const res = await fetch(`${baseUrl}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      amount: String(amount),
      reference,
      metadata
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Paystack init error: ${res.status} ${errText}`);
  }

  return res.json();
}

export async function verifyTransaction(reference) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const baseUrl = process.env.PAYSTACK_BASE_URL || "https://api.paystack.co";

  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not set");
  if (!reference) throw new Error("reference is required for Paystack verify");

  const res = await fetch(`${baseUrl}/transaction/verify/${reference}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Paystack verify error: ${res.status} ${errText}`);
  }

  return res.json();
}
