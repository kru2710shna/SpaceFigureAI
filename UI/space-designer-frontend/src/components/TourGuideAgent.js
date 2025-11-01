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
        body: JSON.stringify({ mode: "blueprint" }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Backend connection failed");
      }

      const data = await res.json();
      console.log("Backend response:", data);

      if (!data.results || !Array.isArray(data.results)) {
        throw new Error("Invalid response format from backend");
      }

      setResult(data.results);
      setStatus("Inspection complete ✅");
    } catch (err) {
      console.error("❌ Error:", err);
      setError(err.message || "Agent failed — please retry.");
      setStatus("Agent Error ❌");
    } finally {
      setLoading(false);
    }
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
                  {/* Mode Badge */}
                  <div className="mode-badge">
                    Mode: <strong>{r.mode}</strong>
                  </div>

                  {/* Annotated Image Only */}
                  <div className="image-section">
                    <h4>📸 Detected Objects</h4>
                    {r.annotated_image ? (
                      <img
                        src={r.annotated_image}
                        alt="Annotated floor plan"
                        className="annotated-img"
                        onError={(e) => {
                          console.error("Image load failed:", r.annotated_image);
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "block";
                        }}
                      />
                    ) : (
                      <p className="none">No annotated image available</p>
                    )}
                    <div className="error-msg" style={{ display: "none" }}>
                      Failed to load image
                    </div>
                  </div>

                  {/* Detection Counts */}
                  <div className="meta-section">
                    <h4>📦 Detected Objects</h4>
                    {r.counts && Object.keys(r.counts).length > 0 ? (
                      <ul className="object-list">
                        {Object.entries(r.counts).map(([label, count]) => (
                          <li key={label}>
                            <span className="label">{label}:</span>
                            <span className="count">{count}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="none">No objects detected</p>
                    )}
                  </div>

                  {/* Output Files */}
                  <div className="files-section">
                    <h4>📁 Output Files</h4>
                    <ul className="file-list">
                      {r.json && (
                        <li>
                          <a
                            href={r.json}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="file-link"
                          >
                            📄 Detections JSON
                          </a>
                        </li>
                      )}
                      {r.csv && (
                        <li>
                          <a
                            href={r.csv}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="file-link"
                          >
                            📊 Counts CSV
                          </a>
                        </li>
                      )}
                    </ul>
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