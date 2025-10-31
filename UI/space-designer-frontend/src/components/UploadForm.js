import React, { useState } from "react";
import axios from "axios";
import Notification from "./Notification";
import "../styles/upload.css";

function UploadForm() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedImg, setUploadedImg] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const [message, setMessage] = useState("");

  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    console.log("Files selected:", selectedFiles.map((f) => f.name));
  };

  // Handle upload
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!files.length) {
      console.warn("No files selected for upload.");
      return alert("Please select at least one image.");
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      console.log("Starting upload...");
      setUploading(true);

      const response = await axios.post("http://127.0.0.1:5050/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("Upload response:", response.data);

      if (response.data.uploaded?.length > 0) {
        const uploadedPath = response.data.uploaded[0].path;
        setUploadedImg(`http://localhost:5050${uploadedPath}`);
        setMessage("Image uploaded successfully.");
        setShowNotif(true);
        
      } else {
        console.warn("Upload succeeded but no file info returned.");
        setMessage("Upload succeeded, but file data missing.");
        setShowNotif(true);
      }
    } catch (error) {
      console.error("Error during upload:", error);
      if (error.response) {
        console.error("Response Data:", error.response.data);
        console.error("Status:", error.response.status);
      }
      setMessage("Upload failed. Please try again.");
      setShowNotif(true);
    } finally {
      setUploading(false);
    }
  };

  // Retry upload
  const handleRetry = () => {
    console.log("Retrying upload...");
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
    </>
  );
}

export default UploadForm;
