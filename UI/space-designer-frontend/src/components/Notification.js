import React from "react";
import "../styles/Notification.css";

function Notification({ imageSrc, message, onRetry, onClose }) {
  const validSrc = imageSrc?.startsWith("http")
    ? imageSrc
    : `https://spacefigureai.onrender.com${imageSrc}`;

  return (
    <div className="notification">
      <div className="notif-header">
        <h4>{message || "Upload Complete"}</h4>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      {validSrc && (
        <div className="notif-body">
          <p className="preview-label">Uploaded Preview</p>
          <img src={validSrc} alt="Uploaded Preview" className="notif-img" />
        </div>
      )}

      <div className="notif-actions">
        <button className="retry-btn" onClick={onRetry}>Try Again</button>
      </div>
    </div>
  );
}

export default Notification;
