import { appendSubmission } from "../utils/submissionStore.js";
import { normalizeSubmissionData } from "../utils/adminPackage.js";

export default async function submit_claim({ user_id, claim_data }) {
  const normalized = normalizeSubmissionData(claim_data);
  const entry = {
    type: "claim",
    user_id,
    data: normalized,
    submitted_at: new Date().toISOString()
  };
  await appendSubmission(entry);
  return { ok: true, id: `${user_id}-claim` };
}

