import { appendSubmission } from "../utils/submissionStore.js";
import { buildAdminPackage } from "../utils/adminPackage.js";

export default async function submit_health_insurance_application({
  user_id,
  health_data,
  workflow_id,
  verification
}) {
  const summary = buildAdminPackage({
    type: "health",
    data: health_data,
    verification
  });
  const entry = {
    type: "health_insurance_application",
    user_id,
    workflow_id: workflow_id || "buy_health_insurance",
    data: health_data,
    ...summary,
    submitted_at: new Date().toISOString()
  };
  await appendSubmission(entry);
  return { ok: true, id: `${user_id}-health`, ...summary };
}
