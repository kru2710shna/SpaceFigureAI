import React, { useState } from "react";
import "../styles/IntakeModal.css";

function IntakeModal({ onClose, imageSrc, analysis }) {
  const [form, setForm] = useState({
    room_type: "",
    budget_usd: "",
    style: "",
    lighting: "",
    color_palette: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    const structuredData = {
      ...form,
      color_palette: form.color_palette.split(",").map((c) => c.trim()),
    };

    console.log("🧠 Intake Data:", structuredData);
    alert("Structured data sent:\n" + JSON.stringify(structuredData, null, 2));
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3>Intake Agent</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {imageSrc && <img src={imageSrc} alt="Uploaded" className="modal-image" />}

        <p className="modal-subtitle">
          {analysis?.question || "Let's personalize your design. Please answer a few quick questions."}
        </p>

        <div className="modal-body">
          <input
            name="room_type"
            placeholder="Room Type (e.g. Living Room)"
            value={form.room_type}
            onChange={handleChange}
          />
          <input
            name="budget_usd"
            placeholder="Budget in USD"
            value={form.budget_usd}
            onChange={handleChange}
          />
          <input
            name="style"
            placeholder="Preferred Style (e.g. Modern, Minimalist)"
            value={form.style}
            onChange={handleChange}
          />
          <input
            name="lighting"
            placeholder="Lighting Preference (e.g. Warm, Bright)"
            value={form.lighting}
            onChange={handleChange}
          />
          <input
            name="color_palette"
            placeholder="Color Palette (comma-separated)"
            value={form.color_palette}
            onChange={handleChange}
          />
        </div>

        <button className="submit-btn" onClick={handleSubmit}>
          Continue
        </button>
      </div>
    </div>
  );
}

export default IntakeModal;
