import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.join(__dirname, "../.."); // ✅ correct
const outputsDir = path.join(baseDir, "agents", "outputs");
console.log("🧭 baseDir resolved to:", baseDir);


// 🧠 Helper — find latest detections JSON
const getLatestDetectionsFile = () => {
  if (!fs.existsSync(outputsDir)) {
    console.warn("⚠️ outputsDir missing, creating:", outputsDir);
    fs.mkdirSync(outputsDir, { recursive: true });
  }

  const files = fs
    .readdirSync(outputsDir)
    .filter((f) => f.endsWith("_detections_blueprint.json"))
    .map((f) => ({
      file: f,
      time: fs.statSync(path.join(outputsDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  return files.length ? path.join(outputsDir, files[0].file) : null;
};

// 🧮 Mathematical Agent Endpoint
router.get("/run", async (req, res) => {
  try {
    const jsonPath = getLatestDetectionsFile();
    if (!jsonPath) {
      return res.status(404).json({
        error: "No detection JSON found in /agents/outputs",
        checkedPath: outputsDir,
      });
    }

    console.log(`🧾 Using latest detections file: ${jsonPath}`);
    const detections = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    if (!Array.isArray(detections) || detections.length === 0) {
      return res.status(400).json({
        error: "Invalid or empty detection data.",
      });
    }

    // Estimate pixel → meter scaling
    const known_wall_height_m = 3.0;
    const sampleWall = detections.find((o) =>
      o.label.toLowerCase().includes("wall")
    );

    if (!sampleWall?.bbox_xyxy) {
      return res.status(400).json({
        error: "No wall object found for scale estimation.",
      });
    }

    const [x1, y1, x2, y2] = sampleWall.bbox_xyxy;
    const pixel_wall_height = Math.abs(y2 - y1);
    const px_to_m = known_wall_height_m / pixel_wall_height;

    const objects = detections.map((obj) => {
      const [x1, y1, x2, y2] = obj.bbox_xyxy;
      const pixel_height = Math.abs(y2 - y1);
      const scaled_height_m = pixel_height * px_to_m;
      const real_height_ft = scaled_height_m * 3.281;
      return {
        label: obj.label,
        pixel_height,
        scaled_height_m: Number(scaled_height_m.toFixed(2)),
        real_height_ft: Number(real_height_ft.toFixed(2)),
      };
    });

    const room_area_m2 = 6.5 * 5.5;

    res.json({
      message: "Mathematical Agent computed successfully ✅",
      outputsDir,
      latest_file: path.basename(jsonPath),
      scale_ratio_m: px_to_m,
      reference_wall_height_m: known_wall_height_m,
      confidence: 0.95,
      room_area_m2,
      objects,
    });
  } catch (err) {
    console.error("❌ Math Agent Error:", err);
    res.status(500).json({
      error: "Mathematical agent failed",
      details: err.message,
    });
  }
});

export default router;
