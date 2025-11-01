import React, { useState } from "react";
import "../styles/DesignPreferenceModal.css";

function DesignPreferenceModal({ onComplete }) {
  const questions = [
    {
      key: "style",
      text: "What style do you prefer for this room?",
      options: ["Modern", "Classic", "Gen-Z", "Minimal", "Rustic"],
    },
    {
      key: "budget",
      text: "What is your approximate budget range?",
      options: ["<$5,000", "$5,000-$10,000", "$10,000-$20,000", ">$20,000"],
    },
    {
      key: "function",
      text: "What is the room’s main function and lighting preference?",
      options: [
        "Living room – bright natural light",
        "Bedroom – warm cozy lighting",
        "Office – balanced task lighting",
        "Studio – mixed ambient lighting",
      ],
    },
  ];

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const handleSelect = (value) => {
    const current = questions[step].key;
    setAnswers({ ...answers, [current]: value });
  };

  const handleContinue = () => {
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(answers);
    }
  };

  return (
    <div className="design-modal">
      <div className="design-card">
        <h3>{questions[step].text}</h3>
        <div className="options">
          {questions[step].options.map((opt) => (
            <button
              key={opt}
              className={
                answers[questions[step].key] === opt ? "selected" : ""
              }
              onClick={() => handleSelect(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <div className="actions">
          <button onClick={handleContinue}>
            {step === questions.length - 1 ? "Finish" : "Continue"}
          </button>
          <button onClick={() => handleContinue()} className="skip-btn">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

export default DesignPreferenceModal;
