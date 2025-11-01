# """
# Tour Guide Agent
# ================
# Performs unified detection for:
# 1. 2D architectural plans (blueprints / floorplans)
# 2. 3D real-world room photos

# Automatically selects the detection mode using heuristics based on
# colorfulness and edge density, or accepts explicit mode override
# ("blueprint" | "room").

# Outputs:
# - Annotated detection image (saved in outputs/)
# - JSON detections (label, confidence, bbox)
# - CSV counts summary
# """

# from __future__ import annotations
# import json
# from pathlib import Path
# from typing import List, Dict, Iterable, Optional

# import cv2
# import numpy as np
# import pandas as pd
# from PIL import Image
# from ultralytics import YOLO
# import argparse
# import re, sys

# # ===============================================================
# # ----------------------- CONFIGURATION -------------------------
# # ===============================================================

# BLUEPRINT_MODEL_PATH = "models/best.pt"  # trained floorplan model
# ROOM_MODEL_PATH = "models/yolov8n.pt"  # general object detector
# OUTPUT_DIR = Path("outputs")

# CONF_BLUEPRINT = 0.25
# CONF_ROOM = 0.25

# SELECTED_LABELS_2D = [
#     "Column",
#     "Curtain Wall",
#     "Dimension",
#     "Door",
#     "Railing",
#     "Sliding Door",
#     "Stair Case",
#     "Wall",
#     "Window",
# ]

# TARGET_CLASSES_ROOM = {
#     "bed",
#     "sofa",
#     "chair",
#     "tv",
#     "refrigerator",
#     "potted plant",
#     "dining table",
#     "person",
#     "clock",
#     "laptop",
#     "microwave",
#     "oven",
#     "sink",
#     "toilet",
# }

# IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff")
# MODE_OVERRIDE: Optional[str] = None


# # ===============================================================
# # --------------------------- UTILITIES -------------------------
# # ===============================================================


# def _safe_mkdir(p: Path) -> None:
#     """Safely create directories if not already existing."""
#     p.mkdir(parents=True, exist_ok=True)


# def _save_counts_csv(counts: Dict[str, int], path: Path) -> Path:
#     df = pd.DataFrame(list(counts.items()), columns=["Label", "Count"])
#     _safe_mkdir(path.parent)
#     df.to_csv(path, index=False)
#     return path


# def _detections_to_json(model: YOLO, boxes: Iterable) -> List[dict]:
#     dets = []
#     for box in boxes:
#         dets.append(
#             {
#                 "label": model.names[int(box.cls)],
#                 "confidence": float(box.conf),
#                 "bbox_xyxy": [float(v) for v in box.xyxy[0].tolist()],
#             }
#         )
#     return dets


# def _count_detected_objects(model: YOLO, boxes: Iterable) -> Dict[str, int]:
#     counts: Dict[str, int] = {}
#     for box in boxes:
#         label = model.names[int(box.cls)]
#         counts[label] = counts.get(label, 0) + 1
#     return counts


# # ===============================================================
# # ----------- HEURISTIC MODE DETECTION (2D vs 3D) ---------------
# # ===============================================================


# def _image_colorfulness(bgr: np.ndarray) -> float:
#     """Compute Hasler & Süsstrunk colorfulness metric."""
#     (B, G, R) = cv2.split(bgr)
#     rg = np.abs(R - G)
#     yb = np.abs(0.5 * (R + G) - B)
#     std_rg, std_yb = rg.std(), yb.std()
#     mean_rg, mean_yb = rg.mean(), yb.mean()
#     return np.sqrt(std_rg**2 + std_yb**2) + 0.3 * np.sqrt(mean_rg**2 + mean_yb**2)


# def _edge_density(gray: np.ndarray) -> float:
#     """Compute edge density via Canny edge detection."""
#     edges = cv2.Canny(gray, 100, 200)
#     return float(edges.mean() / 255.0)


# def guess_mode_from_image(image_path: Path) -> str:
#     """Lightweight discriminator between blueprint and room photo."""
#     bgr = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
#     if bgr is None:
#         return "room"  # fallback

#     gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
#     cf = _image_colorfulness(bgr)
#     ed = _edge_density(gray)

#     # Heuristic thresholds
#     if cf < 25.0 and ed > 0.05:
#         return "blueprint"
#     return "room"


# # ===============================================================
# # -------- Graceful Handling When Blueprint Model Missing --------
# # ===============================================================


# def _load_blueprint_model_safely(path: str) -> Optional[YOLO]:
#     """Load blueprint model if available, else skip gracefully."""
#     p = Path(path)
#     if not p.exists():
#         print(
#             f"⚠️ Blueprint model not found at {p}. Skipping blueprint mode.",
#             file=sys.stderr,
#         )
#         return None
#     try:
#         model = YOLO(str(p))
#         print(
#             f"✅ Blueprint model loaded with {len(model.names)} classes",
#             file=sys.stderr,
#         )
#         return model
#     except Exception as e:
#         print(f"⚠️ Failed to load blueprint model: {e}", file=sys.stderr)
#         return None


# # ===============================================================
# # ------------------- 2D BLUEPRINT DETECTION --------------------
# # ===============================================================


# def process_blueprint_image(model: YOLO, image_path: Path, out_dir: Path) -> Dict:
#     """Run 2D blueprint/floorplan detection."""
#     image = Image.open(image_path)
#     results = model.predict(image, conf=CONF_BLUEPRINT)
#     r = results[0]

#     filtered = [b for b in r.boxes if model.names[int(b.cls)] in SELECTED_LABELS_2D]
#     r.boxes = filtered

#     annotated_bgr = r.plot()
#     _safe_mkdir(out_dir)
#     out_img = out_dir / f"{image_path.stem}_detected_blueprint.jpg"
#     cv2.imwrite(str(out_img), annotated_bgr)

#     det_json = _detections_to_json(model, filtered)
#     out_json = out_dir / f"{image_path.stem}_detections_blueprint.json"
#     with open(out_json, "w", encoding="utf-8") as f:
#         json.dump(det_json, f, indent=2)

#     counts = _count_detected_objects(model, filtered)
#     out_csv = out_dir / f"{image_path.stem}_counts_blueprint.csv"
#     _save_counts_csv(counts, out_csv)

#     return {
#         "mode": "blueprint",
#         "annotated_image": str(out_img),
#         "json": str(out_json),
#         "csv": str(out_csv),
#         "counts": counts,
#     }


# # ===============================================================
# # ------------------- 3D ROOM PHOTO DETECTION -------------------
# # ===============================================================


# def process_room_photo(model: YOLO, image_path: Path, out_dir: Path) -> Dict:
#     """Run real-world room photo detection."""
#     results = model(str(image_path))

#     dets = []
#     annotated_img_path = out_dir / f"{image_path.stem}_detected_room.jpg"
#     _safe_mkdir(out_dir)

#     for r in results:
#         filtered_boxes = []
#         for box in r.boxes:
#             cls_name = model.names[int(box.cls)]
#             if cls_name in TARGET_CLASSES_ROOM:
#                 dets.append(
#                     {
#                         "label": cls_name,
#                         "confidence": float(box.conf),
#                         "bbox_xyxy": [float(x) for x in box.xyxy[0].tolist()],
#                     }
#                 )
#                 filtered_boxes.append(box)

#         r.boxes = filtered_boxes
#         annotated_bgr = r.plot()
#         cv2.imwrite(str(annotated_img_path), annotated_bgr)

#     out_json = out_dir / f"{image_path.stem}_detections_room.json"
#     with open(out_json, "w", encoding="utf-8") as f:
#         json.dump(dets, f, indent=2)

#     counts: Dict[str, int] = {}
#     for d in dets:
#         counts[d["label"]] = counts.get(d["label"], 0) + 1

#     out_csv = out_dir / f"{image_path.stem}_counts_room.csv"
#     _save_counts_csv(counts, out_csv)

#     return {
#         "mode": "room",
#         "annotated_image": str(annotated_img_path),
#         "json": str(out_json),
#         "csv": str(out_csv),
#         "counts": counts,
#     }


# # ===============================================================
# # ------------------------- MAIN ENTRY --------------------------
# # ===============================================================


# def process_media(
#     input_path: Path | str,
#     output_dir: Path | str = OUTPUT_DIR,
#     mode_override: Optional[str] = MODE_OVERRIDE,
#     blueprint_model_path: str = BLUEPRINT_MODEL_PATH,
#     room_model_path: str = ROOM_MODEL_PATH,
# ) -> List[Dict]:
#     """
#     Main callable function used by backend/index.js.
#     Automatically decides between 2D or 3D detection,
#     executes the respective pipeline, and returns a list of results.
#     """

#     in_path = Path(input_path)
#     out_dir = Path(output_dir)

#     blueprint_model: Optional[YOLO] = None
#     room_model: Optional[YOLO] = None

#     def _ensure_blueprint_model() -> YOLO:
#         nonlocal blueprint_model
#         if blueprint_model is None:
#             blueprint_model = _load_blueprint_model_safely(blueprint_model_path)
#         return blueprint_model

#     def _ensure_room_model() -> YOLO:
#         nonlocal room_model
#         if room_model is None:
#             print(
#                 f"🔍 Loading YOLOv8 model from {room_model_path} ...", file=sys.stderr
#             )
#             room_model = YOLO(room_model_path)
#             print(
#                 f"✅ Model loaded with {len(room_model.names)} classes", file=sys.stderr
#             )
#         return room_model

#     results: List[Dict] = []

#     if in_path.is_file() and in_path.suffix.lower() in IMAGE_EXTS:
#         images = [in_path]
#     elif in_path.is_dir():
#         images = [p for p in in_path.iterdir() if p.suffix.lower() in IMAGE_EXTS]
#         if not images:
#             raise FileNotFoundError(f"No valid images found in {in_path}")
#     else:
#         raise FileNotFoundError("Invalid input path; must be image or directory.")

#     for img in images:
#         mode_guess = (mode_override or guess_mode_from_image(img)).lower()
#         results_per_mode = []
#         for mode in [mode_guess, "room" if mode_guess == "blueprint" else "blueprint"]:
#             model = (
#                 _ensure_room_model() if mode == "room" else _ensure_blueprint_model()
#             )
#             try:
#                 res = (
#                     process_room_photo(model, img, out_dir)
#                     if mode == "room"
#                     else process_blueprint_image(model, img, out_dir)
#                 )
#                 results_per_mode.append(res)
#             except Exception as e:
#                 print(f"⚠️ Skipping {mode} mode: {e}", file=sys.stderr)
#         results.extend(results_per_mode)
#         if mode not in {"blueprint", "room"}:
#             raise ValueError("mode_override must be 'blueprint' or 'room'")

#         if mode == "blueprint":
#             model = _ensure_blueprint_model()
#             if model is None:
#                 print(
#                     f"⚠️ Skipping blueprint mode since model missing, falling back to room.",
#                     file=sys.stderr,
#                 )
#                 model = _ensure_room_model()
#                 res = process_room_photo(model, img, out_dir)
#             else:
#                 res = process_blueprint_image(model, img, out_dir)

#         results.append(res)

#     return results


# if __name__ == "__main__":
#     parser = argparse.ArgumentParser()
#     parser.add_argument("--input", required=True)
#     parser.add_argument("--output", required=True)
#     parser.add_argument("--mode", default=None, help="Force mode: room or blueprint")
#     args = parser.parse_args()

#     try:
#         # Run detection
#         results = process_media(args.input, args.output, args.mode)

#         # ✅ Add fallback visualization when nothing detected
#         for r in results:
#             if not r["counts"]:
#                 img = cv2.imread(str(args.input))
#                 if img is not None:
#                     msg = "⚠️ No detections found"
#                     cv2.putText(
#                         img,
#                         msg,
#                         (30, 60),
#                         cv2.FONT_HERSHEY_SIMPLEX,
#                         1.5,
#                         (0, 255, 255),
#                         3,
#                         cv2.LINE_AA,
#                     )
#                     fallback_img = (
#                         Path(r["annotated_image"]).parent
#                         / f"{Path(args.input).stem}_nodet.png"
#                     )
#                     cv2.imwrite(str(fallback_img), img)
#                     r["annotated_image"] = str(fallback_img)

#         # ✅ Return clean JSON
#         sys.stdout.write(json.dumps(results, indent=2))
#         sys.stdout.flush()

#     except Exception as e:
#         print(json.dumps({"error": str(e)}))
#         sys.exit(1)
