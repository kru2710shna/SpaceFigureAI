# backend/validator.py
from flask import Flask, request, jsonify
import cv2
import numpy as np
import requests
from io import BytesIO

app = Flask(__name__)

@app.route("/validate-blueprint", methods=["POST"])
def validate_blueprint():
    try:
        data = request.get_json()
        image_url = data.get("image_url")

        if not image_url:
            return jsonify({"error": "Missing image_url"}), 400

        # Fetch image bytes
        resp = requests.get(image_url, timeout=10)
        img_array = np.frombuffer(resp.content, np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_GRAYSCALE)

        # Preprocess
        blur = cv2.GaussianBlur(img, (5, 5), 0)
        edges = cv2.Canny(blur, 50, 150, apertureSize=3)

        # Count edges
        edge_density = np.sum(edges > 0) / edges.size

        # Detect lines using Hough Transform
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=80, minLineLength=50, maxLineGap=10)
        line_count = 0 if lines is None else len(lines)

        # Heuristic check
        is_blueprint = edge_density > 0.02 and line_count > 30

        return jsonify({
            "is_blueprint": bool(is_blueprint),
            "edge_density": float(edge_density),
            "line_count": int(line_count),
            "reason": "Likely blueprint" if is_blueprint else "No strong structural lines detected"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=6000, host="127.0.0.1")
