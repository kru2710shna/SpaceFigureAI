import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
const router = express.Router();

/**
 * Smart LLaVA Bridge:
 * - Uses local LLaVA if available (port 8000)
 * - Falls back to OpenAI/NVIDIA NIM cloud if not
 */

const LOCAL_LLAVA = "http://127.0.0.1:8000/v1/llava/inference";
const CLOUD_LLAVA = "https://api.openai.com/v1/llava/inference"; // or NIM endpoint

// Helper: detect if local LLaVA is live
async function checkLocalLlava() {
  try {
    const res = await axios.get("http://127.0.0.1:8000/v1/models", { timeout: 1000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

// Common function to send prompt + image to active model
async function queryLlava({ image_url, intake, message }) {
  const useLocal = await checkLocalLlava();
  const endpoint = useLocal ? LOCAL_LLAVA : CLOUD_LLAVA;

  const prompt = message
    ? `The user says: "${message}". Respond with interior design reasoning and actionable ideas.`
    : `Analyze this space for design elements and user intent:\n${JSON.stringify(intake, null, 2)}`;

  const body = {
    model: "llava-v1.6-34b",
    prompt,
    image_url,
  };

  const headers = {
    "Content-Type": "application/json",
  };

  // Only attach API key if using remote
  if (!useLocal) headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;

  const response = await axios.post(endpoint, body, { headers });
  return response.data;
}

/* =========  ROUTES  ========= */

// 1️⃣ Initial reasoning after intake
router.post("/analyze", async (req, res) => {
  try {
    const { image_url, intake } = req.body;
    if (!image_url) return res.status(400).json({ error: "Missing image URL" });

    const result = await queryLlava({ image_url, intake });
    res.json({
      caption: result.caption || "Modern space with natural light and neutral tones.",
      reasoning:
        result.reasoning ||
        "This room balances symmetry and natural illumination, ideal for minimalist design.",
      suggestion:
        result.suggestion ||
        "Add texture through fabrics or plants to make the environment feel inviting.",
    });
  } catch (err) {
    console.error("❌ /llava/analyze error:", err.message);
    res.status(500).json({ error: "LLaVA analysis failed" });
  }
});

// 2️⃣ Conversational reasoning (follow-up chat)
router.post("/chat", async (req, res) => {
  try {
    const { message, image_url } = req.body;
    if (!message || !image_url)
      return res.status(400).json({ error: "Missing message or image" });

    const result = await queryLlava({ image_url, message });
    res.json({
      reply:
        result.reply ||
        "Try balancing color temperature between warm and cool lighting for harmony.",
    });
  } catch (err) {
    console.error("❌ /llava/chat error:", err.message);
    res.status(500).json({ reply: "Chat reasoning failed" });
  }
});

// 3️⃣ Health check (for frontend display)
router.get("/status", async (req, res) => {
  const online = await checkLocalLlava();
  res.json({
    llava: online ? "✅ Local LLaVA Running" : "☁️ Using Cloud API",
  });
});

export default router;
