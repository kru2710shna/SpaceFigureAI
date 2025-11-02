// backend/routes/reasonRoutes.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateSceneWithGroq } from "../agents/groq_reasoner.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputsDir = path.join(__dirname, "../../agents/outputs");

router.post("/groq", async (req, res) => {
  try {
    const { mathData } = req.body;
    if (!mathData || !mathData.objects) {
      return res.status(400).json({ error: "Missing mathData" });
    }

    console.log("🧠 Calling Groq Reasoner with", mathData.objects.length, "objects...");
    const correctedScene = await generateSceneWithGroq(
      mathData.objects,
      mathData.scale_ratio_m
    );

    const outputPath = path.join(outputsDir, `groq_reasoned_scene_${Date.now()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(correctedScene, null, 2));

    res.json({
      message: "Groq reasoning complete ✅",
      correctedScene,
      outputFile: outputPath,
    });
  } catch (err) {
    console.error("❌ Groq reasoning route failed:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
