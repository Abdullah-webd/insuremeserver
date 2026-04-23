import { verifyBVN, verifyNIN } from "./dojah.js";
import { verifyImageOpenAI, verifyPlateOpenAI } from "./openaiVision.js";
import { verifyPlatePrembly } from "./prembly.js";

function splitName(fullName) {
  if (!fullName) return { first_name: null, last_name: null };
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: null };
  return { first_name: parts[0], last_name: parts[parts.length - 1] };
}

function isDigits(value, length) {
  const s = String(value || "").trim();
  const re = length ? new RegExp(`^\\d{${length}}$`) : /^\d+$/;
  return re.test(s);
}

function isNigerianPlate(value) {
  // Clear any hyphens or spaces and check if it follows 3-letters, 3-digits, 2-letters
  const s = String(value || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  return /^[A-Z]{3}\d{3}[A-Z]{2}$/.test(s);
}

async function maybeVerifyImage(fieldKey, workflow) {
  const images = workflow.collected_fields?.[fieldKey];
  const imageUrl = Array.isArray(images) ? images[0] : images;
  if (!imageUrl) return null;

  const expected =
    workflow.workflow_id === "buy_car_insurance" ? "car" : "property";

  return verifyImageOpenAI({ image_url: imageUrl, expected });
}

export async function runVerifications(workflow) {
  if (!workflow || !workflow.verification) return workflow;

  const fields = workflow.collected_fields || {};

  for (const [key, meta] of Object.entries(workflow.verification)) {
    if (!meta?.required) continue;
    if (meta.status === "verified") continue;

    try {
      if (key === "bvn" && meta.provider === "dojah" && fields.bvn) {
        const result = await verifyBVN({ bvn: fields.bvn });
        meta.status = "verified";
        meta.result = result;
      } else if (key === "nin" && meta.provider === "dojah" && fields.nin) {
        const name = splitName(fields.full_name);
        const result = await verifyNIN({
          nin: fields.nin,
          first_name: name.first_name,
          last_name: name.last_name,
          dob: fields.date_of_birth
        });
        meta.status = "verified";
        meta.result = result;
      } else if (
        meta.provider === "openai_vision" &&
        (key === "car_image" || key === "property_images")
      ) {
        const result = await maybeVerifyImage(key, workflow);
        if (result) {
          meta.status = result.is_match ? "verified" : "failed";
          meta.result = result;
        }
      } else if (
        key === "plate_number" &&
        meta.provider === "prembly" &&
        fields.plate_number
      ) {
        const result = await verifyPlatePrembly({
          plate_number: fields.plate_number
        });
        meta.status = "verified";
        meta.result = result;
      } else if (
        key === "plate_number" &&
        meta.provider === "openai_vision" &&
        fields.plate_number
      ) {
        const imageUrl = Array.isArray(fields.car_image)
          ? fields.car_image[0]
          : fields.car_image;
        if (imageUrl) {
          const result = await verifyPlateOpenAI({
            image_url: imageUrl,
            plate_number: fields.plate_number
          });
          meta.status = result.is_match ? "verified" : "failed";
          meta.result = result;
        }
      } else if (meta.provider === "format_only") {
        if (key === "nin" && fields.nin) {
          meta.status = isDigits(fields.nin, 11) ? "verified" : "failed";
          meta.result = {
            note: "NIN format-only check (not verified with official source)",
            valid_format: meta.status === "verified"
          };
        } else if (key === "bvn" && fields.bvn) {
          meta.status = isDigits(fields.bvn, 11) ? "verified" : "failed";
          meta.result = {
            note: "BVN format-only check (not verified with official source)",
            valid_format: meta.status === "verified"
          };
        } else if (key === "plate_number" && fields.plate_number) {
          meta.status = isNigerianPlate(fields.plate_number)
            ? "verified"
            : "failed";
          meta.result = {
            note: "Plate number format-only check",
            valid_format: meta.status === "verified"
          };
        }
      }
    } catch (err) {
      meta.status = "failed";
      meta.error = err.message || String(err);
    }
  }

  return workflow;
}
