import { appendSubmission } from "../utils/submissionStore.js";
import { buildAdminPackage } from "../utils/adminPackage.js";

export default async function submit_house_insurance_application({
  user_id,
  house_data,
  workflow_id,
  verification
}) {
  const summary = buildAdminPackage({
    type: "house",
    data: house_data,
    verification
  });
  const entry = {
    type: "house_insurance_application",
    user_id,
    workflow_id: workflow_id || "buy_house_insurance",
    data: house_data,
    ...summary,
    submitted_at: new Date().toISOString()
  };
  await appendSubmission(entry);
  return { ok: true, id: `${user_id}-house`, ...summary };
}
