// backend/agents/groq_reasoner.js
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.warn("⚠️ GROQ_API_KEY missing from environment!");
}

/**
 * Generate a corrected 3D structure layout using Groq reasoning.
 * @param {Object[]} objects - Detected objects from Math Agent
 * @param {number} scale_ratio_m - Pixel-to-meter ratio
 * @returns {Promise<Object[]>} Corrected scene geometry
 */
export async function generateSceneWithGroq(objects, scale_ratio_m) {
  try {
    // 🧠 Prompt — geometric reasoning with enforced JSON output
    const prompt = `
You are an AI 3D reasoning assistant.
Given object detections with pixel and metric dimensions, infer a consistent 3D layout.

Rules:
1. Keep walls parallel and enclosing the room.
2. Doors align within wall planes; their top = 70% of average wall height.
3. Windows are centered horizontally and 1.2 meters above floor.
4. Columns are equally spaced if multiple exist.
5. All Y positions >= 0, and room floor is y = 0.

Return JSON only. Do NOT include code blocks, markdown, or explanations.
Format strictly as:
[
  {
    "label": "Wall",
    "position": {"x": ..., "y": ..., "z": ...},
    "size": {"width": ..., "height": ..., "depth": ...}
  }
]
`;

    // 🛰️ Groq API call
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a precise 3D geometry reasoning assistant. Only return valid JSON arrays.",
          },
          {
            role: "user",
            content:
              prompt +
              `\n\nInput Data:\n` +
              JSON.stringify({ objects, scale_ratio_m }, null, 2),
          },
        ],
      }),
    });

    const data = await res.json();
    console.log("🔍 Raw Groq response:", JSON.stringify(data, null, 2));

    // 🧾 Check for content
    let reply = data?.choices?.[0]?.message?.content;
    if (!reply) throw new Error("Empty response from Groq");

    // 🧹 Strip code fences / Python artifacts
    reply = reply.replace(/```python/g, "").replace(/```/g, "").trim();

    // 🔍 Extract JSON block safely
    const jsonStart = reply.indexOf("[");
    const jsonEnd = reply.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) {
      console.warn("⚠️ No JSON array found in Groq reply. Dumping text to debug:");
      console.warn(reply.slice(0, 400));
      throw new Error("Groq did not return valid JSON format");
    }

    const jsonStr = reply.slice(jsonStart, jsonEnd + 1);

    // ✅ Parse JSON safely
    let correctedObjects;
    try {
      correctedObjects = JSON.parse(jsonStr);
    } catch (e) {
      console.error("❌ JSON parsing failed, reply snippet:", reply.slice(0, 400));
      throw e;
    }

    console.log("✅ Groq Reasoned Scene Generated:", correctedObjects.length, "objects");
    return correctedObjects;
  } catch (err) {
    console.error("❌ Groq reasoning failed:", err);
    return [];
  }
}
