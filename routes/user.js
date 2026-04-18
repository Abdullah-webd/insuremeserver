import express from "express";
import { getUserProfile, setUserLanguage } from "../utils/userStateStore.js";

const router = express.Router();

// Get user preferences/profile
router.get("/:userId/preferences", async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: "userId required" });
  try {
    const profile = await getUserProfile(userId);
    return res.json({ profile });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Set language preference
router.post("/:userId/preferences/language", async (req, res) => {
  const { userId } = req.params;
  const { language } = req.body || {};
  if (!userId || !language)
    return res.status(400).json({ error: "userId and language required" });
  try {
    await setUserLanguage(userId, language);
    return res.json({ ok: true, language });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;
