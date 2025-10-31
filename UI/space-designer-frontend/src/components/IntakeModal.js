import React, { useState } from "react";
import axios from "axios";
import "../styles/IntakeModal.css";

function IntakeModal({ onClose, imageSrc }) {
  const [form, setForm] = useState({
    room_type: "",
    budget_usd: "",
    style: "",
    lighting: "",
    color_palette: "",
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    const structuredData = {
      ...form,
      color_palette: form.color_palette
        ? form.color_palette.split(",").map((c) => c.trim())
        : [],
    };

    setSubmitted(true);
    setLoading(true);

    try {
      const response = await axios.post("http://127.0.0.1:5050/llava/analyze", {
        image_url: imageSrc,
        intake: structuredData,
      });

      const firstMessage = {
        sender: "assistant",
        text:
          response.data.reasoning ||
          "I see a modern, well-lit space. Would you like me to suggest decor or layout changes?",
      };

      setMessages([firstMessage]);
    } catch (err) {
      console.error(err);
      setMessages([{ sender: "assistant", text: "⚠️ Failed to analyze image." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!input.trim()) return;
    const userMsg = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await axios.post("http://127.0.0.1:5050/llava/chat", {
        image_url: imageSrc,
        message: input,
      });

      const botMsg = { sender: "assistant", text: response.data.reply };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { sender: "assistant", text: "Error: Unable to generate response." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3>🧠 Design Reasoning Agent</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {imageSrc && <img src={imageSrc} alt="Uploaded" className="modal-image" />}

        {!submitted && (
          <>
            <p className="modal-subtitle">
              Let's capture your design intent first 🌿
            </p>
            <div className="modal-body">
              <input name="room_type" placeholder="Room Type" value={form.room_type} onChange={handleChange} />
              <input name="budget_usd" placeholder="Budget (USD)" value={form.budget_usd} onChange={handleChange} />
              <input name="style" placeholder="Style (e.g. Boho, Modern)" value={form.style} onChange={handleChange} />
              <input name="lighting" placeholder="Lighting Preference" value={form.lighting} onChange={handleChange} />
              <input name="color_palette" placeholder="Color Palette (comma-separated)" value={form.color_palette} onChange={handleChange} />
            </div>
            <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? "Analyzing with LLaVA..." : "Start Reasoning"}
            </button>
          </>
        )}

        {submitted && (
          <div className="chat-section">
            <div className="chat-box">
              {messages.map((m, idx) => (
                <div key={idx} className={`chat-msg ${m.sender}`}>
                  <span>{m.text}</span>
                </div>
              ))}
              {loading && <div className="chat-msg assistant"><span>...</span></div>}
            </div>

            <div className="chat-input-area">
              <input
                type="text"
                placeholder="Ask for layout, vibe, decor ideas..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChat()}
              />
              <button onClick={handleChat}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default IntakeModal;
