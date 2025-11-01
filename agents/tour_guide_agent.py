"""
Unified detector for 2D architectural plans vs. 3D room photos.
- If the input looks like a blueprint/floor plan (line-dense, low colorfulness), it runs the
  custom 2D plan detector (Ultralytics YOLO) and exports: annotated image, JSON bboxes, CSV counts.
- If the input looks like a real-world room photo, it runs a general object detector (e.g., yolov8n.pt)
  and exports: JSON detections of target classes (bed/sofa/couch/window/door) and an annotated image.

You can force the mode with MODE_OVERRIDE ("blueprint"|"room"). Otherwise a lightweight heuristic
auto-detects mode from the image content.
"""
from __future__ import annotations

import os
import json
from pathlib import Path
from typing import List, Dict, Iterable, Tuple, Optional

import cv2
import numpy as np
import pandas as pd
from PIL import Image
from ultralytics import YOLO

# ---------------- CONFIG ----------------
# Models
BLUEPRINT_MODEL_PATH = "models/best.pt"      # your trained floorplan/blueprint model
ROOM_MODEL_PATH = "models/yolov8n.pt"               # or yolov8m.pt for higher accuracy

# IO
INPUT_PATH = r"C:\\Users\\keyar\\Documents\\Projects\\SpaceFigureAI\\backend\\uploads\image.png"  # file or folder
OUTPUT_DIR = Path("outputs")

# Confidence thresholds
CONF_BLUEPRINT = 0.25
CONF_ROOM = 0.25

# Label filters
SELECTED_LABELS_2D = [
    'Column', 'Curtain Wall', 'Dimension', 'Door',
    'Railing', 'Sliding Door', 'Stair Case', 'Wall', 'Window'
]
TARGET_CLASSES_ROOM = {"bed", "sofa", "couch", "window", "door"}

# Behavior
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff")
MODE_OVERRIDE: Optional[str] = None  # set to "blueprint" or "room" to force a mode
# ----------------------------------------

# --------------- Utils ------------------
def _safe_mkdir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _save_counts_csv(counts: Dict[str, int], path: Path) -> Path:
    df = pd.DataFrame(list(counts.items()), columns=["Label", "Count"])
    _safe_mkdir(path.parent)
    df.to_csv(path, index=False)
    return path


def _detections_to_json(model: YOLO, boxes: Iterable) -> List[dict]:
    dets: List[dict] = []
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


# --------------- Heuristic mode detection ------------------
# Lightweight blueprint vs. photo discriminator using colorfulness and edge density.
# Returns "blueprint" or "room".

def _image_colorfulness(bgr: np.ndarray) -> float:
    # Hasler & Süsstrunk colorfulness metric
    (B, G, R) = cv2.split(bgr)
    rg = np.abs(R - G)
    yb = np.abs(0.5 * (R + G) - B)
    std_rg, std_yb = rg.std(), yb.std()
    mean_rg, mean_yb = rg.mean(), yb.mean()
    return np.sqrt(std_rg*2 + std_yb2) + 0.3 * np.sqrt(mean_rg2 + mean_yb*2)


def _edge_density(gray: np.ndarray) -> float:
    edges = cv2.Canny(gray, 100, 200)
    return float(edges.mean() / 255.0)  # fraction of edge pixels


def guess_mode_from_image(image_path: Path) -> str:
    bgr = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if bgr is None:
        # Fallback to room; also allows PIL-only formats
        return "room"
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    cf = _image_colorfulness(bgr)
    ed = _edge_density(gray)

    # Heuristics:
    # - Blueprints/floorplans tend to be low colorfulness, high edge density.
    # - Room photos tend to be higher colorfulness, lower relative edge density.
    # Thresholds tuned coarsely; adjust if needed for your data.
    if cf < 15.0 and ed > 0.08:
        return "blueprint"
    return "room"


# --------------- Processing: BLUEPRINT (2D) ------------------

def process_blueprint_image(model: YOLO, image_path: Path, out_dir: Path) -> Dict:
    image = Image.open(image_path)
    results = model.predict(image, conf=CONF_BLUEPRINT)
    r = results[0]

    # filter labels
    filtered = [b for b in r.boxes if model.names[int(b.cls)] in SELECTED_LABELS_2D]
    r.boxes = filtered

    # annotated image
    annotated_bgr = r.plot()
    _safe_mkdir(out_dir)
    out_img = out_dir / f"{image_path.stem}_detected_blueprint.jpg"
    cv2.imwrite(str(out_img), annotated_bgr)

    # JSON
    det_json = _detections_to_json(model, filtered)
    out_json = out_dir / f"{image_path.stem}_detections_blueprint.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(det_json, f, indent=2)

    # CSV counts
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


# --------------- Processing: ROOM PHOTO (3D scene) -----------

def process_room_photo(model: YOLO, image_path: Path, out_dir: Path) -> Dict:
    # Ultralytics inference API supports passing a path directly
    results = model(str(image_path))

    dets: List[dict] = []
    annotated_img_path = out_dir / f"{image_path.stem}_detected_room.jpg"
    _safe_mkdir(out_dir)

    for r in results:
        # collect and filter target classes
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
        # draw only filtered boxes
        r.boxes = filtered_boxes
        annotated_bgr = r.plot()
        cv2.imwrite(str(annotated_img_path), annotated_bgr)

    out_json = out_dir / f"{image_path.stem}_detections_room.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(dets, f, indent=2)

    # aggregate counts
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


# --------------- Dispatcher ------------------

def process_media(input_path: Path | str,
                  output_dir: Path | str = OUTPUT_DIR,
                  mode_override: Optional[str] = MODE_OVERRIDE,
                  blueprint_model_path: str = BLUEPRINT_MODEL_PATH,
                  room_model_path: str = ROOM_MODEL_PATH) -> List[Dict]:
    """
    Process a file or a folder of images. Automatically detects whether each image
    is a 2D blueprint/floor plan or a room photo unless mode_override is provided.

    Returns a list of dicts with output paths and counts per image.
    """
    in_path = Path(input_path)
    out_dir = Path(output_dir)

    # Prepare models (lazy-load only the ones we need)
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

    # Collect images to process
    images: List[Path] = []
    if in_path.is_file() and in_path.suffix.lower() in IMAGE_EXTS:
        images = [in_path]
    elif in_path.is_dir():
        images = [p for p in in_path.iterdir() if p.suffix.lower() in IMAGE_EXTS]
        if not images:
            raise FileNotFoundError(f"No images with extensions {IMAGE_EXTS} found in {in_path}")
    else:
        raise FileNotFoundError("INPUT_PATH must be an image file or a folder of images.")

    for img in images:
        # Decide mode
        mode = (mode_override or guess_mode_from_image(img)).lower()
        if mode not in {"blueprint", "3droom"}:
            raise ValueError("mode_override must be 'blueprint' or 'room'")

        if mode == "blueprint":
            model = _ensure_blueprint_model()
            res = process_blueprint_image(model, img, out_dir)
        else:
            model = _ensure_room_model()
            res = process_room_photo(model, img, out_dir)

        print(f"\nProcessed: {img} (mode: {mode})")
        print(f"  Annotated image: {res['annotated_image']}")
        print(f" Detections JSON: {res['json']}")
        print(f" Counts CSV:      {res['csv']}")
        if res.get("counts"):
            print("Summary:", ", ".join(f"{k}: {v}" for k, v in res["counts"].items()))
        else:
            print("No selected labels detected.")
        results.append(res)

    return results


# --------------- CLI ------------------
if __name__ == "__main__":

    process_media(INPUT_PATH, OUTPUT_DIR, "blueprint")