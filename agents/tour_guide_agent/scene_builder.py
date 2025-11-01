# scene_builder.py
# Merge all perceptual outputs into one JSON scene graph + lightweight render.

from __future__ import annotations
from typing import List, Dict, Any, Optional
import cv2
import numpy as np
import os

from .perception import DetInstance

def to_scene_json(
    image_path: str,
    dets: List[DetInstance],
    depth_stats: Dict[str, Any],
    geom_stats: Dict[str, Any],
    dim_stats: Dict[str, Any],
    orient_stats: Dict[str, Any],
) -> Dict[str, Any]:
    objs = []
    for d in dets:
        objs.append({
            "label": d.label,
            "confidence": d.confidence,
            "bbox_xyxy": [float(x) for x in d.bbox_xyxy],
            "has_mask": d.mask is not None,
        })

    return {
        "source_image": image_path,
        "objects": objs,
        "depth": depth_stats,
        "geometry": geom_stats,
        "dimensions": dim_stats,
        "orientation": orient_stats,
    }


def render_overlay(
    image_path: str,
    dets: List[DetInstance],
    depth_map_vis_path: Optional[str],
    out_path: str,
) -> str:
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(image_path)

    overlay = img.copy()
    for d in dets:
        x1, y1, x2, y2 = map(int, d.bbox_xyxy)
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (138, 99, 255), 2)
        tag = f"{d.label} {d.confidence:.2f}"
        cv2.putText(overlay, tag, (x1, max(20, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 160, 255), 2, cv2.LINE_AA)
        if d.mask is not None:
            m = d.mask.astype(np.uint8) * 180
            color = np.zeros_like(img)
            color[:, :, 1] = m  # green tint
            overlay = cv2.addWeighted(overlay, 1.0, color, 0.35, 0)

    if depth_map_vis_path and os.path.exists(depth_map_vis_path):
        depth_vis = cv2.imread(depth_map_vis_path)
        if depth_vis is not None:
            h = min(180, overlay.shape[0] // 3)
            depth_vis = cv2.resize(depth_vis, (int(h * depth_vis.shape[1]/depth_vis.shape[0]), h))
            # put at bottom-right
            oh, ow = overlay.shape[:2]
            dh, dw = depth_vis.shape[:2]
            overlay[oh - dh - 10:oh - 10, ow - dw - 10:ow - 10] = depth_vis

    cv2.imwrite(out_path, overlay)
    return out_path
