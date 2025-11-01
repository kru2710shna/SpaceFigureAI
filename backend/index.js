import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import groqRoutes from "./routes/groqRoutes.js";
import * as ImageJS from "image-js";
const { Image } = ImageJS;
import tourGuideRoutes from "./routes/tourGuideRoutes.js";
import dotenv from "dotenv";
dotenv.config();
const app = express();
const PORT = 5050;

// ---------- Middleware ----------
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173"], // React and Vite
  credentials: true
}));
app.use(express.json());

// ---------- Paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "uploads");
const outputsDir = path.join(__dirname, "..", "agents", "outputs"); // ✅ Add this

// ---------- Ensure Upload Directory ----------
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log(`📁 Created uploads directory at ${uploadDir}`);
}

// ✅ Ensure Outputs Directory
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
  console.log(`📁 Created outputs directory at ${outputsDir}`);
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
    if (!image_url)
      return res.status(400).json({ error: "Missing image_url" });

    // Load the image
    const response = await fetch(image_url);
    const buffer = Buffer.from(await response.arrayBuffer());
    const img = await Image.load(buffer);

    // Convert to grayscale + edge detection
    const gray = img.grey();
    const edges = gray.sobelFilter();

    // Compute edge density and average brightness
    const pixels = edges.data;
    const edgeCount = pixels.filter((v) => v > 50).length; // strong edges
    const edgeDensity = edgeCount / pixels.length;
    const brightness = gray.mean / 255;

    // Adaptive thresholding
    const isBlueprint =
      edgeDensity > 0.002 || (edgeDensity > 0.001 && brightness > 0.4);

    const reason = isBlueprint
      ? `Detected structured wall edges (edgeDensity=${edgeDensity.toFixed(4)}).`
      : `Low edge structure (edgeDensity=${edgeDensity.toFixed(4)}).`;

    console.log(
      `🧩 Edge Density: ${edgeDensity.toFixed(4)} (${isBlueprint ? "✅ Blueprint" : "⚠️ Not Blueprint"})`
    );

    res.json({ is_blueprint: isBlueprint, reason });
  } catch (err) {
    console.error("❌ Blueprint validation failed:", err.message);
    res.json({
      is_blueprint: true, // fallback to Groq
      reason: "Local validator failed, deferring to Groq reasoning.",
    });
  }
});


// ---------- Static + Routes ----------
app.use("/uploads", express.static(uploadDir));
app.use("/agents/outputs", express.static(outputsDir)); // ✅ ADD THIS LINE - Critical for serving annotated images
app.use("/groq", groqRoutes);
app.use("/tour-guide", tourGuideRoutes);


// ---------- Root ----------
app.get("/", (_, res) => res.send("Backend is running ✅"));

// ---------- Test Outputs Directory ----------
app.get("/test-outputs", (req, res) => {
  const files = fs.readdirSync(outputsDir);
  res.json({
    outputsDir,
    files,
    sampleUrl: files.length > 0 
      ? `http://localhost:${PORT}/agents/outputs/${files[0]}`
      : "No files yet"
  });
});

// ---------- Start Server ----------
app.listen(PORT, () => {
  console.clear();
  console.log("=========================================");
  console.log(`🚀 Backend Server is running`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`📂 Upload Directory: ${uploadDir}`);
  console.log(`📂 Outputs Directory: ${outputsDir}`); // ✅ Add this log
  console.log("=========================================");
});