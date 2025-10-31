import React from "react";
import UploadForm from "./components/UploadForm";
import "./App.css";
import bgVideo from "./assets/BG_Arch_2.mp4";

function App() {
  return (
    <div className="app-container">
      <video
        className="background-video"
        src={bgVideo}
        autoPlay
        loop
        muted
        playsInline
      />

      {/* ✨ Overlay */}
      <div className="overlay"></div>

      {/* 🌟 Foreground Content */}
      <div className="content">
        <h1 className="title">Living Spaces Designer</h1>
        <p className="subtitle">
          See your space by imagining it
        </p>
        <UploadForm />
      </div>
    </div>
  );
}

export default App;
