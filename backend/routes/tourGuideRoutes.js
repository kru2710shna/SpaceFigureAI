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
const baseDir = path.join(__dirname, "../.."); // project root
const backendDir = path.join(baseDir, "backend");
const uploadsDir = path.join(backendDir, "uploads");
const outputsDir = path.join(baseDir, "agents", "outputs");

// 🗂️ Ensure outputs dir exists
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

// 🧠 Helper: Find latest uploaded file
const getLatestUploadedFile = () => {
  const files = fs
    .readdirSync(uploadsDir)
    .filter((f) => /\.(jpg|jpeg|png|bmp|tif|tiff)$/i.test(f))
    .map((f) => ({
      file: f,
      time: fs.statSync(path.join(uploadsDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);
  return files.length ? path.join(uploadsDir, files[0].file) : null;
};

// 🐍 Helper: Get correct Python executable path
const getPythonCommand = () => {
  const isWindows = process.platform === "win32";

  // Try virtual environment first
  const venvPaths = isWindows
    ? [
      path.join(backendDir, "venv", "Scripts", "python.exe"),
      path.join(baseDir, "venv", "Scripts", "python.exe"),
    ]
    : [
      path.join(backendDir, "venv", "bin", "python3"),
      path.join(backendDir, "venv", "bin", "python"),
      path.join(baseDir, "venv", "bin", "python3"),
      path.join(baseDir, "venv", "bin", "python"),
    ];

  // Check if venv exists
  for (const venvPath of venvPaths) {
    if (fs.existsSync(venvPath)) {
      console.log("✅ Found Python venv at:", venvPath);
      return `"${venvPath}"`;
    }
  }

  // Fallback to system Python
  console.warn("⚠️ Virtual environment not found, using system Python");
  return isWindows ? "python" : "python3";
};

// 🚀 Run Tour Guide Agent (calls Python process_media inline)
router.post("/run", async (req, res) => {
  try {
    console.log("\n===============================");
    console.log("🛰️  Incoming /tour-guide/run request");

    let { image_path, mode } = req.body || {};
    console.log("📩 Request body:", req.body);

    // ✅ Resolve image path
    if (!image_path) {
      const latest = getLatestUploadedFile();
      if (!latest) {
        console.error("❌- 1 No uploads found");
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
      console.error("❌ -2 Image not found:", fullInputPath);
      return res.status(404).json({ error: `Image not found: ${fullInputPath}` });
    }

    // 🧭 Normalize paths for Python (use forward slashes for cross-platform)
    const safeInput = fullInputPath.replace(/\\/g, "/");
    const safeOutput = outputsDir.replace(/\\/g, "/");

    // 🔧 Mode override: "blueprint" | "room" | undefined (auto)
    let pyModeLiteral = "None";
    if (typeof mode === "string" && ["blueprint", "room"].includes(mode.toLowerCase())) {
      pyModeLiteral = `"${mode.toLowerCase()}"`;
    }

    // 🧠 Create Python script with proper escaping
    const agentsDir = path.join(baseDir, "agents").replace(/\\/g, "/");
    const pyScript = `
import sys
import json
import warnings
import os

# Suppress all warnings and YOLO output
warnings.filterwarnings("ignore")
os.environ['YOLO_VERBOSE'] = 'False'

# Redirect stdout temporarily to capture only JSON
from io import StringIO
original_stdout = sys.stdout

# Add agents directory to Python path
sys.path.insert(0, r"${agentsDir}")

# Import from the tour_guide_agent.py file (not the folder)
import tour_guide_agent as tg_module

try:
    # Temporarily redirect stdout to suppress YOLO prints
    sys.stdout = StringIO()
    
    results = tg_module.process_media(r"${safeInput}", r"${safeOutput}", ${pyModeLiteral})
    
    # Restore stdout
    sys.stdout = original_stdout
    
    # Print only the JSON
    print(json.dumps(results, ensure_ascii=False))
    sys.exit(0)
except Exception as e:
    # Restore stdout in case of error
    sys.stdout = original_stdout
    import traceback
    error_details = traceback.format_exc()
    print(json.dumps({"error": str(e), "type": type(e).__name__, "traceback": error_details}), file=sys.stderr)
    sys.exit(1)
`.trim();

    // Write script to temporary file to avoid command-line escaping issues
    const tempScriptPath = path.join(baseDir, "temp_tour_guide_script.py");
    fs.writeFileSync(tempScriptPath, pyScript, "utf-8");

    // Get the correct Python command for this platform
    const pythonCmd = getPythonCommand();
    const command = `${pythonCmd} "${tempScriptPath}"`;

    console.log("🧭 Full image path:", fullInputPath);
    console.log("📦 Outputs dir:", outputsDir);
    console.log("🧠 Mode override:", pyModeLiteral === "None" ? "(auto)" : pyModeLiteral.replace(/"/g, ""));
    console.log("🐍 Python command:", pythonCmd);
    console.log("🚀 Executing command:\n", command);
    console.log("===================================");

    exec(
      command,
      {
        cwd: path.join(baseDir, "agents"),
        env: {
          ...process.env,
          PYTHONPATH: path.join(baseDir, "agents"),
        },
        maxBuffer: 1024 * 1024 * 200,
      },
      (error, stdout, stderr) => {
        // Clean up temp script
        try {
          if (fs.existsSync(tempScriptPath)) {
            fs.unlinkSync(tempScriptPath);
          }
        } catch (cleanupErr) {
          console.warn("⚠️ Could not delete temp script:", cleanupErr.message);
        }

        if (stderr && stderr.trim()) {
          console.log("\n📥 STDERR:\n", stderr.trim());
        }

        if (error) {
          console.error("❌ -3 Execution Error:", error.message);

          // Try to parse error from stderr
          let errorDetails = stderr || error.message;
          try {
            const parsedError = JSON.parse(stderr);
            errorDetails = parsedError.error || errorDetails;
          } catch (e) {
            // stderr is not JSON, use as-is
          }

          return res.status(500).json({
            error: "Tour Guide Agent execution failed",
            details: errorDetails,
          });
        }

        // ✅ Parse JSON emitted by Python
        let parsed;
        try {
          const trimmedOutput = stdout.trim();
          if (!trimmedOutput) {
            console.warn("⚠️ Empty output from Python script");
            return res.status(500).json({
              error: "Empty output from Python script",
              details: stderr || "No output generated",
            });
          }

          // Extract JSON from output (in case there are YOLO logs before it)
          const jsonMatch = trimmedOutput.match(/\[{.*}\]/s);
          if (!jsonMatch) {
            console.warn("⚠️ No JSON array found in output");
            console.warn("Raw output:", trimmedOutput);
            return res.status(500).json({
              error: "No valid JSON found in output",
              raw_output: trimmedOutput,
            });
          }

          parsed = JSON.parse(jsonMatch[0]);

          // Convert file paths to localhost URLs
          if (Array.isArray(parsed)) {
            parsed = parsed.map(item => ({
              ...item,
              annotated_image: item.annotated_image
                ? `http://localhost:5050/agents/outputs/${path.basename(item.annotated_image)}`
                : null,
              json: item.json
                ? `http://localhost:5050/agents/outputs/${path.basename(item.json)}`
                : null,
              csv: item.csv
                ? `http://localhost:5050/agents/outputs/${path.basename(item.csv)}`
                : null,
            }));
          }

          console.log("✅ Successfully parsed and converted paths:");
          console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.warn("⚠️ Could not parse JSON output:", e.message);
          console.warn("Raw output:", stdout);
          return res.status(500).json({
            error: "Failed to parse Python output",
            details: e.message,
            raw_output: stdout,
          });
        }

        const topKeys = Array.isArray(parsed)
          ? Object.keys(parsed[0] || {})
          : Object.keys(parsed || {});
        console.log("✅ Final Parsed JSON keys:", topKeys);
        console.log("===============================\n");

        res.json({
          message: "Tour Guide Agent completed successfully",
          results: parsed,
        });
      }
    );
  } catch (err) {
    console.error("❌ -4 Route /tour-guide/run crashed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;