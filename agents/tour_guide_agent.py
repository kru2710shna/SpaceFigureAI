"""
Tour Guide Agent
================
Performs unified detection for:
1. 2D architectural plans (blueprints / floorplans)
2. 3D real-world room photos

Automatically selects the detection mode using heuristics based on
colorfulness and edge density, or accepts explicit mode override
("blueprint" | "room").

Outputs:
- Annotated detection image (saved in outputs/)
- JSON detections (label, confidence, bbox)
- CSV counts summary
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import List, Dict, Iterable, Optional

import cv2
import numpy as np
import pandas as pd
from PIL import Image
from ultralytics import YOLO
import argparse
import re, sys

# ===============================================================
# ----------------------- CONFIGURATION -------------------------
# ===============================================================

BLUEPRINT_MODEL_PATH = "models/best.pt"           # trained floorplan model
ROOM_MODEL_PATH = "models/yolov8n.pt"             # general object detector
OUTPUT_DIR = Path("outputs")

CONF_BLUEPRINT = 0.25
CONF_ROOM = 0.25

SELECTED_LABELS_2D = [
    "Column", "Curtain Wall", "Dimension", "Door",
    "Railing", "Sliding Door", "Stair Case", "Wall", "Window"
]

TARGET_CLASSES_ROOM = {"bed", "sofa", "couch", "window", "door"}

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff")
MODE_OVERRIDE: Optional[str] = None


# ===============================================================
# --------------------------- UTILITIES -------------------------
# ===============================================================

def _safe_mkdir(p: Path) -> None:
    """Safely create directories if not already existing."""
    p.mkdir(parents=True, exist_ok=True)


def _save_counts_csv(counts: Dict[str, int], path: Path) -> Path:
    df = pd.DataFrame(list(counts.items()), columns=["Label", "Count"])
    _safe_mkdir(path.parent)
    df.to_csv(path, index=False)
    return path


def _detections_to_json(model: YOLO, boxes: Iterable) -> List[dict]:
    dets = []
    for box in boxes:
        dets.append({
            "label": model.names[int(box.cls)],
            "confidence": float(box.conf),
            "bbox_xyxy": [float(v) for v in box.xyxy[0].tolist()],
        })
    return dets


def _count_detected_objects(model: YOLO, boxes: Iterable) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for box in boxes:
        label = model.names[int(box.cls)]
        counts[label] = counts.get(label, 0) + 1
    return counts


# ===============================================================
# ----------- HEURISTIC MODE DETECTION (2D vs 3D) ---------------
# ===============================================================

def _image_colorfulness(bgr: np.ndarray) -> float:
    """Compute Hasler & Süsstrunk colorfulness metric."""
    (B, G, R) = cv2.split(bgr)
    rg = np.abs(R - G)
    yb = np.abs(0.5 * (R + G) - B)
    std_rg, std_yb = rg.std(), yb.std()
    mean_rg, mean_yb = rg.mean(), yb.mean()
    return np.sqrt(std_rg ** 2 + std_yb ** 2) + 0.3 * np.sqrt(mean_rg ** 2 + mean_yb ** 2)


def _edge_density(gray: np.ndarray) -> float:
    """Compute edge density via Canny edge detection."""
    edges = cv2.Canny(gray, 100, 200)
    return float(edges.mean() / 255.0)


def guess_mode_from_image(image_path: Path) -> str:
    """Lightweight discriminator between blueprint and room photo."""
    bgr = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if bgr is None:
        return "room"  # fallback

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cf = _image_colorfulness(bgr)
    ed = _edge_density(gray)

    # Heuristic thresholds
    if cf < 15.0 and ed > 0.08:
        return "blueprint"
    return "room"


# ===============================================================
# ------------------- 2D BLUEPRINT DETECTION --------------------
# ===============================================================

def process_blueprint_image(model: YOLO, image_path: Path, out_dir: Path) -> Dict:
    """Run 2D blueprint/floorplan detection."""
    image = Image.open(image_path)
    results = model.predict(image, conf=CONF_BLUEPRINT)
    r = results[0]

    filtered = [b for b in r.boxes if model.names[int(b.cls)] in SELECTED_LABELS_2D]
    r.boxes = filtered

    annotated_bgr = r.plot()
    _safe_mkdir(out_dir)
    out_img = out_dir / f"{image_path.stem}_detected_blueprint.jpg"
    cv2.imwrite(str(out_img), annotated_bgr)

    det_json = _detections_to_json(model, filtered)
    out_json = out_dir / f"{image_path.stem}_detections_blueprint.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(det_json, f, indent=2)

    counts = _count_detected_objects(model, filtered)
    out_csv = out_dir / f"{image_path.stem}_counts_blueprint.csv"
    _save_counts_csv(counts, out_csv)

    return {
        "mode": "blueprint",
        "annotated_image": str(out_img),
        "json": str(out_json),
        "csv": str(out_csv),
        "counts": counts,
    }


# ===============================================================
# ------------------- 3D ROOM PHOTO DETECTION -------------------
# ===============================================================

def process_room_photo(model: YOLO, image_path: Path, out_dir: Path) -> Dict:
    """Run real-world room photo detection."""
    results = model(str(image_path))

    dets = []
    annotated_img_path = out_dir / f"{image_path.stem}_detected_room.jpg"
    _safe_mkdir(out_dir)

    for r in results:
        filtered_boxes = []
        for box in r.boxes:
            cls_name = model.names[int(box.cls)]
            if cls_name in TARGET_CLASSES_ROOM:
                dets.append({
                    "label": cls_name,
                    "confidence": float(box.conf),
                    "bbox_xyxy": [float(x) for x in box.xyxy[0].tolist()],
                })
                filtered_boxes.append(box)

        r.boxes = filtered_boxes
        annotated_bgr = r.plot()
        cv2.imwrite(str(annotated_img_path), annotated_bgr)

    out_json = out_dir / f"{image_path.stem}_detections_room.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(dets, f, indent=2)

    counts: Dict[str, int] = {}
    for d in dets:
        counts[d["label"]] = counts.get(d["label"], 0) + 1

    out_csv = out_dir / f"{image_path.stem}_counts_room.csv"
    _save_counts_csv(counts, out_csv)

    return {
        "mode": "room",
        "annotated_image": str(annotated_img_path),
        "json": str(out_json),
        "csv": str(out_csv),
        "counts": counts,
    }


# ===============================================================
# ------------------------- MAIN ENTRY --------------------------
# ===============================================================

def process_media(
    input_path: Path | str,
    output_dir: Path | str = OUTPUT_DIR,
    mode_override: Optional[str] = MODE_OVERRIDE,
    blueprint_model_path: str = BLUEPRINT_MODEL_PATH,
    room_model_path: str = ROOM_MODEL_PATH,
) -> List[Dict]:
    """
    Main callable function used by backend/index.js.
    Automatically decides between 2D or 3D detection,
    executes the respective pipeline, and returns a list of results.
    """

    in_path = Path(input_path)
    out_dir = Path(output_dir)

    blueprint_model: Optional[YOLO] = None
    room_model: Optional[YOLO] = None

    def _ensure_blueprint_model() -> YOLO:
        nonlocal blueprint_model
        if blueprint_model is None:
            blueprint_model = YOLO(blueprint_model_path)
        return blueprint_model

    def _ensure_room_model() -> YOLO:
        nonlocal room_model
        if room_model is None:
            room_model = YOLO(room_model_path)
        return room_model

    results: List[Dict] = []

    if in_path.is_file() and in_path.suffix.lower() in IMAGE_EXTS:
        images = [in_path]
    elif in_path.is_dir():
        images = [p for p in in_path.iterdir() if p.suffix.lower() in IMAGE_EXTS]
        if not images:
            raise FileNotFoundError(f"No valid images found in {in_path}")
    else:
        raise FileNotFoundError("Invalid input path; must be image or directory.")

    for img in images:
        mode = (mode_override or guess_mode_from_image(img)).lower()
        if mode not in {"blueprint", "room"}:
            raise ValueError("mode_override must be 'blueprint' or 'room'")

        if mode == "blueprint":
            model = _ensure_blueprint_model()
            res = process_blueprint_image(model, img, out_dir)
        else:
            model = _ensure_room_model()
            res = process_room_photo(model, img, out_dir)

        results.append(res)

    return results



if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    try:
        results = process_media(args.input, args.output)
        # 👇 Strip training/download logs before printing JSON
        sys.stdout.write(json.dumps(results, indent=2))
        sys.stdout.flush()
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
