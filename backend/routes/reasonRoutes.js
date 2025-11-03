// ====================================================
// 🧠 Groq Reasoning — Workspace-based 3D Output
// ====================================================
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getWorkspacePath } from "../index.js";
import { generateSceneWithGroq } from "../agents/groq_reasoner.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.post("/groq", async (req, res) => {
  try {
    const { objects, scale_ratio_m, depth_hint, upload_id } = req.body;
    if (!upload_id) throw new Error("Missing upload_id.");
    if (!objects || !Array.isArray(objects))
      throw new Error("Invalid or missing objects array.");

    console.log(`🧠 [Groq3D] ${objects.length} objects | scale=${scale_ratio_m}`);

    const ws = getWorkspacePath(upload_id);
    const reasoningDir = path.join(ws, "reasoning");
    if (!fs.existsSync(reasoningDir)) fs.mkdirSync(reasoningDir, { recursive: true });

    const result = await generateSceneWithGroq(objects, scale_ratio_m, depth_hint);
    if (!Array.isArray(result) || result.length === 0)
      throw new Error("Empty Groq reasoning result.");

    const outFile = path.join(reasoningDir, "groq_reasoned_scene.json");
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));

    res.json({
      message: "✅ Groq reasoning complete",
      workspace: ws,
      result_file: `/workspace/${upload_id}/reasoning/groq_reasoned_scene.json`,
      count: result.length,
      result,
    });
  } catch (err) {
    console.error("❌ /groq:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
