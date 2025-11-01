import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import groqRoutes from "./routes/groqRoutes.js";

const app = express();
const PORT = 5050;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

// ---------- Paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "uploads");

// ---------- Ensure Upload Directory ----------
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log(`📁 Created uploads directory at ${uploadDir}`);
}

// ---------- Logger ----------
app.use((req, _, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ---------- Multer Setup ----------
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const unique = `${Date.now()}-${file.originalname}`;
    console.log(`📝 Uploaded: ${unique}`);
    cb(null, unique);
  },
});
const upload = multer({ storage });

// ---------- Routes ----------
app.post("/upload", upload.array("files"), (req, res) => {
  if (!req.files?.length) {
    return res.status(400).json({ message: "No files uploaded." });
  }

  res.json({
    message: "Files uploaded successfully",
    uploaded: req.files.map((f) => ({
      filename: f.filename,
      path: `/uploads/${f.filename}`,
    })),
  });
});

// ---------- Blueprint Validation (Edge-based) ----------
app.post("/validate-blueprint", async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "Missing image_url" });

    // 1️⃣ Fetch image
    const response = await fetch(image_url);
    const buffer = Buffer.from(await response.arrayBuffer());

    // 2️⃣ Convert to grayscale
    const grayscale = await sharp(buffer).greyscale().toBuffer();

    // 3️⃣ Detect edges using Sobel operator (fallback if no OpenCV)
    const pixels = Uint8Array.from(grayscale);
    let edgeCount = 0;
    for (let i = 1; i < pixels.length; i++) {
      if (Math.abs(pixels[i] - pixels[i - 1]) > 30) edgeCount++;
    }

    const edgeRatio = edgeCount / pixels.length;
    const isBlueprint = edgeRatio > 0.015;

    return res.json({
      is_blueprint: isBlueprint,
      edge_density: edgeRatio.toFixed(4),
      reason: isBlueprint
        ? "Detected structured edges suggesting blueprint layout."
        : "Low edge density; not likely a blueprint.",
    });
  } catch (err) {
    console.error("❌ Blueprint validation failed:", err.message);
    res.status(500).json({ error: "Blueprint validation failed." });
  }
});

// ---------- Static + Groq ----------
app.use("/uploads", express.static(uploadDir));
app.use("/groq", groqRoutes);

// ---------- Root ----------
app.get("/", (_, res) => res.send("Backend is running ✅"));

// ---------- Start Server ----------
app.listen(PORT, () => {
  console.clear();
  console.log("=========================================");
  console.log(`🚀 Backend Server is running`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`📂 Upload Directory: ${uploadDir}`);
  console.log("=========================================");
});
