# orientation.py
# Estimate room orientation (N/E/S/W) using brightness centroid + EXIF hints.

from __future__ import annotations
import cv2
import numpy as np
from typing import Dict, Any
import math

def estimate_orientation(image_path: str) -> Dict[str, Any]:
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        return {"orientation": "unknown"}

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    v = hsv[:, :, 2].astype("float32") / 255.0
    # remove specular highlights
    v = np.clip(v, 0, np.quantile(v, 0.995))
    m = cv2.moments(v)
    if m["m00"] <= 1e-6:
        return {"orientation": "unknown"}

    cx = m["m10"] / m["m00"]  # brightness centroid x
    w = img.shape[1]
    # Map centroid to simple E/W guess
    if cx > (0.55 * w):
        cardinal = "East-ish"
    elif cx < (0.45 * w):
        cardinal = "West-ish"
    else:
        cardinal = "South/North ambiguous"

    return {
        "orientation": cardinal,
        "brightness_cx_px": float(cx),
        "image_width_px": int(w),
    }
