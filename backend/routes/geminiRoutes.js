// // ====================================================
// // 🧠 Gemini Routes — Clean Version
// // Author: Krushna Thakkar
// // ====================================================

// import express from "express";
// import dotenv from "dotenv";
// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";

// dotenv.config();

// const router = express.Router();
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // ====================================================
// // ✅ Constants & Directories
// // ====================================================

// const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
// const MODELS = {
//   confirm: "gemini-2.5-flash",
//   questions: "gemini-2.5-flash",
//   analyze: "gemini-2.5-flash",
// };

// const answersDir = path.join(__dirname, "..", "answers");
// if (!fs.existsSync(answersDir)) fs.mkdirSync(answersDir, { recursive: true });

// // ====================================================
// // 🔁 Helper: Exponential Retry Wrapper
// // ====================================================
// async function withRetry(fn, retries = 3, delay = 3000) {
//   for (let attempt = 0; attempt < retries; attempt++) {
//     try {
//       return await fn();
//     } catch (err) {
//       if (err.message.includes("429") && attempt < retries - 1) {
//         const wait = delay * (attempt + 1);
//         console.warn(`⚠️ Gemini rate limit hit. Retrying in ${wait / 1000}s...`);
//         await new Promise((res) => setTimeout(res, wait));
//       } else {
//         throw err;
//       }
//     }
//   }
// }

// // ====================================================
// // ⚙️ Generic Gemini Text API
// // ====================================================
// async function callGemini(prompt, modelKey = "analyze", temperature = 0.4, maxTokens = 800) {
//   const model = MODELS[modelKey] || MODELS.analyze;
//   const apiKey = process.env.GEMINI_API_KEY;

//   const body = {
//     contents: [{ parts: [{ text: prompt }] }],
//     generationConfig: {
//       temperature,
//       maxOutputTokens: maxTokens,
//       topP: 0.95,
//       topK: 40,
//     },
//   };

//   return withRetry(async () => {
//     const res = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(body),
//     });

//     if (!res.ok) throw new Error(`Gemini API error (${model}): ${res.status} — ${await res.text()}`);
//     return res.json();
//   });
// }

// // ====================================================
// // 🖼️ Gemini Vision API — Image-based Analysis
// // ====================================================
// async function callGeminiVision(prompt, imageUrl, modelKey = "analyze") {
//   const model = MODELS[modelKey] || MODELS.analyze;
//   const apiKey = process.env.GEMINI_API_KEY;

//   const imageResponse = await fetch(imageUrl);
//   const buffer = await imageResponse.arrayBuffer();
//   const base64Image = Buffer.from(buffer).toString("base64");
//   const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

//   const body = {
//     contents: [
//       {
//         parts: [
//           { text: prompt },
//           { inline_data: { mime_type: mimeType, data: base64Image } },
//         ],
//       },
//     ],
//     generationConfig: {
//       temperature: 0.4,
//       maxOutputTokens: 800,
//       topP: 0.95,
//       topK: 40,
//     },
//   };

//   return withRetry(async () => {
//     const res = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(body),
//     });

//     if (!res.ok)
//       throw new Error(`Gemini Vision API error (${model}): ${res.status} — ${await res.text()}`);
//     return res.json();
//   });
// }

// // ====================================================
// // 🔹 /gemini/confirm — Hybrid Validation
// // ====================================================
// router.post("/confirm", async (req, res) => {
//   try {
//     const { image_url } = req.body;
//     if (!image_url) return res.status(400).json({ error: "Missing image_url" });

//     // Step 1: Local edge-based visual validator
//     let visualConfidence = false;
//     let visualReason = "Local validator unavailable.";
//     try {
//       const visual = await fetch("http://127.0.0.1:5050/validate-blueprint", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ image_url }),
//       });
//       const result = await visual.json();
//       visualConfidence = result?.is_blueprint || false;
//       visualReason = result?.reason || "No reason provided.";
//       console.log(
//         `🧠 Local visual check → ${visualConfidence ? "✅ Blueprint" : "⚠️ Non-Blueprint"} (${visualReason})`
//       );
//     } catch {
//       console.warn("⚠️ Local validator unreachable, skipping.");
//     }

//     // Step 2: Semantic Gemini validation
//     const prompt = `
// You are an expert architectural AI. Determine if this image represents a valid blueprint, floor plan, or layout diagram.

// Local detection result: ${visualConfidence}

// Respond strictly in JSON format:
// {
//   "is_blueprint": true or false,
//   "reason": "short explanation"
// }`;

//     const data = await callGeminiVision(prompt, image_url, "confirm");
//     let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";
//     raw = raw.replace(/```json|```/g, "").trim();

//     let parsed;
//     try {
//       parsed = JSON.parse(raw);
//     } catch {
//       parsed = { is_blueprint: true, reason: "Fallback: visually confirmed layout." };
//     }

//     const confirmed = parsed.is_blueprint || visualConfidence;
//     const reason = parsed.reason || visualReason;

//     res.json({ confirmed, reason });
//   } catch (err) {
//     console.error("❌ /gemini/confirm hybrid error:", err.message);
//     res.status(500).json({ error: "Hybrid blueprint confirmation failed." });
//   }
// });

// // ====================================================
// // 🔹 /gemini/questions — Step-by-Step Design Q&A
// // ====================================================
// router.post("/questions", async (req, res) => {
//   try {
//     const { step, prevAnswers } = req.body;
//     const questions = [
//       "What interior style do you prefer? (Modern, Classic, Gen-Z, Minimal, Rustic)",
//       "What is your approximate budget range? (<$5k, $5k–$10k, $10k–$20k, >$20k)",
//       "What is the room's main function and lighting preference? (Cozy, bright, warm, natural)",
//     ];

//     if (step >= questions.length)
//       return res.json({ done: true, message: "All questions completed." });

//     const prompt = `
// You are a concise, friendly design assistant.
// Previous answers: ${JSON.stringify(prevAnswers || {})}

// Now ask only the next question conversationally:
// ${questions[step]}`;

//     const data = await callGemini(prompt, "questions");
//     const question =
//       data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || questions[step];

//     res.json({ question, step, done: false });
//   } catch (err) {
//     console.error("❌ /gemini/questions error:", err.message);
//     res.status(500).json({ error: "Question generation failed." });
//   }
// });

// // ====================================================
// // 🔹 /gemini/analyze — Blueprint Caption + Suggestions
// // ====================================================
// router.post("/analyze", async (req, res) => {
//   try {
//     const { image_url, intake } = req.body;
//     if (!image_url) return res.status(400).json({ error: "Missing image_url" });

//     const prompt = `
// You are a senior interior designer AI analyzing a blueprint or floor plan.

// User Preferences: ${JSON.stringify(intake, null, 2)}

// Analyze and return JSON:
// {
//   "caption": "short summary",
//   "reasoning": "layout and design explanation",
//   "suggestion": "3 actionable improvement ideas"
// }`;

//     const data = await callGeminiVision(prompt, image_url, "analyze");
//     let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";
//     raw = raw.replace(/```json|```/g, "").trim();

//     let parsed;
//     try {
//       parsed = JSON.parse(raw);
//     } catch {
//       parsed = {
//         caption: "Unable to parse caption.",
//         reasoning: "Raw output: " + raw,
//         suggestion: "No structured suggestions found.",
//       };
//     }

//     // Generate fallback suggestions if missing
//     if (!parsed.suggestion || parsed.suggestion.length < 10) {
//       const suggestionPrompt = `
// You are a senior designer. Based on this reasoning:
// ${parsed.reasoning}

// Generate 3 concise actionable design improvement ideas.`;

//       try {
//         const suggestionData = await callGemini(suggestionPrompt, "questions");
//         parsed.suggestion =
//           suggestionData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
//           "No structured suggestions found.";
//       } catch (e) {
//         console.error("⚠️ Suggestion fallback failed:", e.message);
//       }
//     }

//     res.json(parsed);
//   } catch (err) {
//     console.error("❌ /gemini/analyze error:", err.message);
//     res.status(500).json({ error: "Gemini analysis failed." });
//   }
// });

// // ====================================================
// // 🔹 /gemini/status — Health Check
// // ====================================================
// router.get("/status", (_, res) => {
//   const loaded = !!process.env.GEMINI_API_KEY;
//   res.json({
//     gemini: loaded ? "✅ Gemini API Key Loaded" : "⚠️ Missing GEMINI_API_KEY",
//   });
// });

// export default router;
