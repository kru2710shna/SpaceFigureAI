// ====================================================
// 📄 Test Outputs Route — Lists Detection JSON & Image Files
// ====================================================
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the agents output directory
const outputsDir = path.join(__dirname, "../../agents/outputs");

// ----------------------------------------------------
// 🔹 GET /test-outputs → Return list of blueprint-related files
// ----------------------------------------------------
router.get("/", (req, res) => {
  try {
    if (!fs.existsSync(outputsDir)) {
      return res
        .status(404)
        .json({ error: "Agents output directory not found." });
    }

    // Include both detection JSON and annotated images
    const files = fs
      .readdirSync(outputsDir)
      .filter(
        (f) =>
          f.endsWith("_detections_blueprint.json") ||
          f.endsWith("_detected_blueprint.jpg")
      )
      .map((f) => ({
        name: f,
        url: `http://localhost:5050/agents/outputs/${f}`,
        modified: fs.statSync(path.join(outputsDir, f)).mtime,
      }))
      .sort((a, b) => b.modified - a.modified);

    res.json({
      count: files.length,
      files: files.map((f) => f.url),
    });
  } catch (err) {
    console.error("❌ /test-outputs route error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
