// backend/agents/groq_reasoner.js
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const API_KEY = process.env.GROQ_API_KEY;

/**
 * Normalize depth map into elevation values (0–3 m typical room height).
 */
function normalizeDepth(depthArray) {
  if (!Array.isArray(depthArray) || depthArray.length === 0) return [];
  const flat = depthArray.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const norm = depthArray.map(row =>
    row.map(v => ((v - min) / (max - min)) * 3.0) // scale to meters
  );
  return norm;
}

/**
 * Produce Groq-based 3D reasoning with LiDAR-style elevation integration.
 */
export async function generateSceneWithGroq(objects, scale_ratio_m, depth_hint = null) {
  try {
    const normalizedDepth = normalizeDepth(depth_hint);
    const depthSummary = normalizedDepth.length
      ? {
          rows: normalizedDepth.length,
          cols: normalizedDepth[0].length,
          avg: (
            normalizedDepth.flat().reduce((a, b) => a + b, 0) /
            normalizedDepth.flat().length
          ).toFixed(2),
        }
      : null;

    const prompt = `
You are a 3D spatial reasoning engine.  
Fuse object geometry with LiDAR-style elevation hints to reconstruct a metrically accurate scene.

Use these inputs:
- objects[]: list of blueprint detections with approximate pixel coordinates.
- scale_ratio_m: conversion from pixels to meters.
- depth_hint: normalized elevation array, each entry ≈ height in meters.

Rules:
1. Align objects' y-position (height) with corresponding depth_hint pixel region mean.
2. Ensure walls rest on the floor (y ≈ 0), columns/stairs follow elevation gradient.
3. Use scale_ratio_m for converting blueprint pixel width/height into real meters.
4. Return ONLY a valid JSON array (no markdown, no prose):

[
  {
    "label": "Wall" | "Door" | "Window" | "Column" | "Stair Case",
    "position": {"x": <float>, "y": <float>, "z": <float>},
    "size": {"width": <float>, "height": <float>, "depth": <float>},
    "elevation_source": "depth_hint" | "default"
  }
]
`;

    const body = {
      model: "llama-3.3-70b-versatile",
      temperature: 0.25,
      max_tokens: 1200,
      messages: [
        { role: "system", content: "You output only strict JSON arrays." },
        {
          role: "user",
          content: `${prompt}\n\nInput:\n${JSON.stringify(
            { objects, scale_ratio_m, depthSummary },
            null,
            2
          )}`,
        },
      ],
    };

    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    if (!raw) throw new Error("Empty Groq response.");

    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("No JSON array found.");
    const parsed = JSON.parse(clean.slice(start, end + 1));

    console.log(`✅ Groq 3D reasoning produced ${parsed.length} objects.`);
    return parsed;
  } catch (err) {
    console.error("❌ Groq Reasoning Error:", err.message);
    return [];
  }
}
