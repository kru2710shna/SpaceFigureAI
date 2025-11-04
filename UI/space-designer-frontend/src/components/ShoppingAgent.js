import React, { useEffect, useState } from "react";
import "../styles/ShopingAgent.css";
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
        const reasoningData = await safeFetch("https://spacefigureai.onrender.com/groq/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: "https://spacefigureai.onrender.com/agents/outputs/latest_detected_blueprint.jpg",
            intake: { style: "Modern", budget: "$5k–$10k", lighting: "Natural" },
          }),
        });
        setReasoning(reasoningData);

        const shoppingData = await safeFetch("https://spacefigureai.onrender.com/groq/shopping");
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
    <div className="shopping-page">
      <video className="background-video" src={bgVideo} autoPlay loop muted playsInline />
      <div className="overlay">
        <header className="title-section">
          <h1> Smart Design & Shopping Agent</h1>
          <p>AI-powered room-aware recommendations inspired by your architectural blueprint.</p>
        </header>

        {loading && <p className="status">Analyzing your space...</p>}
        {error && <p className="error">{error}</p>}

        {reasoning && (
          <section className="summary">
            <h2> Design Summary</h2>
            <div className="summary-block">
              <h3>Caption</h3>
              <p>{reasoning.caption}</p>

              <h3>Reasoning</h3>
              <p>{reasoning.reasoning}</p>

              <h3>Top Suggestions</h3>
              <ol>
                {reasoning.suggestion
                  .split(/[0-9]+\./)
                  .filter((s) => s.trim())
                  .map((tip, i) => (
                    <li key={i}>{tip.trim()}</li>
                  ))}
              </ol>
            </div>
          </section>
        )}

        {data && (
          <section className="rooms">
            <h2> Room-Based Recommendations</h2>

            {Object.entries(data.rooms).map(([room, items]) => (
              <div className="room" key={room}>
                <h3>{room.charAt(0).toUpperCase() + room.slice(1)}</h3>
                <p className="room-explainer">
                  These items were chosen to complement your {room.toLowerCase()} layout,
                  enhancing balance, comfort, and style within your design theme.
                </p>

                <div className="item-grid">
                  {items.length > 0 ? (
                    items.map((item, i) => (
                      <div className="item-card" key={i}>
                        <h4>{item.name}</h4>
                        <p className="category">{item.category}</p>
                        <p className="price">${item.price}</p>
                        <p className="reason">
                          This piece fits your {room.toLowerCase()}’s style — blending with
                          the natural light and budget constraints of your design.
                        </p>
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
          <p>Explore similar products on:</p>
          <div className="buttons">
            <a
              href="https://www.amazon.com/s?k=modern+home+furniture"
              target="_blank"
              rel="noreferrer"
              className="link amazon"
            >
              Amazon
            </a>
            <a
              href="https://www.ikea.com/us/en/cat/furniture-fu001/"
              target="_blank"
              rel="noreferrer"
              className="link ikea"
            >
              IKEA
            </a>
          </div>
        </div>

        <button className="back-button" onClick={() => navigate("/tour-guide")}>
          ← Back to Design Overview
        </button>
      </div>
    </div>
  );
};

export default ShoppingAgent;
