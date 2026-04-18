import { handleRefusal } from "../utils/refusalHandler.js";
import { setUserProfile, getUserProfile } from "../utils/userStateStore.js";

async function testRefusal() {
  const workflow = {
    status: "pending_cancel",
    workflow_id: "file_claim",
    current_step: 2,
  };
  const res = handleRefusal({
    message: "yes cancel",
    workflow,
    userId: "test_user",
  });
  if (!res || res.workflow !== null) {
    console.error(
      "Refusal test FAILED: expected workflow to be null on confirmed cancel",
      res,
    );
    process.exit(2);
  }
  console.log("Refusal test passed");
}

async function testLanguagePersistence() {
  const userId = "test_user_pref";
  await setUserProfile(userId, { language: "pidgin" });
  const p = await getUserProfile(userId);
  if (!p || p.language !== "pidgin") {
    console.error("Language persistence FAILED", p);
    process.exit(3);
  }
  console.log("Language persistence passed");
}

(async function run() {
  try {
    await testRefusal();
    await testLanguagePersistence();
    console.log("All tests passed (basic)");
  } catch (err) {
    console.error("Tests failed:", err);
    process.exit(1);
  }
})();
