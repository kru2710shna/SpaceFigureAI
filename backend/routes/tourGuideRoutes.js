// backend/routes/tourGuideRoutes.js
import express from "express";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🌍 Base paths
const baseDir = path.join(__dirname, "../.."); // /Users/krushna/SpaceFigureAI
const backendDir = path.join(baseDir, "backend");
const uploadsDir = path.join(backendDir, "uploads");
const outputsDir = path.join(baseDir, "outputs");

// 🧠 Agent path (used for logs)
const agentPackage = "tour_guide_agent.main";

// 🗂️ Ensure outputs dir exists
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

// 🧠 Helper: Find latest uploaded file
const getLatestUploadedFile = () => {
  const files = fs.readdirSync(uploadsDir)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .map(f => ({
      file: f,
      time: fs.statSync(path.join(uploadsDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);
  return files.length ? path.join(uploadsDir, files[0].file) : null;
};

// 🚀 Run Tour Guide Agent
router.post("/run", async (req, res) => {
  try {
    console.log("\n===============================");
    console.log("🛰️  Incoming /tour-guide/run request");

    let { image_path, camera_height_m, fov_deg, prompt } = req.body;
    console.log("📩 Request body:", req.body);

    // ✅ Resolve image
    if (!image_path) {
      const latest = getLatestUploadedFile();
      if (!latest) {
        console.error("❌ No uploads found");
        return res.status(400).json({ error: "No uploaded images found." });
      }
      image_path = latest;
      console.log("📂 Using latest uploaded image:", image_path);
    } else if (image_path.startsWith("http://localhost:5050/")) {
      image_path = path.join(
        backendDir,
        image_path.replace("http://localhost:5050/", "")
      );
      console.log("🔗 Converted localhost URL to local path:", image_path);
    }

    const fullInputPath = path.resolve(image_path);
    if (!fs.existsSync(fullInputPath)) {
      console.error("❌ Image not found:", fullInputPath);
      return res.status(404).json({ error: `Image not found: ${fullInputPath}` });
    }

    console.log("🧭 Full image path:", fullInputPath);
    console.log("🧠 Agent module:", agentPackage);

    // ✅ Build command
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const cmdParts = [
      pythonCmd,
      "-m",
      agentPackage,
      `--input "${fullInputPath}"`,
      `--output "${outputsDir}"`,
    ];
    if (camera_height_m) cmdParts.push(`--camera_height_m ${camera_height_m}`);
    if (fov_deg) cmdParts.push(`--fov_deg ${fov_deg}`);
    if (prompt) cmdParts.push(`--prompt "${prompt}"`);

    const command = cmdParts.join(" ");
    console.log("🚀 Executing command:");
    console.log(command);
    console.log("===================================");

    // ✅ Execute with correct working directory + PYTHONPATH
    exec(
      command,
      {
        cwd: baseDir, // ✅ Run from SpaceFigureAI root
        env: {
          ...process.env,
          PYTHONPATH: `${baseDir}/agents:${baseDir}`, // ✅ Add both project root and agents folder
        },
        maxBuffer: 1024 * 1024 * 200,
      },
      (error, stdout, stderr) => {
        console.log("\n📤 STDOUT:\n", stdout.trim());
        console.log("\n📥 STDERR:\n", stderr.trim());

        if (error) {
          console.error("❌ Execution Error:", error.message);
          return res.status(500).json({
            error: "Tour Guide Agent execution failed",
            details: stderr || error.message,
          });
        }

        // ✅ Try to parse JSON output
        let parsed = null;
        try {
          parsed = JSON.parse(stdout);
          console.log("✅ JSON parsed successfully.");
        } catch (e) {
          console.warn("⚠️ Could not parse JSON output:", e.message);
          parsed = { raw_output: stdout.trim() };
        }

        const topKeys = Array.isArray(parsed)
          ? Object.keys(parsed[0] || {})
          : Object.keys(parsed || {});
        console.log("✅ Final Parsed JSON keys:", topKeys);
        console.log("===============================\n");

        res.json({
          message: "Tour Guide Agent completed successfully ✅",
          results: parsed,
        });
      }
    );
  } catch (err) {
    console.error("🔥 Route /tour-guide/run crashed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
