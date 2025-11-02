"""
Tour Guide Agent – detects 2D blueprints vs 3D room photos
and exports annotated image + JSON + CSV counts.

Works with PyTorch >= 2.6 (safe-load) via temporary allowlist + legacy load.
"""

from __future__ import annotations
import os, json
from pathlib import Path
from typing import List, Dict, Optional, Iterable

import cv2
import numpy as np
import pandas as pd
from PIL import Image

# --- Torch + YOLO (with PyTorch 2.6 safe-load handling) ---
import torch
import torch.serialization
import torch.nn as nn
import ultralytics.nn.tasks as tasks
from ultralytics import YOLO

# Allow-list common classes used inside YOLO checkpoints (safe with official weights)
try:
    torch.serialization.add_safe_globals([
        tasks.DetectionModel,
        YOLO,
        nn.Sequential,
        nn.Module, nn.Conv2d, nn.BatchNorm2d, nn.SiLU, nn.ReLU, nn.LeakyReLU, nn.Sigmoid,
        nn.MaxPool2d, nn.Upsample, nn.Linear, nn.Dropout, nn.Identity
    ])
except Exception:
    pass

def _load_yolo_weights(path: Path) -> YOLO:
    """
    Load YOLO weights under PyTorch 2.6+:
    - temporarily force torch.load(weights_only=False)
    - restore original torch.load afterwards
    """
    orig_load = torch.load
    def patched(*args, **kwargs):
        kwargs["weights_only"] = False
        return orig_load(*args, **kwargs)
    torch.load = patched
    try:
        return YOLO(str(path))
    finally:
        torch.load = orig_load

# ---------------- PATH CONFIG ----------------
ROOT_DIR = Path(__file__).resolve().parents[1]        # .../SpaceFigureAI
BACKEND_DIR = ROOT_DIR / "backend"

BLUEPRINT_MODEL_PATH = BACKEND_DIR / "models" / "best.pt"     # your downloaded best.pt
ROOM_MODEL_PATH      = BACKEND_DIR / "models" / "yolov8n.pt"  # generic detector
FALLBACK_MODEL_PATH  = ROOM_MODEL_PATH                         # fallback if best.pt fails

OUTPUT_DIR = ROOT_DIR / "agents" / "outputs"

CONF_BLUEPRINT = 0.25
CONF_ROOM      = 0.25

SELECTED_LABELS_2D = [
    "Column","Curtain Wall","Dimension","Door",
    "Railing","Sliding Door","Stair Case","Wall","Window"
]
TARGET_CLASSES_ROOM = {"bed","sofa","couch","window","door"}
IMAGE_EXTS = (".jpg",".jpeg",".png",".bmp",".tif",".tiff")

# ---------------- UTILITIES ----------------
def _safe_mkdir(p: Path): p.mkdir(parents=True, exist_ok=True)

def _save_counts_csv(counts: Dict[str,int], path: Path) -> Path:
    df = pd.DataFrame(list(counts.items()), columns=["Label","Count"])
    _safe_mkdir(path.parent); df.to_csv(path, index=False); return path

def _detections_to_json(model: YOLO, boxes: Iterable):
    return [
        {
            "label": model.names[int(b.cls)],
            "confidence": float(b.conf),
            "bbox_xyxy": [float(v) for v in b.xyxy[0].tolist()],
        } for b in boxes
    ]

def _count_detected_objects(model: YOLO, boxes: Iterable):
    counts = {}
    for b in boxes:
        name = model.names[int(b.cls)]
        counts[name] = counts.get(name, 0) + 1
    return counts

# ---------------- MODE DETECTION ----------------
def _image_colorfulness(bgr: np.ndarray) -> float:
    (B,G,R) = cv2.split(bgr)
    rg = np.abs(R-G); yb = np.abs(0.5*(R+G)-B)
    return np.sqrt(rg.std()**2 + yb.std()**2) + 0.3*np.sqrt(rg.mean()**2 + yb.mean()**2)

def _edge_density(gray: np.ndarray) -> float:
    return float(cv2.Canny(gray,100,200).mean()/255.0)

def guess_mode_from_image(image_path: Path) -> str:
    bgr = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if bgr is None: return "room"
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cf, ed = _image_colorfulness(bgr), _edge_density(gray)
    return "blueprint" if (cf < 15.0 and ed > 0.08) else "room"

# ---------------- BLUEPRINT PIPELINE ----------------
def process_blueprint_image(model: YOLO, image_path: Path, out_dir: Path) -> Dict:
    img = Image.open(image_path)
    res = model.predict(img, conf=CONF_BLUEPRINT)[0]
    boxes = [b for b in res.boxes if model.names[int(b.cls)] in SELECTED_LABELS_2D]
    res.boxes = boxes

    _safe_mkdir(out_dir)
    out_img  = out_dir / f"{image_path.stem}_detected_blueprint.jpg"
    out_json = out_dir / f"{image_path.stem}_detections_blueprint.json"
    out_csv  = out_dir / f"{image_path.stem}_counts_blueprint.csv"

    cv2.imwrite(str(out_img), res.plot())
    json.dump(_detections_to_json(model, boxes), open(out_json,"w"), indent=2)
    _save_counts_csv(_count_detected_objects(model, boxes), out_csv)

    return {
        "mode":"blueprint",
        "annotated_image":str(out_img),
        "json":str(out_json),
        "csv":str(out_csv),
        "counts":_count_detected_objects(model, boxes),
    }

# ---------------- ROOM PIPELINE ----------------
def process_room_photo(model: YOLO, image_path: Path, out_dir: Path) -> Dict:
    res_list = model(str(image_path))
    dets, filtered_all = [], []
    _safe_mkdir(out_dir)
    out_img  = out_dir / f"{image_path.stem}_detected_room.jpg"
    out_json = out_dir / f"{image_path.stem}_detections_room.json"
    out_csv  = out_dir / f"{image_path.stem}_counts_room.csv"

    for r in res_list:
        keep=[]
        for b in r.boxes:
            n = model.names[int(b.cls)]
            if n in TARGET_CLASSES_ROOM:
                keep.append(b)
                dets.append({
                    "label":n,
                    "confidence":float(b.conf),
                    "bbox_xyxy":[float(x) for x in b.xyxy[0].tolist()]
                })
        r.boxes = keep
        filtered_all.extend(keep)
        cv2.imwrite(str(out_img), r.plot())

    json.dump(dets, open(out_json,"w"), indent=2)
    _save_counts_csv(_count_detected_objects(model, filtered_all), out_csv)

    return {
        "mode":"room",
        "annotated_image":str(out_img),
        "json":str(out_json),
        "csv":str(out_csv),
        "counts":_count_detected_objects(model, filtered_all),
    }

# ---------------- DISPATCHER ----------------
def process_media(input_path: Path|str,
                  output_dir: Path|str = OUTPUT_DIR,
                  mode_override: Optional[str] = None):
    in_path, out_dir = Path(input_path), Path(output_dir)
    _safe_mkdir(out_dir)

    # Load models with safe loader + fallback for blueprint
    try:
        blueprint_model = _load_yolo_weights(BLUEPRINT_MODEL_PATH)
    except Exception as e:
        print(f"⚠️ Failed to load blueprint model {BLUEPRINT_MODEL_PATH.name}: {e}")
        print("➡️ Falling back to:", FALLBACK_MODEL_PATH.name)
        blueprint_model = _load_yolo_weights(FALLBACK_MODEL_PATH)

    room_model = _load_yolo_weights(ROOM_MODEL_PATH)

    mode = (mode_override or guess_mode_from_image(in_path)).lower()
    if mode not in {"blueprint","room"}:
        raise ValueError("mode_override must be 'blueprint' or 'room'")

    res  = process_blueprint_image(blueprint_model,in_path,out_dir) if mode=="blueprint" \
           else process_room_photo(room_model,in_path,out_dir)

    print(f"✅ Processed {in_path} as {mode}")
    return [res]

# ---------------- CLI ENTRY ----------------
if __name__ == "__main__":
    uploads = BACKEND_DIR / "uploads"
    imgs = sorted(
        [p for p in uploads.iterdir() if p.suffix.lower() in IMAGE_EXTS],
        key=lambda f:f.stat().st_mtime, reverse=True
    )
    if imgs:
        latest = imgs[0]
        print(f"🧠 Using latest upload: {latest}")
        process_media(latest, OUTPUT_DIR, "blueprint")
    else:
        print("⚠️ No images found in uploads directory.")
