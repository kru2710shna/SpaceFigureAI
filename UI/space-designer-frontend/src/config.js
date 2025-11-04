// src/config.js
const BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5050"
    : "https://spacefigureai.onrender.com";

export default BASE_URL;
