import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/IntakeModal.css";

function IntakeModal({ onClose, imageSrc }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Checking…");

  // check backend /llava/status once on open
  useEffect(() => {
    axios.get("http://127.0.0.1:5050/llava/status")
      .then((res) => setStatus(res.data.llava))
      .catch(() => setStatus("⚠️ Offline"));
  }, []);

  // initial reasoning
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const res = await axios.post("http://127.0.0.1:5050/llava/analyze", { image_url: imageSrc });
        setMessages([
          { sender: "assistant", text: res.data.caption || "Analyzing your design…" },
          { sender: "assistant", text: res.data.reasoning || res.data.suggestion || "Let's talk style ideas!" },
        ]);
      } catch {
        setMessages([{ sender: "assistant", text: "⚠️ Failed to analyze image." }]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [imageSrc]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await axios.post("http://127.0.0.1:5050/llava/chat", {
        image_url: imageSrc,
        message: userMsg.text,
      });
      setMessages((prev) => [...prev, { sender: "assistant", text: res.data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { sender: "assistant", text: "Error: Unable to generate response." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container pretty-scroll">
        <header className="modal-header">
          <div className="title-row">
            <h3>🧠 Design Reasoning Agent</h3>
            <span className="status-chip">{status}</span>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </header>

        <div className="image-frame">
          <img src={imageSrc} alt="uploaded" />
        </div>

        <div className="chat-section pretty-scroll">
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble ${m.sender}`}>
              {m.text}
            </div>
          ))}
          {loading && <div className="chat-bubble assistant">Thinking …</div>}
        </div>

        <div className="chat-input">
          <input
            placeholder="Ask for layout, vibe, or décor ideas…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button onClick={handleSend}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default IntakeModal;
