import bcrypt from "bcryptjs";
import User from "../models/User.js";

export async function seedUsers() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@insureme.com";
    const adminPass = process.env.ADMIN_PASSWORD || "Admin123!";
    
    const verifierEmail = process.env.VERIFIER_EMAIL || "verifier@insureme.com";
    const verifierPass = process.env.VERIFIER_PASSWORD || "Verifier123!";

    // Check for Admin
    const adminExists = await User.findOne({ email: adminEmail });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash(adminPass, 10);
      await new User({
        userId: "admin_fixed",
        name: "System Admin",
        email: adminEmail,
        password: hashedPassword,
        role: "admin"
      }).save();
      console.log(`Seeded Admin: ${adminEmail}`);
    }

    // Check for Verifier
    const verifierExists = await User.findOne({ email: verifierEmail });
    if (!verifierExists) {
      const hashedPassword = await bcrypt.hash(verifierPass, 10);
      await new User({
        userId: "verifier_fixed",
        name: "Verification Officer",
        email: verifierEmail,
        password: hashedPassword,
        role: "verifier"
      }).save();
      console.log(`Seeded Verifier: ${verifierEmail}`);
    }
  } catch (err) {
    console.error("Seeding failed:", err.message);
  }
}
