export async function premblyRequest({ endpoint, method = "POST", body }) {
  const baseUrl = process.env.PREMBLY_BASE_URL || "https://api.prembly.com";
  const apiKey = process.env.PREMBLY_API_KEY;
  const appId = process.env.PREMBLY_APP_ID;
  const headersJson = process.env.PREMBLY_HEADERS_JSON;
  const apiKeyHeader = process.env.PREMBLY_API_KEY_HEADER || "x-api-key";
  const appIdHeader = process.env.PREMBLY_APP_ID_HEADER || "app-id";

  let headers = { "Content-Type": "application/json" };

  if (headersJson) {
    try {
      const parsed = JSON.parse(headersJson);
      headers = { ...headers, ...parsed };
    } catch {
      throw new Error("PREMBLY_HEADERS_JSON is not valid JSON");
    }
  }

  if (apiKey && !headers[apiKeyHeader] && !headers.Authorization) {
    headers[apiKeyHeader] = apiKey;
  }

  if (appId && !headers[appIdHeader]) {
    headers[appIdHeader] = appId;
  }

  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Prembly error: ${res.status} ${errText}`);
  }

  return res.json();
}
