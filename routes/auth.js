import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import User from "../models/User.js";
import { isMongoConnected } from "../utils/db.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "insureme_secret_key_123";

// Register a new user
router.post("/register", async (req, res) => {
  if (!isMongoConnected()) return res.status(503).json({ error: "DB not connected" });

  const { name, email, password } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user_${uuidv4().split("-")[0]}`;

    const newUser = new User({
      userId,
      name,
      email,
      password: hashedPassword,
      role: "user"
    });

    await newUser.save();

    const token = jwt.sign({ id: newUser._id, userId: newUser.userId, role: newUser.role }, JWT_SECRET, { expiresIn: "7d" });

    res.json({ 
      token, 
      user: { userId: newUser.userId, name: newUser.name, email: newUser.email, role: newUser.role } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  if (!isMongoConnected()) return res.status(503).json({ error: "DB not connected" });

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, userId: user.userId, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    res.json({ 
      token, 
      user: { userId: user.userId, name: user.name, email: user.email, role: user.role } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
