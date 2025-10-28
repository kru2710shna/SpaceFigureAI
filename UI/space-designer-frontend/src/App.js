import React from "react";
import UploadForm from "./components/UploadForm";
import "./App.css";
import bgImage from "./assets/BG_AIML.jpg";

function App() {
  return (
    <div
      className="app-container"
      style={{
        backgroundImage: `url(${bgImage})`,
      }}
    >
      <div className="overlay"></div>
      <div className="content">
        <h1 className="title"> Living Spaces Designer</h1>
        <p className="subtitle">
          Please upload pictures of your room or blueprint below.
        </p>
        <UploadForm />
      </div>
    </div>
  );
}

export default App;
