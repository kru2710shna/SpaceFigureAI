import express from "express";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// ====================================================
// ✅ Constants
// ====================================================
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODELS = {
  confirm: "gemini-2.5-flash",
  questions: "gemini-2.5-flash",
  analyze: "gemini-2.5-flash",
};

// ====================================================
// ✅ Generic helper for Gemini API
// ====================================================
async function callGemini(prompt, modelKey = "analyze", temperature = 0.4, maxTokens = 800) {
  const model = MODELS[modelKey] || MODELS.analyze;
  const apiKey = process.env.GEMINI_API_KEY;

  const body = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      topP: 0.95,
      topK: 40,
    }
  };

  const res = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error (${model}): ${res.status} — ${text}`);
  }

  return res.json();
}

// ====================================================
// ✅ Helper for Gemini Vision API (with image)
// ====================================================
async function callGeminiVision(prompt, imageUrl, modelKey = "analyze") {
  const model = MODELS[modelKey] || MODELS.analyze;
  const apiKey = process.env.GEMINI_API_KEY;

  // Fetch image and convert to base64
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = Buffer.from(imageBuffer).toString('base64');
  
  // Determine MIME type
  const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Image
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 800,
      topP: 0.95,
      topK: 40,
    }
  };

  const res = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini Vision API error (${model}): ${res.status} — ${text}`);
  }

  return res.json();
}

// ====================================================
// 🔹 /gemini/confirm → Hybrid visual + semantic validation
// ====================================================
router.post("/confirm", async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "Missing image_url" });

    // 1️⃣ Local lightweight visual validator (optional)
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
      console.log(`🧠 Local visual check → ${visualConfidence ? "✅ Blueprint" : "⚠️ Possibly Non-Blueprint"} (${visualReason})`);
    } catch (e) {
      console.warn("⚠️ Local validator not running, skipping visual check.");
    }

    // 2️⃣ Semantic Gemini confirmation with vision — always runs
    const prompt = `You are an expert architectural AI. Determine if this image represents a valid blueprint, floor plan, or layout diagram suitable for spatial reasoning.

Local detection result: ${visualConfidence}

Analyze this image and respond strictly in JSON format:
{
  "is_blueprint": true or false,
  "reason": "short explanation"
}`;

    const data = await callGeminiVision(prompt, image_url, "confirm");
    let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";
    raw = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { is_blueprint: true, reason: "Fallback: visually confirmed layout." };
    }

    // ✅ Merge local and semantic results
    const confirmed = parsed.is_blueprint || visualConfidence;
    const reason = parsed.reason || visualReason;

    res.json({ confirmed, reason });
  } catch (err) {
    console.error("❌ /gemini/confirm hybrid error:", err.message);
    res.status(500).json({ error: "Hybrid blueprint confirmation failed." });
  }
});

// ====================================================
// 🔹 /gemini/questions → Sequential design Q&A
// ====================================================
router.post("/questions", async (req, res) => {
  try {
    const { step, prevAnswers } = req.body;

    const questions = [
      "What interior style do you prefer? (Modern, Classic, Gen-Z, Minimal, Rustic)",
      "What is your approximate budget range? (<$5k, $5k–$10k, $10k–$20k, >$20k)",
      "What is the room's main function and desired lighting preference? (Cozy, bright, warm, natural)",
    ];

    if (step >= questions.length) {
      return res.json({ done: true, message: "All questions completed." });
    }

    const prompt = `You are a concise and friendly design assistant. Ask one clear question at a time.

Previous answers: ${JSON.stringify(prevAnswers || {})}

Now ask the next question only: ${questions[step]}

Provide a friendly, conversational version of this question.`;

    const data = await callGemini(prompt, "questions");
    const response = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || questions[step];

    res.json({ question: response, step, done: false });
  } catch (err) {
    console.error("❌ /gemini/questions error:", err.message);
    res.status(500).json({ error: "Question generation failed." });
  }
});

// ====================================================
// 🔹 /gemini/analyze → Caption, Reasoning, Suggestions
// ====================================================
router.post("/analyze", async (req, res) => {
  try {
    const { image_url, intake } = req.body;
    if (!image_url) return res.status(400).json({ error: "Missing image_url" });

    const prompt = `You are a senior interior designer AI analyzing a blueprint or floor plan.

User Preferences: ${JSON.stringify(intake, null, 2)}

Analyze the blueprint image and provide:
1. A short summary caption
2. Detailed reasoning about the layout and design logic
3. Three actionable improvement ideas

Return only valid JSON with these exact fields:
{
  "caption": "short summary",
  "reasoning": "explanation of layout and logic",
  "suggestion": "3 actionable improvement ideas"
}`;

    const data = await callGeminiVision(prompt, image_url, "analyze");
    let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";
    raw = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        caption: "Unable to parse caption.",
        reasoning: "Raw model output: " + raw,
        suggestion: "No structured suggestions found.",
      };
    }

    // 💡 Auto-generate suggestions if missing
    if (!parsed.suggestion || parsed.suggestion.length < 10) {
      try {
        const suggestionPrompt = `You are a senior designer. Based on the blueprint analysis:

Reasoning: ${parsed.reasoning}

Generate 3 concise, actionable design improvement suggestions for this space.`;
        
        const suggestionData = await callGemini(suggestionPrompt, "questions");
        parsed.suggestion =
          suggestionData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
          "No structured suggestions found.";
      } catch (e) {
        console.error("⚠️ Suggestion fallback failed:", e.message);
      }
    }

    res.json(parsed);
  } catch (err) {
    console.error("❌ /gemini/analyze error:", err.message);
    res.status(500).json({ error: "Gemini analysis failed." });
  }
});

// ====================================================
// 🔹 /gemini/status → Health check
// ====================================================
router.get("/status", async (_, res) => {
  try {
    res.json({
      gemini: process.env.GEMINI_API_KEY
        ? "✅ Gemini API Key Loaded"
        : "⚠️ Missing GEMINI_API_KEY",
    });
  } catch {
    res.status(500).json({ error: "Gemini status check failed." });
  }
});

export default router;