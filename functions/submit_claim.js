import { appendSubmission } from "../utils/submissionStore.js";

export default async function submit_claim({ user_id, claim_data }) {
  const entry = {
    type: "claim",
    user_id,
    data: claim_data,
    submitted_at: new Date().toISOString()
  };
  await appendSubmission(entry);
  return { ok: true, id: `${user_id}-claim` };
}
