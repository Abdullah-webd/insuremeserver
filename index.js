import "dotenv/config";
import express from "express";
import swaggerUi from "swagger-ui-express";
import cors from "cors";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";
import userRoutes from "./routes/user.js";
import paystackWebhookRoutes from "./routes/payments.js";
import { connectMongo } from "./utils/db.js";
import openapiSpec from "./docs/openapi.js";

const app = express();

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const envOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = envOrigins.length ? envOrigins : defaultOrigins;

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    // Allow all origins if explicitly configured (dev only).
    if (envOrigins.includes("*")) return cb(null, true);

    // Always allow localhost/127.0.0.1 from any port for local development,
    // including Swagger UI on :4000.
    const isLocalhost =
      /^https?:\/\/localhost(?::\d+)?$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin);
    if (isLocalhost) return cb(null, true);

    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Paystack webhook needs raw body
app.use("/webhooks/paystack", paystackWebhookRoutes);

// Allow larger JSON payloads (e.g., base64 media uploads from admin dashboard).
app.use(express.json({ limit: "25mb" }));

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get("/openapi.json", (req, res) => res.json(openapiSpec));

app.use("/chat", chatRoutes);
app.use("/admin", adminRoutes);
app.use("/user", userRoutes);

const PORT = process.env.PORT || 3000;

connectMongo()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message || err);
    app.listen(PORT, () =>
      console.log(`Server running on port ${PORT} (MongoDB offline)`),
    );
  });
