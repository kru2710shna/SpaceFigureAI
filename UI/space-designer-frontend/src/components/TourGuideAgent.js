import React, { useState } from "react";
import "../styles/TourGuideAgent.css";
import bgVideo from "../assets/BG_Arch.mp4";

const TourGuideAgent = () => {
  const [status, setStatus] = useState("Initializing Tour Guide Agent...");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleStart = async () => {
    try {
      setError("");
      setLoading(true);
      setStatus("Running Room Inspection...");

      const res = await fetch("http://localhost:5050/tour-guide/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: "" }),
      });

      if (!res.ok) throw new Error("Backend connection failed");

      const data = await res.json();

      // 🔧 Fix: Handle both direct results and raw_output (string with logs)
      let parsed = null;
      if (data.results) {
        parsed = data.results;
      } else if (data.raw_output) {
        const match = data.raw_output.match(/\[\s*\{[\s\S]*?\}\s*\]/m);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch (e) {
            console.error("JSON parse failed:", e);
          }
        } else {
          console.warn("⚠️ No JSON array found in raw_output");
        }
      }

      if (!parsed) throw new Error("No valid JSON data found.");
      setResult(parsed);
      setStatus("Inspection complete ✅");
    } catch (err) {
      console.error("❌ Error:", err);
      setError("Agent failed — please retry.");
      setStatus("Agent Error ❌");
    } finally {
      setLoading(false);
    }
  };

  const getLocalPath = (p) => {
    if (!p) return "";
    return `http://localhost:5050${p
      .replace("/Users/krushna/SpaceFigureAI/backend", "")
      .replace("/Users/krushna/SpaceFigureAI", "")}`;
  };

  return (
    <div className="tourguide">
      <video className="bg" src={bgVideo} autoPlay loop muted playsInline />
      <div className="overlay">
        <div className="panel fade-in">
          <h1 className="title">Tour Guide Agent</h1>
          <p className="status">{status}</p>

          {!loading && !result && (
            <button className="btn" onClick={handleStart}>
              Start Room Inspection
            </button>
          )}

          {loading && <p className="loader">🔍 Scanning environment...</p>}
          {error && <p className="error">{error}</p>}

          {Array.isArray(result) && result.length > 0 && (
            <div className="results fade-in">
              <h3>🏠 Inspection Results</h3>

              {result.map((r, i) => (
                <div key={i} className="card">
                  <div className="image-grid">
                    <div>
                      <h4>Original</h4>
                      <img src={getLocalPath(r.source_image)} alt="original" />
                    </div>
                    <div>
                      <h4>Annotated</h4>
                      <img
                        src={getLocalPath(r.annotated_image)}
                        alt="annotated"
                      />
                    </div>
                    <div>
                      <h4>Depth Map</h4>
                      <img src={getLocalPath(r.depth?.vis_path)} alt="depth" />
                    </div>
                  </div>

                  <div className="meta-section">
                    <h4>📦 Objects</h4>
                    {Object.keys(r.counts || {}).length ? (
                      <ul className="object-list">
                        {Object.entries(r.counts).map(([k, v]) => (
                          <li key={k}>
                            {k}: <span>{v}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="none">No objects detected</p>
                    )}

                    <h4>🧭 Orientation</h4>
                    <p>{r.orientation?.orientation}</p>

                    <h4>📏 Dimensions</h4>
                    <pre>{JSON.stringify(r.dimensions, null, 2)}</pre>

                    <h4>🏗️ Geometry</h4>
                    <pre>{JSON.stringify(r.geometry, null, 2)}</pre>

                    <h4>🌊 Depth Stats</h4>
                    <pre>{JSON.stringify(r.depth, null, 2)}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TourGuideAgent;
