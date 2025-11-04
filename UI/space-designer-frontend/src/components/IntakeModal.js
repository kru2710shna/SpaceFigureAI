import React, { useEffect, useState, useCallback } from "react";
import "../styles/IntakeModal.css";
import { useNavigate } from "react-router-dom";

function IntakeModal({ imageSrc, uploadId }) {
  const navigate = useNavigate();

  // Core States
  const [status, setStatus] = useState("Checking...");
  const [step, setStep] = useState(0);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState({});
  const [currentInput, setCurrentInput] = useState("");
  const [caption, setCaption] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // -------------------------------------------------------
  // Helper: Unified fetch wrapper with logging
  // -------------------------------------------------------
  const safeFetch = async (url, options = {}) => {
    console.log(`[Request] ${options.method || "GET"} ${url}`);
    if (options.body) console.log("Payload:", options.body);
    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text();
      console.error(`HTTP ${response.status}:`, text);
      throw new Error(text || "Network request failed");
    }
    const data = await response.json();
    console.log("[Response]", data);
    return data;
  };

  // -------------------------------------------------------
  // 1. Check Groq API Backend Availability
  // -------------------------------------------------------
  useEffect(() => {
    async function checkStatus() {
      try {
        const data = await safeFetch("http://127.0.0.1:5050/groq/status");
        setStatus(data.groq || "Online");
      } catch {
        setStatus("Offline");
        setError("Groq backend not reachable.");
      }
    }
    checkStatus();
  }, []);

  // -------------------------------------------------------
  // 2. Confirm Uploaded Blueprint Validity
  // -------------------------------------------------------
  useEffect(() => {
    async function confirmBlueprint() {
      if (!imageSrc) return;
      try {
        setLoading(true);
        const data = await safeFetch("http://127.0.0.1:5050/groq/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: imageSrc, upload_id: uploadId }),
        });

        if (data.confirmed) {
          console.log("Blueprint validated successfully.");
          setShowQuestion(true);
          await fetchNextQuestion(0, {});
        } else {
          setError("The uploaded image could not be validated as a blueprint.");
        }
      } catch (err) {
        console.error("Blueprint confirmation error:", err);
        setError("Failed to validate the blueprint.");
      } finally {
        setLoading(false);
      }
    }
    confirmBlueprint();
  }, [imageSrc, uploadId]);

  // -------------------------------------------------------
  // 3. Fetch Next Question from Groq
  // -------------------------------------------------------
  const fetchNextQuestion = useCallback(
    async (currentStep, currentAnswers) => {
      try {
        setLoading(true);
        const data = await safeFetch("http://127.0.0.1:5050/groq/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: currentStep,
            prevAnswers: currentAnswers,
            sessionId,
          }),
        });

        if (data.sessionId && !sessionId) setSessionId(data.sessionId);

        if (data.done) {
          console.log("All answers collected, saving preferences...");
          await saveUserAnswers(currentAnswers); // ✅ Save to backend
          setShowQuestion(false);
          analyzeDesign(currentAnswers);
        } else {
          setQuestion(data.question || "Next question unavailable.");
          setCurrentInput("");
        }
      } catch (err) {
        console.error("Question fetch error:", err);
        setError("Unable to fetch the next question from Groq API.");
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  // -------------------------------------------------------
  // 4. Handle Answer Submission
  // -------------------------------------------------------
  const handleSubmit = () => {
    if (!currentInput.trim()) return;
    const updated = { ...answers, [`step${step}`]: currentInput.trim() };
    setAnswers(updated);
    setStep(step + 1);
    console.log("Answer submitted:", updated);
    fetchNextQuestion(step + 1, updated);
  };

  const handleSkip = () => {
    const updated = { ...answers, [`step${step}`]: "Skipped" };
    setAnswers(updated);
    setStep(step + 1);
    console.log("Question skipped:", updated);
    fetchNextQuestion(step + 1, updated);
  };

  // -------------------------------------------------------
  // 5. Save Answers to Backend (POST /groq/save-answers)
  // -------------------------------------------------------
  const saveUserAnswers = async (finalAnswers) => {
    try {
      const payload = {
        style: finalAnswers.step0 || "Modern",
        budget: finalAnswers.step1 || "$5k–$10k",
        lighting: finalAnswers.step2 || "Natural",
      };

      console.log("💾 Saving user answers:", payload);
      const response = await safeFetch("http://127.0.0.1:5050/groq/save-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("✅ Preferences saved:", response);
    } catch (err) {
      console.error("❌ Error saving user answers:", err);
    }
  };

  // -------------------------------------------------------
  // 6. Final Design Analysis Request
  // -------------------------------------------------------
  const analyzeDesign = async (finalAnswers) => {
    try {
      setLoading(true);
      const data = await safeFetch("http://127.0.0.1:5050/groq/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_id: uploadId,
          image_url: imageSrc,
          intake: finalAnswers,
        }),
      });

      setCaption(data.caption || "No caption provided.");
      setReasoning(data.reasoning || "No reasoning found.");

      // ✅ Fix: Safely handle suggestion if it's an object
      if (data.suggestion && typeof data.suggestion === "object") {
        setSuggestion(data.suggestion);
      } else {
        setSuggestion(data.suggestion || "No suggestions available.");
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Design reasoning analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------
  // 7. UI Rendering
  // -------------------------------------------------------
  return (
    <div className="intake-modal-wrapper">
      <div className="intake-panel">
        <div className="intake-header">
          <h3>Groq Design Reasoning Agent</h3>
          <p className="status-line">
            Backend Status: <strong>{status}</strong>
          </p>
        </div>

        <div className="result-section">
          {imageSrc && (
            <img src={imageSrc} alt="Uploaded Blueprint" className="analysis-img" />
          )}

          {loading && <p className="loading-text">Processing request...</p>}
          {error && <p className="error-text">{error}</p>}

          {!error && showQuestion && !loading && (
            <div className="question-block">
              <h4 className="question-title">{question}</h4>

              <input
                type="text"
                className="answer-input"
                value={currentInput}
                placeholder="Type your answer..."
                onChange={(e) => setCurrentInput(e.target.value)}
              />

              <div className="button-row">
                <button className="skip-btn" onClick={handleSkip}>
                  Skip
                </button>
                <button className="submit-btn" onClick={handleSubmit}>
                  Submit Answer
                </button>
              </div>
            </div>
          )}

          {!error && !showQuestion && !loading && (
            <div className="result-summary">
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
                <p>
                  {typeof suggestion === "object"
                    ? Object.entries(suggestion).map(([key, value]) => (
                        <div key={key}>
                          <strong>{key}:</strong>{" "}
                          {Array.isArray(value) ? value.join(", ") : String(value)}
                        </div>
                      ))
                    : suggestion}
                </p>
              </div>

              {caption && (
                <div className="next-step-container">
                  <button
                    className="next-step-btn"
                    onClick={() =>
                      navigate("/tour-guide", { state: { imageSrc, uploadId } })
                    }
                  >
                    Proceed to 3D Design Visualization
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IntakeModal;
