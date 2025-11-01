import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import groqRoutes from "./routes/groqRoutes.js";
import { Image } from "image-js";


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
