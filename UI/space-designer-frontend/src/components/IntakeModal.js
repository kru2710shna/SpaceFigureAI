import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/IntakeModal.css";

function IntakeModal({ imageSrc }) {
  const [status, setStatus] = useState("Checking...");
  const [caption, setCaption] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState(null);

  // Check backend status once
  useEffect(() => {
    axios
      .get("http://127.0.0.1:5050/llava/status")
      .then((res) => setStatus(res.data.llava || "Online"))
      .catch(() => setStatus("Offline"));
  }, []);

  // Analyze uploaded image
  useEffect(() => {
    const analyze = async () => {
      if (!imageSrc) return;
      try {
        const res = await axios.post("http://127.0.0.1:5050/llava/analyze", {
          image_url: imageSrc,
        });

        setCaption(res.data.caption || "No caption generated.");
        setReasoning(res.data.reasoning || "No reasoning provided.");
        setSuggestion(res.data.suggestion || "No design suggestions found.");
      } catch {
        setError("Failed to analyze image.");
      }
    };
    analyze();
  }, [imageSrc]);

  return (
    <div className="intake-modal-wrapper">
      <div className="intake-panel">
        <div className="intake-header">
          <h3>Design Reasoning Agent</h3>
          <p className="status">
            Status: <span>{status}</span>
          </p>
        </div>

        <div className="result-section">
          <img src={imageSrc} alt="Uploaded Blueprint" className="analysis-img" />

          {error ? (
            <p className="error-text">{error}</p>
          ) : (
            <>
              <div className="info-card">
                <h4>Caption</h4>
                <p>{caption}</p>
              </div>

              <div className="info-card">
                <h4>Reasoning</h4>
                <p>{reasoning}</p>
              </div>

              <div className="info-card">
                <h4>Suggestions</h4>
                <p>{suggestion}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default IntakeModal;
