import React, { useState } from "react";
import axios from "axios";
import Notification from "./Notification";
import "../styles/upload.css";
import IntakeModal from "./IntakeModal";

function UploadForm() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedImg, setUploadedImg] = useState(null);
  const [uploadId, setUploadId] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [message, setMessage] = useState("");

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    console.log("Files selected:", selectedFiles.map((f) => f.name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.length) return alert("Please select an image.");

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      setUploading(true);
      const response = await axios.post("http://127.0.0.1:5050/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("📤 Upload response:", response.data);
      const uploaded = response.data.uploaded?.[0];
      if (!uploaded) throw new Error("Upload failed.");

      const imgUrl = `http://localhost:5050${uploaded.input_url}`;
      setUploadedImg(imgUrl);
      setUploadId(uploaded.uploadId);
      setMessage("Image uploaded successfully ✅");
      setShowNotif(true);
      setShowIntake(true);
    } catch (err) {
      console.error("❌ Upload error:", err);
      setMessage("Upload failed. Please try again.");
      setShowNotif(true);
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = () => {
    setShowNotif(false);
    setFiles([]);
    document.getElementById("fileInput").click();
  };

  return (
    <>
      <div className="upload-box">
        <form onSubmit={handleSubmit}>
          <div
            className="drop-zone"
            onClick={() => document.getElementById("fileInput").click()}
          >
            <p>Drag & Drop or Click to Upload Room Photos / Blueprints</p>
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
            <p className="file-count">{files.length} file(s) ready for upload</p>
          )}

          <button type="submit" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload Files"}
          </button>
        </form>
      </div>

      {showNotif && (
        <Notification
          imageSrc={uploadedImg}
          message={message}
          onRetry={handleRetry}
          onClose={() => setShowNotif(false)}
        />
      )}

      {showIntake && <IntakeModal imageSrc={uploadedImg} uploadId={uploadId} />}
    </>
  );
}

export default UploadForm;