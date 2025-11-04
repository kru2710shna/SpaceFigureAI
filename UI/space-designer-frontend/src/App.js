import React from "react";
import { Routes, Route } from "react-router-dom";
import UploadForm from "./components/UploadForm";
import IntakeModal from "./components/IntakeModal";
import TourGuideAgent from "./components/TourGuideAgent";
import "./App.css";
import bgVideo from "./assets/BG_Arch_3.mp4";
import DepthViewer from "./components/DepthViewer"; 
import Blueprint3DViewer from "./components/Blueprint3DViewer";
import ShoppingAgent from "./components/ShoppingAgent";



function App() {
  return (
    <div className="app-root">
      <Routes>
        {/* ========== HOME PAGE ========== */}
        <Route
          path="/"
          element={
            <>
              {/* Section 1 – Background Hero */}
              <section className="hero-section">
                <video
                  className="background-video"
                  src={bgVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
                <div className="hero-overlay"></div>
                <div className="hero-content">
                  <h1>Living Spaces Designer</h1>
                  <p>See your space by imagining it</p>
                </div>
                <div className="scroll-indicator">Scroll to explore ↓</div>
              </section>

              {/* Section 2 – Agentic Architecture Overview */}
              <section className="architecture-section">
                <div className="arch-container">
                  <h2>Refined Agentic Architecture — Space Designer 2.0</h2>
                  <p className="subtitle">
                    Clean, autonomous, and production-ready orchestration built on
                    AWS SageMaker + NVIDIA NIM Vision + Llama-3
                  </p>

                  <div className="flow-diagram">
                    <p>
                      USER → Intake Agent → Tour Guide Agent → Designer Agent ↔ Trend Research Unit
                    </p>
                    <p>
                      ↓<br />
                      Mathematical Agent → Mapping Agent → Contractor Agent → Architect Agent
                    </p>
                    <p>
                      ↓<br />
                      Validator Agent → Pitcher Agent → Feedback Loop → Iterative Refinement
                    </p>
                  </div>

                  <div className="system-summary">
                    <h3>Deployment Flow</h3>
                    <p>
                      Step Functions orchestrate Intake → TourGuide → Math → Mapping → Design →
                      Contractor → Architect → Validator → Pitcher → Feedback.
                      Each agent writes structured JSON to DynamoDB and stores assets in S3 for
                      traceability, scalability, and reproducibility.
                    </p>

                    <h3>Core Advantages</h3>
                    <ul>
                      <li>Distinct data outputs per agent, unified schema via Mapping Agent.</li>
                      <li>Parallelizable execution where independent (Designer ↔ Tour Guide).</li>
                      <li>Transparent JSON output for full audit and explainability.</li>
                      <li>Feedback-driven autonomy for iterative refinement.</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Section 3 – Upload Interaction */}
              <section className="upload-section">
                <div className="upload-header">
                  <h2>Upload Your Room Photo or Blueprint</h2>
                  <p>
                    Once uploaded, the Intake Agent will analyze your layout and initialize the design pipeline.
                  </p>
                </div>
                <UploadForm />
              </section>
            </>
          }
        />

        {/* ========== INTAKE MODAL (User Q&A) ========== */}
        <Route path="/intake" element={<IntakeModal />} />

        {/* ========== TOUR GUIDE AGENT PAGE ========== */}
        <Route path="/tour-guide" element={<TourGuideAgent />} />

        <Route path="/depth-viewer" element={<DepthViewer />} />

        <Route path="/blueprint-3d" element={<Blueprint3DViewer />} />

        <Route path="/shopping-agent" element={<ShoppingAgent />} />
        
      </Routes>
    </div>
  );
}

export default App;
