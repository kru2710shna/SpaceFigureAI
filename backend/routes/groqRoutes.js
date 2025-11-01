import express from "express";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// ✅ Constants
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELS = {
    confirm: "llama-3.1-8b-instant",
    questions: "llama-3.1-8b-instant",
    analyze: "llama-3.3-70b-versatile",
};

/**
 * ✅ Generic helper to call Groq API with dynamic model
 */
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

/**
 * 🔹 /groq/confirm
 * Confirms whether uploaded image is a valid blueprint
 */
router.post("/confirm", async (req, res) => {
    try {
        const { image_url } = req.body;
        if (!image_url)
            return res.status(400).json({ error: "Missing image_url" });

        // 1️⃣ Local visual validation
        const visual = await fetch("http://127.0.0.1:5050/validate-blueprint", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_url }),
        });
        const visualResult = await visual.json();

        if (!visualResult.is_blueprint) {
            return res.json({
                confirmed: false,
                reason: visualResult.reason,
            });
        }

        // 2️⃣ Groq semantic reasoning
        const messages = [
            {
                role: "system",
                content:
                    "You are an architectural vision model confirming blueprint images.",
            },
            {
                role: "user",
                content: `Visually, this image shows walls and structure. Please confirm if this can be used for room layout analysis. Return JSON:
{
  "is_blueprint": true or false,
  "reason": "short summary"
}`,
            },
        ];

        const data = await callGroq(messages, "confirm");
        const raw = data?.choices?.[0]?.message?.content?.trim() || "{}";

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            parsed = { is_blueprint: true, reason: "Visual confirmation only." };
        }

        res.json({
            confirmed: parsed.is_blueprint,
            reason: parsed.reason,
        });
    } catch (err) {
        console.error("❌ /groq/confirm hybrid error:", err.message);
        res.status(500).json({ error: "Hybrid blueprint confirmation failed." });
    }
});

/**
 * 🔹 /groq/questions
 * Asks style, budget, and lighting questions sequentially
 */
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
                content:
                    "You are a concise design assistant that asks one clear question at a time.",
            },
            {
                role: "user",
                content: `Previous answers: ${JSON.stringify(
                    prevAnswers || {}
                )}\nAsk the next question only: ${questions[step]}`,
            },
        ];

        const data = await callGroq(messages, "questions");
        const response =
            data?.choices?.[0]?.message?.content?.trim() || questions[step];

        res.json({ question: response, step, done: false });
    } catch (err) {
        console.error("❌ /groq/questions error:", err.message);
        res.status(500).json({ error: "Question generation failed." });
    }
});

/**
 * 🔹 /groq/analyze
 * Produces final caption, reasoning, and suggestions
 */
router.post("/analyze", async (req, res) => {
    try {
        const { image_url, intake } = req.body;
        if (!image_url)
            return res.status(400).json({ error: "Missing image_url" });

        const messages = [
            {
                role: "system",
                content: `You are a senior interior designer AI.
Return analysis ONLY as JSON with fields: caption, reasoning, suggestion.`,
            },
            {
                role: "user",
                content: `Blueprint: ${image_url}
User Preferences: ${JSON.stringify(intake, null, 2)}

Output format example:
{
  "caption": "short visual summary",
  "reasoning": "explanation of layout and design logic",
  "suggestion": "actionable improvement ideas"
}`,
            },
        ];

        const data = await callGroq(messages, "analyze");
        const raw = data?.choices?.[0]?.message?.content?.trim() || "{}";

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

        res.json(parsed);
    } catch (err) {
        console.error("❌ /groq/analyze error:", err.message);
        res.status(500).json({ error: "Groq analysis failed." });
    }
});

/**
 * 🔹 /groq/status
 * Quick health check
 */
router.get("/status", async (req, res) => {
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
