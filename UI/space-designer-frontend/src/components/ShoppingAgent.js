import React, { useEffect, useState } from "react";
import "../styles/ShopingAgent.css";
import bgVideo from "../assets/BG_ML.mp4";
import { useNavigate } from "react-router-dom";

const ShoppingAgent = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        const res = await fetch("http://127.0.0.1:5050/groq/shopping");
        if (!res.ok) throw new Error("Failed to fetch shopping data");
        const data = await res.json();
        setRecommendations(data.items || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRecommendations();
  }, []);

  return (
    <div className="shopping-agent-container">
      <video className="bg-video" src={bgVideo} autoPlay loop muted playsInline />
      <div className="content-overlay fade-in">

        {/* ===== Hero Section ===== */}
        <header className="intro-section">
          <h1 className="main-title">🛍️ Welcome to the Shopping Agent</h1>
          <p className="main-subtitle">
            Your AI-powered design companion for personalized furniture recommendations.
          </p>
          <p className="description">
            This intelligent agent interprets your blueprint, lighting, and design preferences
            to curate furniture that complements your layout, space, and aesthetic perfectly.
          </p>
          <p className="description">
            Sit back while the system blends spatial reasoning with modern design insights to
            bring harmony, comfort, and elegance to your dream interior.
          </p>
        </header>

        {/* ===== Recommendation Cards ===== */}
        {loading && <p className="loading">Fetching curated pieces...</p>}
        {error && <p className="error">{error}</p>}

        <div className="items-grid">
          {recommendations.map((item, index) => (
            <div key={index} className="item-card">
              <img src={item.image_url} alt={item.name} />
              <h3>{item.name}</h3>
              <p>{item.category}</p>
              <p><strong>${item.price}</strong></p>
              <a href={item.store_url} target="_blank" rel="noreferrer">View Item</a>
            </div>
          ))}
        </div>

        {/* ===== Floating Navigation Button ===== */}
        <button
          className="floating-btn"
          onClick={() => navigate("/tour-guide")}
        >
          ← Back to Design Overview
        </button>
      </div>
    </div>
  );
};

export default ShoppingAgent;
