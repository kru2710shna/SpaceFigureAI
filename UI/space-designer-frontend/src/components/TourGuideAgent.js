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
      setResult(data.results);
      setStatus("Inspection complete ✅");
    } catch (err) {
      console.error(err);
      setError("Agent failed — please retry.");
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

          {Array.isArray(result) && (
            <div className="results fade-in">
              <h3>Agent Results</h3>
              {result.map((r, i) => (
                <div key={i} className="card">
                  <p><b>Mode:</b> {r.mode}</p>

                  <div className="objects">
                    <b>Detected Objects:</b>
                    {Object.keys(r.counts || {}).length ? (
                      <ul>
                        {Object.entries(r.counts).map(([k, v]) => (
                          <li key={k}>{k}: <span className="count">{v}</span></li>
                        ))}
                      </ul>
                    ) : (
                      <p className="none">No detections found</p>
                    )}
                  </div>

                  {r.annotated_image && (
                    <div className="preview">
                      <img
                        src={`http://localhost:5050/${r.annotated_image.replace(/.*\/backend\//, "")}`}
                        alt="Detected Output"
                      />
                    </div>
                  )}

                  <div className="links">
                    {r.csv && (
                      <a
                        href={`http://localhost:5050/${r.csv.replace(/.*\/backend\//, "")}`}
                        download
                        className="link-btn"
                      >
                        📄 Download CSV
                      </a>
                    )}
                    {r.json && (
                      <a
                        href={`http://localhost:5050/${r.json.replace(/.*\/backend\//, "")}`}
                        download
                        className="link-btn"
                      >
                        🧾 View JSON
                      </a>
                    )}
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
