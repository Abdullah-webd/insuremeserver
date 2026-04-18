import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary SDK from environment variables (supports existing env names)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_KEY,
  api_secret:
    process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_SECRET,
});

function isCloudinaryUrl(url) {
  return typeof url === "string" && url.includes("res.cloudinary.com/");
}

function shouldUpload(url) {
  if (!url || typeof url !== "string") return false;
  if (isCloudinaryUrl(url)) return false;
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  );
}

function signParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto
    .createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");
}

async function uploadToCloudinary(fileUrl, { folder }) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName) throw new Error("CLOUDINARY_CLOUD_NAME is not set");

  // Default to auto upload (handles image/video/raw depending on Cloudinary detection).
  // For PDFs we must use the `raw` resource type so Cloudinary serves `application/pdf`.
  const endpointBase = `https://api.cloudinary.com/v1_1/${cloudName}`;

  const doUpload = async ({ key, secret, preset }) => {
    const form = new FormData();
    form.append("file", fileUrl);
    // Ensure uploaded assets are publicly accessible by URL (hackathon/MVP).
    form.append("access_mode", "public");

    // Signed upload path (most reliable, works for signed-only presets too).
    if (key && secret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const paramsToSign = { timestamp };
      if (folder) paramsToSign.folder = folder;

      const signature = signParams(paramsToSign, secret);

      form.append("api_key", key);
      form.append("timestamp", String(timestamp));
      form.append("signature", signature);
      if (folder) form.append("folder", folder);
      if (preset) form.append("upload_preset", preset);
      return form;
    }

    // Unsigned/preset-only path.
    if (preset) {
      form.append("upload_preset", preset);
      if (folder) form.append("folder", folder);
      return form;
    }

    throw new Error(
      "Cloudinary config missing: set CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET or CLOUDINARY_UPLOAD_PRESET",
    );
  };

  let lastErr = null;
  const tryOnce = async (args) => {
    const form = await doUpload(args);
    // Choose the upload endpoint based on file type (use raw for PDFs).
    const fileUrlStr = String(fileUrl || "").toLowerCase();
    const useRaw =
      fileUrlStr.endsWith(".pdf") || (args && args.forceRaw === true);

    // If we need raw (PDF) and the SDK is configured, prefer SDK upload (ensures resource_type=raw)
    if (useRaw) {
      try {
        const opts = { resource_type: "raw" };
        if (folder) opts.folder = folder;
        // Ensure public access
        opts.access_mode = "public";

        // If signed credentials are provided, the SDK will use them from cloudinary.config
        const result = await cloudinary.uploader.upload(fileUrl, opts);
        return result;
      } catch (err) {
        // fall through to form POST approach if SDK upload fails
        // convert error to string so callers can inspect
        // continue to try the form upload below
      }
    }

    const endpoint = useRaw
      ? `${endpointBase}/raw/upload`
      : `${endpointBase}/auto/upload`;
    const res = await fetch(endpoint, { method: "POST", body: form });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloudinary error: ${res.status} ${errText}`);
    }
    return res.json();
  };

  // Try signed upload first if credentials are provided (works even if preset is signed-only).
  if (apiKey && apiSecret) {
    try {
      return await tryOnce({
        key: apiKey,
        secret: apiSecret,
        preset: uploadPreset,
      });
    } catch (err) {
      lastErr = err;

      // Common misconfig: API key/secret swapped. If Cloudinary complains about invalid API key,
      // try swapping once automatically so you don't get blocked.
      const msg = String(err?.message || "");
      const looksSwapped =
        typeof apiKey === "string" &&
        typeof apiSecret === "string" &&
        !/^\d+$/.test(apiKey.trim()) &&
        /^\d+$/.test(apiSecret.trim());
      if (looksSwapped && /invalid api key/i.test(msg)) {
        try {
          return await tryOnce({
            key: apiSecret,
            secret: apiKey,
            preset: uploadPreset,
          });
        } catch (err2) {
          lastErr = err2;
        }
      }
    }
  }

  // Fallback to preset-only uploads (requires an unsigned preset).
  if (uploadPreset) {
    try {
      return await tryOnce({ key: null, secret: null, preset: uploadPreset });
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Cloudinary upload failed");

  // (unreachable)
}

async function uploadList(urls, opts) {
  const out = [];
  for (const u of urls) {
    if (!shouldUpload(u)) {
      out.push(u);
      continue;
    }
    const result = await uploadToCloudinary(u, opts);
    out.push(result.secure_url || u);
  }
  return out;
}

export async function ensureImagesStored(workflow) {
  if (!workflow?.collected_fields) return workflow;

  const fields = workflow.collected_fields;
  const folder = `insureme/${workflow.workflow_id || "workflow"}`;

  if (fields.car_image) {
    const urls = Array.isArray(fields.car_image)
      ? fields.car_image
      : [fields.car_image];
    const uploaded = await uploadList(urls, { folder });
    fields.car_image = uploaded.length === 1 ? uploaded[0] : uploaded;
  }

  if (fields.property_images && Array.isArray(fields.property_images)) {
    fields.property_images = await uploadList(fields.property_images, {
      folder,
    });
  }

  if (fields.evidence && Array.isArray(fields.evidence)) {
    fields.evidence = await uploadList(fields.evidence, {
      folder: `${folder}/claims`,
    });
  }

  return workflow;
}

export async function uploadImagesInData({ data, folder }) {
  if (!data) return data;

  if (data.car_image) {
    const urls = Array.isArray(data.car_image)
      ? data.car_image
      : [data.car_image];
    const uploaded = await uploadList(urls, { folder });
    data.car_image = uploaded.length === 1 ? uploaded[0] : uploaded;
  }

  if (data.property_images && Array.isArray(data.property_images)) {
    data.property_images = await uploadList(data.property_images, { folder });
  }

  if (data.evidence && Array.isArray(data.evidence)) {
    data.evidence = await uploadList(data.evidence, {
      folder: `${folder}/claims`,
    });
  }

  return data;
}
