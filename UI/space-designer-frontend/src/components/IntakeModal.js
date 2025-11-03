import React, { useEffect, useState } from "react";
import "../styles/IntakeModal.css";
import { useNavigate } from "react-router-dom";


function IntakeModal({ imageSrc }) {
  const [status, setStatus] = useState("Checking...");
  const [caption, setCaption] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState(null);
  const [step, setStep] = useState(0);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState({});
  const [showQuestion, setShowQuestion] = useState(false);
  const [currentInput, setCurrentInput] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const navigate = useNavigate();

  const fetchNextQuestion = async (currentStep, currentAnswers) => {
    try {
      const res = await fetch("http://127.0.0.1:5050/gemini/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          step: currentStep, 
          prevAnswers: currentAnswers,
          sessionId: sessionId 
        }),
      });
      const data = await res.json();

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      if (data.done) {
        setShowQuestion(false);
        console.log("✅ All answers saved to:", data.savedFile);
        analyzeDesign();
      } else {
        setQuestion(data.question || "Next question unavailable.");
        setCurrentInput(""); // reset input for next question
      }
    } catch (err) {
      console.error("Question error:", err);
      setError("Question fetch failed.");
    }
  };

  // ✅ Check backend status
  useEffect(() => {
    fetch("http://127.0.0.1:5050/gemini/status")
      .then((res) => res.json())
      .then((data) => setStatus(data.groq || "Online"))
      .catch(() => setStatus("Offline"));
  }, []);

  // ✅ Load saved progress
  useEffect(() => {
    const saved = localStorage.getItem("designSession");
    if (saved) {
      const { answers, step } = JSON.parse(saved);
      setAnswers(answers || {});
      setStep(step || 0);
    }
  }, []);

  // ✅ Save progress persistently
  useEffect(() => {
    localStorage.setItem("designSession", JSON.stringify({ answers, step }));
  }, [answers, step]);

  // ✅ Confirm blueprint via Groq
  useEffect(() => {
    const confirmBlueprint = async () => {
      if (!imageSrc) return;
      try {
        const res = await fetch("http://127.0.0.1:5050/gemini/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: imageSrc }),
        });
        const data = await res.json();
        if (data.confirmed) {
          setShowQuestion(true);
          fetchNextQuestion(0, {});
        } else setError("The uploaded image is not a valid blueprint.");
      } catch (err) {
        console.error("Confirm error:", err);
        setError("Failed to analyze blueprint via Groq API.");
      }
    };
    confirmBlueprint();
  }, [imageSrc, fetchNextQuestion]);

  // ✅ Handle user answer input submission
  const handleSubmitAnswer = () => {
    if (!currentInput.trim()) return;
    const updated = { ...answers, [`step${step}`]: currentInput.trim() };
    setAnswers(updated);
    setStep(step + 1);
    fetchNextQuestion(step + 1, updated);
  };

  // ✅ Handle skip
  const handleSkip = () => {
    const updated = { ...answers, [`step${step}`]: "Skipped" };
    setAnswers(updated);
    setStep(step + 1);
    fetchNextQuestion(step + 1, updated);
  };

  // ✅ Final reasoning (Groq analysis)
  const analyzeDesign = async () => {
    try {
      const res = await fetch("http://127.0.0.1:5050/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageSrc, intake: answers }),
      });
      const data = await res.json();
      setCaption(data.caption || "No caption generated.");
      setReasoning(data.reasoning || "No reasoning provided.");
      setSuggestion(data.suggestion || "No suggestions found.");
    } catch (err) {
      console.error("Analyze error:", err);
      setError("Final analysis failed.");
    }
  };

  // ✅ UI render
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

          {error && <p className="error-text">{error}</p>}

          {showQuestion ? (
            <div className="question-block">
              <h4>{question}</h4>

              {/* ✅ Input field */}
              <input
                type="text"
                className="answer-input"
                value={currentInput}
                placeholder="Type your answer here..."
                onChange={(e) => setCurrentInput(e.target.value)}
              />

              <div className="btn-row">
                <button className="skip-btn" onClick={handleSkip}>Skip</button>
                <button className="submit-btn" onClick={handleSubmitAnswer}>Submit Answer</button>
              </div>
            </div>
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
          {!showQuestion && caption && (
            <div className="next-step-container">
              <button
                className="next-step-btn"
                onClick={() => navigate("/tour-guide", { state: { imageSrc } })}
              >
                Click here for Housing Tour— we’ll be moving to having a Tour for the House
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

}

export default IntakeModal;
