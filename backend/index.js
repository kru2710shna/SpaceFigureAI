// backend/index.js
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = 5050;

// --- Basic Setup ---
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Ensure Upload Directory Exists ---
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log(`📁 Created uploads directory: ${uploadDir}`);
}

// --- Request Logging Middleware ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- Multer Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log(`📦 Saving to: ${uploadDir}`);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    console.log(`📝 Generated filename: ${uniqueName}`);
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// --- Upload Endpoint ---
app.post("/upload", upload.array("files"), (req, res) => {
  console.log("📤 Incoming upload request...");

  if (!req.files || req.files.length === 0) {
    console.log("⚠️ No files received by multer.");
    return res.status(400).json({ message: "No files uploaded" });
  }

  console.log(`✅ Uploaded ${req.files.length} file(s):`);
  req.files.forEach((f) => console.log(`→ ${f.filename}`));

  res.json({
    message: "Files uploaded successfully",
    uploaded: req.files.map((f) => ({
      filename: f.filename,
      path: `/uploads/${f.filename}`,
    })),
    analysis: {
      caption: "Bright modern living room with natural light.",
      question: "Would you like to redesign this space or analyze lighting?",
    },
  });

});

// --- Serve Static Uploads ---
app.use("/uploads", express.static(uploadDir));

// --- Default Route for Quick Test ---
app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

// --- Start Server ---
app.listen(PORT, () => {
  console.clear();
  console.log("=========================================");
  console.log(`🚀 Backend Server is running`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`📂 Upload Directory: ${uploadDir}`);
  console.log("=========================================");
});
