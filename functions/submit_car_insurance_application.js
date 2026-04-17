import { appendSubmission } from "../utils/submissionStore.js";
import { buildAdminPackage } from "../utils/adminPackage.js";

export default async function submit_car_insurance_application({
  user_id,
  car_data,
  workflow_id,
  verification
}) {
  const summary = buildAdminPackage({
    type: "car",
    data: car_data,
    verification
  });
  const entry = {
    type: "car_insurance_application",
    user_id,
    workflow_id: workflow_id || "buy_car_insurance",
    data: car_data,
    ...summary,
    submitted_at: new Date().toISOString()
  };
  await appendSubmission(entry);
  return { ok: true, id: `${user_id}-car`, ...summary };
}
