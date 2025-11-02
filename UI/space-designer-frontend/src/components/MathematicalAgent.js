import React, { useEffect, useState } from "react";
import "../styles/MathematicalAgent.css";

export default function MathematicalAgent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchMath() {
      try {
        setLoading(true);
        const res = await fetch("http://localhost:5050/math/run");
        if (!res.ok) throw new Error("Failed to connect to backend");

        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error("❌ Math Agent failed:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchMath();
  }, []);

  if (loading)
    return (
      <div className="math-agent">
        <h2>📐 Running Mathematical Analysis...</h2>
        <p>Estimating real-world dimensions...</p>
      </div>
    );

  if (error)
    return (
      <div className="math-agent error">
        <p>❌ {error}</p>
      </div>
    );

  return (
    <div className="math-agent">
      <div className="math-header">
        <h2>📏 Mathematical Agent</h2>
        <p>Real-world scale estimation and geometry reasoning</p>
      </div>

      <div className="math-table">
        <table>
          <thead>
            <tr>
              <th>Object</th>
              <th>Pixel Height</th>
              <th>Scaled Height (m)</th>
              <th>Estimated Real Height (ft)</th>
            </tr>
          </thead>
          <tbody>
            {data.objects.map((obj, idx) => (
              <tr key={idx}>
                <td>{obj.label}</td>
                <td>{obj.pixel_height.toFixed(2)}</td>
                <td>{obj.scaled_height_m.toFixed(2)}</td>
                <td>{obj.real_height_ft.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="math-summary">
        <h4>Room Area: {data.room_area_m2.toFixed(2)} m²</h4>
        <p>
          Scale Ratio: 1 px ≈ {data.scale_ratio_m.toFixed(4)} m <br />
          Confidence: {(data.confidence * 100).toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
