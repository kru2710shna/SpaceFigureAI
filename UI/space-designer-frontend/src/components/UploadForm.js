import React, { useState } from "react";
import axios from "axios";
import { FaCloudUploadAlt } from "react-icons/fa";


function UploadForm() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(selected);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(dropped);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.length) {
      setMessage("Please select at least one image to upload.");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      setUploading(true);
      setMessage("Uploading...");
      const response = await axios.post("http://localhost:5000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(response.data.message || "Upload successful!");
      setFiles([]);
    } catch (error) {
      console.error(error);
      setMessage("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-box">
      <form
        onSubmit={handleSubmit}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className={`drop-zone ${dragActive ? "active" : ""}`}
          onClick={() => document.getElementById("fileInput").click()}
        >
          <FaCloudUploadAlt className="upload-icon" />
          <p>
            {dragActive
              ? "Drop your images here!"
              : "Drag & Drop or Click to Upload Room Photos / Blueprints"}
          </p>
          <input
            id="fileInput"
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>

        {files.length > 0 && (
          <div className="preview-grid">
            {files.map((file, idx) => (
              <div key={idx} className="preview-card">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="preview-img"
                />
                <p className="file-name">{file.name}</p>
              </div>
            ))}
          </div>
        )}

        <button type="submit" disabled={uploading}>
          {uploading ? "Uploading..." : "Upload Files"}
        </button>
      </form>
      {message && <p className="status-msg">{message}</p>}
    </div>
  );
}

export default UploadForm;
