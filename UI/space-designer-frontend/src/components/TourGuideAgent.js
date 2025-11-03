import React, { useState } from "react";
import "../styles/TourGuideAgent.css";
import bgVideo from "../assets/BG_Arch.mp4";
import { useNavigate } from "react-router-dom";
import MathematicalAgent from "./MathematicalAgent";

const TourGuideAgent = () => {
  const [status, setStatus] = useState("Awaiting blueprint analysis...");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  // 🧠 Start analysis
  const handleStart = async () => {
    try {
      setError("");
      setLoading(true);
      setStatus("Processing architectural layout...");

      const res = await fetch("http://127.0.0.1:5050/tour-guide/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "blueprint" }),
      });

      if (!res.ok) throw new Error("Failed to connect to backend");
      const data = await res.json();
      if (!data.results || !Array.isArray(data.results))
        throw new Error("Invalid backend response format");

      setResult(data.results);
      setStatus("✅ Inspection Complete — Ready for Review");
    } catch (err) {
      console.error("❌ -7 Error:", err);
      setError(err.message || "Agent failure — try again.");
      setStatus("❌ -8 Error During Inspection");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tourguide-container">
      {/* ====== Background Video ====== */}
      <video className="bg-video" src={bgVideo} autoPlay loop muted playsInline />

      {/* ====== Foreground Overlay ====== */}
      <div className="content-overlay">
        <div className="panel fade-in">
          <h1 className="title">Tour Guide Agent</h1>
          <p className="subtitle">Architectural Layout Inspector</p>
          <p className="status">{status}</p>

          {/* ====== Start Button ====== */}
          {!loading && !result && (
            <button className="btn" onClick={handleStart}>
              Start Analysis
            </button>
          )}

          {/* ====== Loading / Error ====== */}
          {loading && <div className="loader">Scanning structure...</div>}
          {error && <div className="error">{error}</div>}

          {/* ====== Results ====== */}
          {Array.isArray(result) && result.length > 0 && (
            <>
              <div className="results fade-in">
                <h2>Inspection Summary</h2>
                {result.map((r, i) => (
                  <div key={i} className="card">
                    <div className="mode-tag">Mode: {r.mode}</div>

                    {/* Blueprint Image */}
                    <div className="image-wrapper">
                      <img
                        src={r.annotated_image}
                        alt="Detected blueprint"
                        className="annotated-img"
                        onError={(e) => (e.target.style.display = "none")}
                      />
                      <div className="image-glow" />
                    </div>

                    {/* Object and File Summary */}
                    <div className="summary-grid">
                      <div className="summary-block">
                        <h4>Object Counts</h4>
                        <ul className="object-list">
                          {Object.entries(r.counts).map(([k, v]) => (
                            <li key={k}>
                              <span>{k}</span>
                              <strong>{v}</strong>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="summary-block">
                        <h4>Output Files</h4>
                        <div className="file-links">
                          {r.json && (
                            <a
                              href={r.json}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="file-link"
                            >
                              Detections JSON
                            </a>
                          )}
                          {r.csv && (
                            <a
                              href={r.csv}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="file-link"
                            >
                              Counts CSV
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ====== Mathematical Agent Section ====== */}
              <section className="math-section">
                <MathematicalAgent />
              </section>

              {/* ====== 3D Render Button After Math Agent ====== */}
              <div className="render-btn-container fade-in">
                <button
                  className="render-btn"
                  onClick={() => navigate("/depth-viewer", { state: { imageSrc: result[0]?.annotated_image } })}

                >
                  3D Render
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TourGuideAgent;
