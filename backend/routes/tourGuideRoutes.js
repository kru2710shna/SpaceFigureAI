import express from "express";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🧩 Paths
const baseDir = path.join(__dirname, "../..");
const backendDir = path.join(baseDir, "backend");
const uploadsDir = path.join(backendDir, "uploads");
const agentsPath = path.join(baseDir, "agents", "tour_guide_agent.py");
const outputsDir = path.join(baseDir, "outputs");

// 🗂️ Ensure outputs directory exists
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

// 🧠 Helper: Get latest uploaded file
const getLatestUploadedFile = () => {
  const files = fs.readdirSync(uploadsDir)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .map(f => ({ file: f, time: fs.statSync(path.join(uploadsDir, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

  return files.length ? path.join(uploadsDir, files[0].file) : null;
};

// 🚀 Route: Run Tour Guide Agent
router.post("/run", async (req, res) => {
  try {
    let { image_path } = req.body;
    console.log("\n===============================");
    console.log("📩 Received image_path from frontend:", image_path);

    if (!image_path) {
      const latest = getLatestUploadedFile();
      if (!latest) return res.status(400).json({ error: "No uploads found." });
      image_path = latest;
      console.log("📂 Using latest uploaded image:", latest);
    } else if (image_path.startsWith("http://localhost:5050/")) {
      image_path = path.join(backendDir, image_path.replace("http://localhost:5050/", ""));
    }

    const fullInputPath = path.resolve(image_path);
    console.log("🧭 Full image path:", fullInputPath);
    console.log("🧠 Python agent path:", agentsPath);

    if (!fs.existsSync(fullInputPath))
      return res.status(404).json({ error: `Image not found: ${fullInputPath}` });

    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const command = `${pythonCmd} "${agentsPath}" --input "${fullInputPath}" --output "${outputsDir}"`;

    console.log("🚀 Executing:", command);

    exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      console.log("📤 STDOUT:", stdout.trim());
      console.log("📥 STDERR:", stderr.trim());

      if (error) {
        console.error("❌ Execution Error:", error.message);
        return res.status(500).json({
          error: "Tour Guide Agent failed to run.",
          details: stderr || error.message,
        });
      }

      // 🧠 Extract JSON section from noisy YOLO output
      const jsonMatch = stdout.match(/\[\s*{[\s\S]*}\s*\]/);
      let parsedOutput;

      if (jsonMatch) {
        try {
          parsedOutput = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.warn("⚠️ JSON parse failed:", e.message);
          parsedOutput = { raw_output: stdout.trim() };
        }
      } else {
        parsedOutput = { raw_output: stdout.trim() };
      }

      console.log("✅ Parsed JSON:", parsedOutput);
      console.log("===============================\n");

      res.json({
        message: "Tour Guide Agent completed successfully",
        results: parsedOutput,
      });
    });
  } catch (err) {
    console.error("❌ /tour-guide/run route failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
