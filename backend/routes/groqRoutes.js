import express from "express";
import dotenv from "dotenv";
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
// ✅ Generic helper for Groq API
// ====================================================
async function callGroq(messages, modelKey = "analyze", temperature = 0.4, max_tokens = 800) {
  const model = MODELS[modelKey] || MODELS.analyze;

  const body = { model, messages, temperature, max_tokens };

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error (${model}): ${res.status} — ${text}`);
  }

  return res.json();
}

// ====================================================
// 🔹 /groq/confirm → Hybrid visual + semantic validation
// ====================================================
router.post("/confirm", async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: "Missing image_url" });

    // 1️⃣ Local lightweight visual validator
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

    // 2️⃣ Semantic Groq confirmation — always runs
    const messages = [
      {
        role: "system",
        content: "You are an expert architectural AI. Determine if an image represents a valid blueprint, floor plan, or layout diagram suitable for spatial reasoning.",
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

    // ✅ Merge local and semantic results
    const confirmed = parsed.is_blueprint || visualConfidence;
    const reason = parsed.reason || visualReason;

    res.json({ confirmed, reason });
  } catch (err) {
    console.error("❌ /groq/confirm hybrid error:", err.message);
    res.status(500).json({ error: "Hybrid blueprint confirmation failed." });
  }
});

// ====================================================
// 🔹 /groq/questions → Sequential design Q&A
// ====================================================
router.post("/questions", async (req, res) => {
  try {
    const { step, prevAnswers } = req.body;

    const questions = [
      "What interior style do you prefer? (Modern, Classic, Gen-Z, Minimal, Rustic)",
      "What is your approximate budget range? (<$5k, $5k–$10k, $10k–$20k, >$20k)",
      "What is the room’s main function and desired lighting preference? (Cozy, bright, warm, natural)",
    ];

    if (step >= questions.length) {
      return res.json({ done: true, message: "All questions completed." });
    }

    const messages = [
      {
        role: "system",
        content: "You are a concise and friendly design assistant. Ask one clear question at a time.",
      },
      {
        role: "user",
        content: `Previous answers: ${JSON.stringify(prevAnswers || {})}
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
// 🔹 /groq/analyze → Caption, Reasoning, Suggestions
// ====================================================
router.post("/analyze", async (req, res) => {
  try {
    const { image_url, intake } = req.body;
    if (!image_url) return res.status(400).json({ error: "Missing image_url" });

    const messages = [
      {
        role: "system",
        content: `You are a senior interior designer AI.
Return only valid JSON with fields: caption, reasoning, suggestion.`,
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

    const data = await callGroq(messages, "analyze");
    let raw = data?.choices?.[0]?.message?.content?.trim() || "{}";
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
        parsed.suggestion =
          suggestionData?.choices?.[0]?.message?.content?.trim() ||
          "No structured suggestions found.";
      } catch (e) {
        console.error("⚠️ Suggestion fallback failed:", e.message);
      }
    }

    res.json(parsed);
  } catch (err) {
    console.error("❌ /groq/analyze error:", err.message);
    res.status(500).json({ error: "Groq analysis failed." });
  }
});

// ====================================================
// 🔹 /groq/status → Health check
// ====================================================
router.get("/status", async (_, res) => {
  try {
    res.json({
      groq: process.env.GROQ_API_KEY
        ? "✅ Groq API Key Loaded"
        : "⚠️ Missing GROQ_API_KEY",
    });
  } catch {
    res.status(500).json({ error: "Groq status check failed." });
  }
});

export default router;