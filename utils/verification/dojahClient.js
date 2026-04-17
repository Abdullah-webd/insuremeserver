export async function dojahRequest({ endpoint, method = "GET", query, body }) {
  const appId = process.env.DOJAH_APP_ID;
  const secretKey = process.env.DOJAH_SECRET_KEY;
  const baseUrl = process.env.DOJAH_BASE_URL || "https://api.dojah.io";

  if (!appId || !secretKey) {
    throw new Error("DOJAH_APP_ID or DOJAH_SECRET_KEY is not set");
  }

  let url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;
  if (query && Object.keys(query).length > 0) {
    const qs = new URLSearchParams(query);
    url += url.includes("?") ? `&${qs}` : `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      AppId: appId,
      Authorization: secretKey
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Dojah error: ${res.status} ${errText}`);
  }

  return res.json();
}
