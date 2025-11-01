# geometry.py
# Plane hints + simple room measures (scale-less unless camera height is given)

from __future__ import annotations
import numpy as np
from typing import Dict, Any, Optional, Tuple
import cv2

def plane_stats_from_depth(depth_norm: np.ndarray, stride: int = 6) -> Dict[str, Any]:
    """
    Very lightweight "plane-ness" estimator using gradient analysis.
    Not a full PlaneRCNN; good enough for floor/ceiling/wall hints.
    """
    h, w = depth_norm.shape
    # gradients
    gx = cv2.Sobel(depth_norm, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(depth_norm, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.sqrt(gx * gx + gy * gy)

    # floor candidate: lowest 20% height band with least gradient
    band = depth_norm[int(0.75*h):, :]
    floor_score = float(1.0 - np.clip(band.std() * 4.0, 0, 1))

    # wall "planarity": low gradient fraction
    low_grad = (mag < 0.02).mean()

    return {
        "low_gradient_fraction": float(low_grad),
        "floor_planarity_score": float(floor_score),
        "median_depth": float(np.median(depth_norm)),
    }


def estimate_dimensions(
    depth_norm: np.ndarray,
    camera_height_m: Optional[float] = None,
    fov_deg: Optional[float] = None,
) -> Dict[str, Any]:
    """
    If camera_height_m + fov_deg are provided, give rough real-world estimates.
    Otherwise returns pixel-based estimates.
    """
    h, w = depth_norm.shape
    est = {"image_width_px": int(w), "image_height_px": int(h)}

    if camera_height_m is None or fov_deg is None:
        est["scale"] = "relative"
        # approximate “ceiling height” in pixels: top-to-bottom variance profile
        col = np.median(depth_norm, axis=1)  # per-row median
        top, bottom = np.argmax(col < col.mean()), np.argmax(col[::-1] < col.mean())
        est["ceiling_height_px_guess"] = int(max(50, h - bottom - top))
        return est

    # crude pinhole relation (best-effort):
    f = (w / 2) / np.tan(np.deg2rad(fov_deg / 2))
    # assume camera ~ eye height; convert pixel height to meters by similar triangles
    px_to_m = camera_height_m / (h * 0.45)  # heuristic
    est["scale"] = "approx_meters"
    est["px_to_m"] = px_to_m
    est["focal_px"] = float(f)
    est["ceiling_height_m_guess"] = float((h * 0.45) * px_to_m)
    return est
