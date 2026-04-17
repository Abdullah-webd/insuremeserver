import { appendSubmission } from "../utils/submissionStore.js";
import { buildProfileFromRegistration, upsertUserProfile } from "../utils/userProfile.js";

export default async function submit_registration({ user_id, data }) {
  const entry = {
    type: "registration",
    user_id,
    data,
    submitted_at: new Date().toISOString()
  };
  await appendSubmission(entry);
  const profile = buildProfileFromRegistration(data || {});
  await upsertUserProfile({ userId: user_id, profile });
  return { ok: true, id: `${user_id}-registration` };
}
