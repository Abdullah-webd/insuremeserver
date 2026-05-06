import { appendSubmission } from "../utils/submissionStore.js";
import { buildAdminPackage, normalizeSubmissionData } from "../utils/adminPackage.js";

export default async function submit_life_insurance_application({
  user_id,
  life_data,
  workflow_id,
  verification
}) {
  const normalized = normalizeSubmissionData(life_data);
  const summary = buildAdminPackage({
    type: "life",
    data: normalized,
    verification
  });
  const entry = {
    type: "life_insurance_application",
    user_id,
    workflow_id: workflow_id || "buy_life_insurance",
    data: normalized,
    ...summary,
    submitted_at: new Date().toISOString()
  };
  await appendSubmission(entry);
  return { ok: true, id: `${user_id}-life`, ...summary };
}

