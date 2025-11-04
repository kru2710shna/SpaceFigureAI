// ====================================================
// 🧠 Groq Routes — Hybrid Visual + Semantic AI Reasoning
// ====================================================
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import csv from "csv-parser";
import Groq from "groq-sdk";
import csvParser from "csv-parser";

dotenv.config();
const router = express.Router();

// ====================================================
// ✅ Constants
// ====================================================
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELS = {
  confirm: "llama-3.1-8b-instant",
  questions: "llama-3.1-8b-instant",
  analyze: "llama-3.3-70b-versatile",
};

// ====================================================
// 🧩 Helper: Call Groq API
// ====================================================
async function callGroq(messages, modelKey = "analyze", temperature = 0.4, max_tokens = 800) {
  const model = MODELS[modelKey] || MODELS.analyze;

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error (${model}): ${res.status} — ${text}`);
  }

  return res.json();
}

// ====================================================
// 🔹 POST /groq/confirm → Hybrid visual + semantic validation
// ====================================================
router.post("/confirm", async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "Missing image_url" });

    // 1️⃣ Local visual validator
    let visualConfidence = false;
    let visualReason = "Local validator unavailable.";

    try {
      const visual = await fetch("http://127.0.0.1:5050/validate-blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url }),
      });
      const visualResult = await visual.json();
      visualConfidence = visualResult?.is_blueprint || false;
      visualReason = visualResult?.reason || "No reason provided.";
      console.log(
        `🧠 Local visual check → ${visualConfidence ? "✅ Blueprint" : "⚠️ Possibly Non-Blueprint"} (${visualReason})`
      );
    } catch (e) {
      console.warn("⚠️ Local validator not running, skipping visual check.");
    }

    // 2️⃣ Semantic confirmation with Groq
    const messages = [
      {
        role: "system",
        content:
          "You are an expert architectural AI. Determine if an image represents a valid blueprint, floor plan, or layout diagram suitable for spatial reasoning.",
      },
      {
        role: "user",
        content: `Local detection result: ${visualConfidence}.
Analyze this image: ${image_url}
Respond strictly in JSON:
{
  "is_blueprint": true or false,
  "reason": "short explanation"
}`,
      },
    ];

    const data = await callGroq(messages, "confirm");
    let raw = data?.choices?.[0]?.message?.content?.trim() || "{}";
    raw = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { is_blueprint: true, reason: "Fallback: visually confirmed layout." };
    }

    const confirmed = parsed.is_blueprint || visualConfidence;
    const reason = parsed.reason || visualReason;

    res.json({ confirmed, reason });
  } catch (err) {
    console.error("❌ /groq/confirm hybrid error:", err.message);
    res.status(500).json({ error: "Hybrid blueprint confirmation failed." });
  }
});

// ====================================================
// 🔹 POST /groq/questions → Sequential design Q&A
// ====================================================
router.post("/questions", async (req, res) => {
  try {
    const { step = 0, prevAnswers = {} } = req.body;

    const questions = [
      "What interior style do you prefer? (Modern, Classic, Gen-Z, Minimal, Rustic)",
      "What is your approximate budget range? (<$5k, $5k–$10k, $10k–$20k, >$20k)",
      "What is the room’s main function and desired lighting preference? (Cozy, bright, warm, natural)",
    ];

    if (step >= questions.length) {
      // ✅ Save all answers locally for later reasoning (e.g. ShoppingAgent)
      try {
        const answerPath = path.join(process.cwd(), "answers/answer.json");
        const answers = [
          prevAnswers[0] || "Modern",
          prevAnswers[1] || "$5k–$10k",
          prevAnswers[2] || "Natural",
        ];

        fs.writeFileSync(
          answerPath,
          JSON.stringify(
            {
              style: answers[0],
              budget: answers[1],
              lighting: answers[2],
              timestamp: new Date().toISOString(),
            },
            null,
            2
          )
        );
        console.log(`💾 Preferences saved to ${answerPath}`);
      } catch (err) {
        console.error("❌ Failed to save answers:", err.message);
      }

      return res.json({ done: true, message: "All questions completed." });
    }

    const messages = [
      {
        role: "system",
        content: "You are a concise and friendly design assistant. Ask one clear question at a time.",
      },
      {
        role: "user",
        content: `Previous answers: ${JSON.stringify(prevAnswers)}
Now ask the next question only: ${questions[step]}`,
      },
    ];

    const data = await callGroq(messages, "questions");
    const response = data?.choices?.[0]?.message?.content?.trim() || questions[step];

    res.json({ question: response, step, done: false });
  } catch (err) {
    console.error("❌ /groq/questions error:", err.message);
    res.status(500).json({ error: "Question generation failed." });
  }
});
// ====================================================
// 🔹 POST /groq/analyze → Caption, Reasoning, Suggestions
// ====================================================
router.post("/analyze", async (req, res) => {
  try {
    // ✅ Graceful fallback for image_url and intake
    let { image_url, intake } = req.body || {};
    if (!image_url) {
      image_url = "http://127.0.0.1:5050/agents/outputs/latest_detected_blueprint.jpg";
      console.warn("⚠️ Missing image_url — using latest_detected_blueprint.jpg as fallback");
    }
    if (!intake) {
      intake = { style: "Modern", budget: "$5k–$10k", lighting: "Natural" };
    }

    const messages = [
      {
        role: "system",
        content: `You are a senior interior designer AI. Return only valid JSON with fields: caption, reasoning, suggestion.`,
      },
      {
        role: "user",
        content: `Blueprint: ${image_url}
User Preferences: ${JSON.stringify(intake, null, 2)}

Output example:
{
  "caption": "short summary",
  "reasoning": "explanation of layout and logic",
  "suggestion": "3 actionable improvement ideas"
}`,
      },
    ];

    // === Primary LLM Call ===
    const data = await callGroq(messages, "analyze");
    let raw = data?.choices?.[0]?.message?.content?.trim() || "{}";
    raw = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn("⚠️ JSON parse failed, using fallback:", err.message);
      parsed = {
        caption: "Unable to parse caption.",
        reasoning: "Raw model output: " + raw,
        suggestion: "No structured suggestions found.",
      };
    }

    // === Auto-Generate Suggestions if Missing or Too Short ===
    if (!parsed.suggestion || parsed.suggestion.length < 10) {
      try {
        const suggestionPrompt = [
          {
            role: "system",
            content: "You are a senior designer. Create actionable, aesthetic improvement tips.",
          },
          {
            role: "user",
            content: `Blueprint context:\n${image_url}\n\nReasoning:\n${parsed.reasoning}\nGenerate 3 concise design improvement suggestions.`,
          },
        ];

        const suggestionData = await callGroq(suggestionPrompt, "questions");
        const suggestionText = suggestionData?.choices?.[0]?.message?.content?.trim();
        if (suggestionText && suggestionText.length > 10) {
          parsed.suggestion = suggestionText.replace(/```json|```/g, "").trim();
        } else {
          parsed.suggestion = "No structured suggestions found.";
        }
      } catch (e) {
        console.error("⚠️ Suggestion fallback failed:", e.message);
        parsed.suggestion = "No structured suggestions found.";
      }
    }

    // === Ensure all fields exist (frontend safety) ===
    parsed.caption = parsed.caption || "No caption generated.";
    parsed.reasoning = parsed.reasoning || "No reasoning generated.";
    parsed.suggestion = parsed.suggestion || "No suggestions generated.";

    // ✅ Response
    res.json(parsed);

  } catch (err) {
    console.error("❌ /groq/analyze error:", err.message);
    res.status(500).json({
      caption: "Analysis unavailable.",
      reasoning: "Error during AI reasoning.",
      suggestion: "Please retry or upload a valid blueprint.",
    });
  }
});


// ====================================================
// 🔹 POST /groq/run → Math + Depth + Detection Reasoning
// ====================================================
router.post("/run", async (req, res) => {
  try {
    const { upload_id, objects = [], scale_ratio_m = 1, depth_hint = [] } = req.body;

    console.log("🚀 Groq reasoning triggered");
    console.log("📦 Payload:", {
      upload_id,
      objects_count: objects.length,
      has_depth_hint: Array.isArray(depth_hint) && depth_hint.length > 0,
    });

    // 🔮 Placeholder reasoning logic
    const result = [
      {
        label: "Wall",
        position: { x: 0, y: 0, z: 0 },
        size: { width: 8 * scale_ratio_m, height: 3 * scale_ratio_m, depth: 0.2 },
      },
      {
        label: "Door",
        position: { x: 2 * scale_ratio_m, y: 0, z: 1 },
        size: { width: 1 * scale_ratio_m, height: 2 * scale_ratio_m, depth: 0.1 },
      },
      {
        label: "Window",
        position: { x: -3 * scale_ratio_m, y: 0, z: 1.5 },
        size: { width: 2 * scale_ratio_m, height: 1 * scale_ratio_m, depth: 0.05 },
      },
    ];

    res.json({
      message: "✅ Groq reasoning successful",
      upload_id,
      result,
    });

    console.log(`✅ Groq reasoning complete for upload_id=${upload_id}`);
  } catch (err) {
    console.error("❌ Groq reasoning error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ====================================================
// 🔹 GET /groq/status → Health check
// ====================================================
router.get("/status", (req, res) => {
  res.json({
    status: "🟢 Groq reasoning route active",
    apiKeyLoaded: !!process.env.GROQ_API_KEY,
  });
});


const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Load furniture CSV into memory
const furnitureData = [];
const csvPath = path.join(process.cwd(), "../data/furniture_dataset.csv");

fs.createReadStream(csvPath)
  .pipe(csv())
  .on("data", (row) => furnitureData.push(row))
  .on("end", () => console.log("✅ Furniture dataset loaded"));



// 🧠 Shopping reasoning route
// ====================================================
// 🔹 GET /groq/shopping → CSV + AI-Synthesized Recommendations
// ====================================================
// =======================
// 🧠 Room-Aware Shopping
// =======================
router.get("/shopping", async (req, res) => {
  try {
    const csvPath = path.join(process.cwd(), "../data/furniture_dataset.csv");
    const detectionsPath = path.join(
      process.cwd(),
      "agents/outputs/1762237581461-test_detections_blueprint.json"
    );

    // Load CSV
    let furniture = [];
    if (fs.existsSync(csvPath)) {
      const raw = fs.readFileSync(csvPath, "utf-8").split("\n").slice(1);
      for (const line of raw) {
        const cols = line.split(",").map((c) => c.trim());
        if (cols.length < 10) continue;
        const [type, style, color, material, shape, details, room_type, price_range] = cols;
        furniture.push({ type, style, room_type, price_range });
      }
    }

    // Load detected blueprint objects (like Door6, Window14…)
    let objectSummary = {};
    if (fs.existsSync(detectionsPath)) {
      const detectionData = JSON.parse(fs.readFileSync(detectionsPath, "utf-8"));
      detectionData.objects.forEach((o) => {
        objectSummary[o.label] = (objectSummary[o.label] || 0) + 1;
      });
    }

    // Group recommendations per room type
    const grouped = {};
    for (const room of ["living", "kitchen", "dining", "bedroom", "office", "kids"]) {
      grouped[room] = furniture
        .filter((f) => f.room_type.toLowerCase().includes(room))
        .slice(0, 3)
        .map((f) => ({
          name: `${f.style} ${f.type}`,
          price: f.price_range || "Standard",
          category: room.charAt(0).toUpperCase() + room.slice(1),
        }));
    }

    // Add summary info
    res.json({
      summary: objectSummary,
      rooms: grouped,
    });
  } catch (err) {
    console.error("❌ Room-aware shopping failed:", err.message);
    res.status(500).json({ error: "Failed to load CSV or detection data." });
  }
});

router.post("/save-answers", async (req, res) => {
  try {
    const { style, budget, lighting } = req.body;
    if (!style || !budget || !lighting) {
      return res.status(400).json({ error: "Missing one or more required fields." });
    }

    const answerPath = path.join(process.cwd(), "answers/answer.json");

    const data = {
      style,
      budget,
      lighting,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(answerPath, JSON.stringify(data, null, 2));
    console.log(`💾 Preferences saved successfully → ${answerPath}`);

    res.json({ message: "✅ Preferences saved successfully.", data });
  } catch (err) {
    console.error("❌ Error saving answers:", err.message);
    res.status(500).json({ error: "Failed to save user answers." });
  }
});

export default router;
