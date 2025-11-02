import express from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- PATHS ----------
const agentsDir = path.join(__dirname, "../../agents");
const depthScript = path.join(agentsDir, "depth_estimation.py");
const uploadsDir = path.join(__dirname, "../../backend/uploads");
const outputsDir = path.join(agentsDir, "outputs");

// ✅ Use your conda Python environment explicitly
const PYTHON_PATH = "/Users/krushna/SpaceFigureAI/backend/venv/bin/python";


// ---------- ROUTE ----------
router.post("/run", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing image field." });
    }

    const inputPath = path.join(__dirname, "../../agents/outputs", path.basename(image));
    const outputPath = path.join(outputsDir, `${Date.now()}_depth.png`);

    console.log(`🎨 Running depth estimation on: ${inputPath}`);
    console.log(`🧠 Using Python: ${PYTHON_PATH}`);

    // ✅ Spawn process using correct Python environment
    const process = spawn(PYTHON_PATH, [depthScript, "--input", inputPath, "--output", outputPath]);

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => (stdout += data.toString()));
    process.stderr.on("data", (data) => (stderr += data.toString()));

    process.on("close", (code) => {
      if (code !== 0) {
        console.error("❌ Depth estimation failed:", stderr || stdout);
        return res
          .status(500)
          .json({ error: "Depth estimation failed", details: stderr || stdout });
      }

      console.log("✅ Depth map generated:", outputPath);
      const fileName = path.basename(outputPath);
      res.json({
        message: "Depth estimation complete",
        depth_url: `http://localhost:5050/agents/outputs/${fileName}`,
      });
    });
  } catch (err) {
    console.error("❌ Depth route error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
