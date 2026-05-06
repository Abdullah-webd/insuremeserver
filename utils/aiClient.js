import { loadContext } from "./contextLoader.js";

function extractOutputText(data) {
  if (data.output_text) return data.output_text;
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!item.content) continue;
      for (const c of item.content) {
        if (c.type === "output_text" && c.text) return c.text;
        if (c.type === "text" && c.text) return c.text;
      }
    }
  }
  return "";
}

function parseJsonFromText(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function callAI(payload, customModel = null) {
  const { system_prompt } = loadContext();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const model = customModel || process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: system_prompt || "" },
        { role: "user", content: JSON.stringify(payload) }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const text = extractOutputText(data);
  const parsed = parseJsonFromText(text);
  if (!parsed) {
    throw new Error("AI response was not valid JSON");
  }
  return parsed;
}

export async function callAIMessage({ systemPrompt, userMessage, model: customModel = null }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const model = customModel || process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: systemPrompt || "" },
        { role: "user", content: userMessage || "" }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return extractOutputText(data);
}
