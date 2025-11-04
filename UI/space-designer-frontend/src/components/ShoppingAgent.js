import React, { useEffect, useState } from "react";
import "../styles/ShoppingAgent.css";
import bgVideo from "../assets/BG_ML.mp4";
import { useNavigate } from "react-router-dom";

const ShoppingAgent = () => {
  const [reasoning, setReasoning] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const safeFetch = async (url, options = {}) => {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const reasoningData = await safeFetch("http://127.0.0.1:5050/groq/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url:
              "http://127.0.0.1:5050/agents/outputs/latest_detected_blueprint.jpg",
            intake: { style: "Modern", budget: "$5k–$10k", lighting: "Natural" },
          }),
        });
        setReasoning(reasoningData);

        const shoppingData = await safeFetch("http://127.0.0.1:5050/groq/shopping");
        setData(shoppingData);
      } catch (err) {
        console.error("❌ Error:", err);
        setError("Failed to load data. Please retry.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  return (
    <div className="shopping-agent-container">
      <video className="bg-video" src={bgVideo} autoPlay loop muted playsInline />
      <div className="content-overlay fade-in">
        <header className="hero-section">
          <h1 className="main-title">🛋️ Smart Design & Shopping Agent</h1>
          <p className="hero-desc">
            AI-powered room-aware recommendations inspired by your architectural blueprint.
          </p>
        </header>

        {loading && <p className="status-msg">Analyzing your space...</p>}
        {error && <p className="error-msg">{error}</p>}

        {reasoning && (
          <section className="summary-section">
            <h2>🧠 Design Summary</h2>
            <div className="divider"></div>
            <p><strong>Caption:</strong> {reasoning.caption}</p>
            <p><strong>Reasoning:</strong> {reasoning.reasoning}</p>
            <p><strong>Suggestions:</strong> {reasoning.suggestion}</p>
          </section>
        )}

        {data && (
          <section className="recommendation-section">
            <h2>🏠 Room-Based Recommendations</h2>
            <div className="divider"></div>

            {Object.entries(data.rooms).map(([room, items]) => (
              <div className="room-block" key={room}>
                <h3 className="room-title">
                  <span>{room.charAt(0).toUpperCase() + room.slice(1)}</span>
                </h3>
                <div className="room-grid">
                  {items.length > 0 ? (
                    items.map((item, i) => (
                      <div className="card" key={i}>
                        <h4>{item.name}</h4>
                        <p className="category">{item.category}</p>
                        <p className="price">${item.price}</p>
                      </div>
                    ))
                  ) : (
                    <p className="no-items">No items found for this room.</p>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        <div className="shopping-links">
          <p>Explore similar items on:</p>
          <div className="link-row">
            <a
              href="https://www.amazon.com/s?k=furniture+modern+home+decor"
              target="_blank"
              rel="noreferrer"
              className="external-link amazon"
            >
              🛒 Amazon
            </a>
            <a
              href="https://www.ikea.com/us/en/cat/furniture-fu001/"
              target="_blank"
              rel="noreferrer"
              className="external-link ikea"
            >
              🏠 IKEA
            </a>
          </div>
        </div>

        <button className="back-btn" onClick={() => navigate("/tour-guide")}>
          ← Back to Design Overview
        </button>
      </div>
    </div>
  );
};

export default ShoppingAgent;
