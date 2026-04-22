import { setUserProfile, getUserProfile } from "../utils/userStateStore.js";

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
    await testLanguagePersistence();
    console.log("All tests passed (basic)");
  } catch (err) {
    console.error("Tests failed:", err);
    process.exit(1);
  }
})();
