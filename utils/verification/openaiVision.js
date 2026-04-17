function extractOutputText(data) {
  if (data.output_text) return data.output_text;
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!item.content) continue;
      for (const c of item.content) {
        if ((c.type === "output_text" || c.type === "text") && c.text) return c.text;
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

export async function verifyImageOpenAI({ image_url, expected }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `You are verifying insurance documents. Determine if the image shows a ${expected}. Respond ONLY as JSON: {"is_match": boolean, "confidence": number, "reason": string}.`
            },
            {
              type: "input_image",
              image_url
            }
          ]
        }
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
  if (!parsed) throw new Error("OpenAI vision response was not JSON");

  return parsed;
}

export async function verifyPlateOpenAI({ image_url, plate_number }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "You are verifying an insurance plate number. Read the plate number from the image (if visible) and compare to the provided value. Respond ONLY as JSON: {\"is_match\": boolean, \"extracted_plate\": string, \"confidence\": number, \"reason\": string}."
            },
            {
              type: "input_text",
              text: `Provided plate number: ${plate_number || ""}`
            },
            {
              type: "input_image",
              image_url
            }
          ]
        }
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
  if (!parsed) throw new Error("OpenAI plate response was not JSON");

  return parsed;
}
