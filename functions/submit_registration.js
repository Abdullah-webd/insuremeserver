import { appendSubmission } from "../utils/submissionStore.js";
import { buildProfileFromRegistration, upsertUserProfile } from "../utils/userProfile.js";
import { normalizeSubmissionData } from "../utils/adminPackage.js";

export default async function submit_registration({ user_id, data }) {
  const normalized = normalizeSubmissionData(data);
  const entry = {
    type: "registration",
    user_id,
    data: normalized,
    submitted_at: new Date().toISOString()
  };
  await appendSubmission(entry);
  const profile = buildProfileFromRegistration(normalized || {});
  await upsertUserProfile({ userId: user_id, profile });
  return { ok: true, id: `${user_id}-registration` };
}

