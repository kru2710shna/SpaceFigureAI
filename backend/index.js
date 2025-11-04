// ====================================================
// 🚀 SpaceFigureAI Backend Entry — Unified Workspace
// ====================================================
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import * as ImageJS from "image-js";
const Image = ImageJS.Image;


// ------------------- Routes -------------------
import groqRoutes from "./routes/groqRoutes.js";
import tourGuideRoutes from "./routes/tourGuideRoutes.js";
import depthRoutes from "./routes/depthRoutes.js";
import mathRoutes from "./routes/mathRoutes.js";
import reasonRoutes from "./routes/reasonRoutes.js";
import testOutputsRoutes from "./routes/testOutputs.js";


dotenv.config();
const app = express();
const PORT = process.env.PORT || 5050;

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

// ----------------------------------------------------
// 📁 Directory Setup
// ----------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "uploads");
const workspaceDir = path.join(__dirname, "workspace");

function ensureDir(p, label) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
    if (label) console.log(`📁 Created ${label} at: ${p}`);
  }
}
ensureDir(uploadDir, "uploads");
ensureDir(workspaceDir, "workspace");

// Export for other modules
export function getWorkspacePath(uploadId) {
  const dir = path.join(workspaceDir, uploadId);
  ensureDir(dir);
  return dir;
}

// ----------------------------------------------------
// 🧠 Logger
// ----------------------------------------------------
app.use((req, _, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ----------------------------------------------------
// 📤 Upload
// ----------------------------------------------------
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const unique = `${Date.now()}-${file.originalname}`;
    console.log(`📝 Uploaded: ${unique}`);
    cb(null, unique);
  },
});
const upload = multer({ storage });

app.post("/upload", upload.array("files"), (req, res) => {
  if (!req.files?.length)
    return res.status(400).json({ message: "No files uploaded." });

  const uploaded = req.files.map((f) => {
    const uploadId = f.filename.split("-")[0];
    const ws = getWorkspacePath(uploadId);
    ["detections", "depth", "math", "reasoning", "preview"].forEach((d) =>
      ensureDir(path.join(ws, d))
    );
    return {
      uploadId,
      filename: f.filename,
      input_url: `/uploads/${f.filename}`,
      workspace: ws,
    };
  });
  res.json({ message: "✅ Uploaded successfully", uploaded });
});

// ----------------------------------------------------
// 🧩 Blueprint Validation
// ----------------------------------------------------
app.post("/validate-blueprint", async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "Missing image_url" });

    const r = await fetch(image_url);
    const buf = Buffer.from(await r.arrayBuffer());
    const img = await Image.fromBuffer(buf);

    const gray = img.grey();
    const edges = gray.sobelFilter();
    const edgeCount = edges.data.filter((v) => v > 50).length;
    const edgeDensity = edgeCount / edges.data.length;
    const brightness = gray.mean / 255;

    const isBlueprint = edgeDensity > 0.002 || (edgeDensity > 0.001 && brightness > 0.4);
    const reason = isBlueprint
      ? `Detected structured edges (density=${edgeDensity.toFixed(4)}).`
      : `Low structural edge density (density=${edgeDensity.toFixed(4)}).`;

    console.log(`🧩 Blueprint → ${isBlueprint ? "✅ Valid" : "⚠️ Weak"} | ${reason}`);
    res.json({ is_blueprint: isBlueprint, reason });
  } catch (err) {
    console.error("❌ Blueprint validation failed:", err.message);
    res.json({
      is_blueprint: true,
      reason: "Local validator failed, deferring to AI reasoning.",
    });
  }
});

// ----------------------------------------------------
// 🌐 Static Routes
// ----------------------------------------------------
app.use("/uploads", express.static(uploadDir));
app.use("/workspace", express.static(workspaceDir));

const agentsOutputsDir = path.join(__dirname, "../agents/outputs");

if (fs.existsSync(agentsOutputsDir)) {
  app.use("/agents/outputs", express.static(agentsOutputsDir));
  console.log(`📂 Serving Agents Outputs: ${agentsOutputsDir}`);
} else {
  console.warn("⚠️  agents/outputs directory not found — static serving disabled");
}

// ----------------------------------------------------
// 🔗 Routes
// ----------------------------------------------------
app.use("/groq", groqRoutes);
app.use("/tour-guide", tourGuideRoutes);
app.use("/depth", depthRoutes);
app.use("/math", mathRoutes);
app.use("/reason", reasonRoutes);
app.use("/test-outputs", testOutputsRoutes);


app.get("/", (_, res) => res.send("✅ SpaceFigureAI Backend Running"));
app.listen(PORT, () => {
  console.clear();
  console.log("=========================================");
  console.log("🚀 SpaceFigureAI Backend Server Running");
  console.log(`🌐 Port: ${PORT}`);
  console.log(`📂 Uploads: ${uploadDir}`);
  console.log(`📂 Workspace: ${workspaceDir}`);
  console.log("=========================================");
});
