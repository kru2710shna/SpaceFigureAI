# perception.py
# Object detection + instance segmentation
# Prefers: GroundingDINO + Segment-Anything (SAM2)
# Falls back to: Ultralytics YOLOv8 (no masks) if DINO/SAM not available.

from __future__ import annotations
import os
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple

import numpy as np
import cv2

# --- Optional heavy deps (wrapped) ---
_HAVE_DINO = False
_HAVE_SAM = False

try:
    # GroundingDINO (pip install groundingdino; install per docs)
    from groundingdino.util.inference import Model as GroundingModel  # type: ignore
    _HAVE_DINO = True
except Exception:
    _HAVE_DINO = False

try:
    # SAM (pip install git+https://github.com/facebookresearch/segment-anything.git)
    from segment_anything import sam_model_registry, SamAutomaticMaskGenerator  # type: ignore
    _HAVE_SAM = True
except Exception:
    _HAVE_SAM = False

# YOLO fallback
try:
    from ultralytics import YOLO  # pip install ultralytics
except Exception as e:
    YOLO = None  # type: ignore


@dataclass
class DetInstance:
    label: str
    confidence: float
    bbox_xyxy: Tuple[float, float, float, float]
    mask: Optional[np.ndarray]  # HxW boolean array or None


DEFAULT_PROMPT = "window, door, fan, outlet, switch, sofa, bed, chair, table, lamp, tv, sink, toilet, shower, fridge"


def _ensure_dir(p: str) -> None:
    os.makedirs(p, exist_ok=True)


def _load_grounding_dino(model_repo_or_path: str = "ShilongLiu/GroundingDINO") -> Optional[GroundingModel]:
    if not _HAVE_DINO:
        return None
    try:
        # Model wrapper exposes .predict_with_classes(image, classes, box_threshold, text_threshold)
        model = GroundingModel(model_config_path=None, model_checkpoint_path=None, device="cuda" if _has_cuda() else "cpu", repo_id=model_repo_or_path)
        return model
    except Exception:
        return None


def _load_sam(checkpoint: Optional[str] = None):
    if not _HAVE_SAM:
        return None, None
    try:
        if checkpoint is None:
            # Prefer the smaller VIT-B if user hasn’t downloaded weights
            sam_type = "vit_b"
            # You can place a checkpoint at ./models/sam_vit_b.pth (optional)
            ckpt_default = "models/sam_vit_b.pth"
            checkpoint = ckpt_default if os.path.exists(ckpt_default) else None
        else:
            sam_type = "vit_h" if "vit_h" in checkpoint else "vit_b"

        sam = sam_model_registry[sam_type](checkpoint=checkpoint)
        sam.to("cuda" if _has_cuda() else "cpu")
        mask_gen = SamAutomaticMaskGenerator(sam)
        return sam, mask_gen
    except Exception:
        return None, None


def _has_cuda() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except Exception:
        return False


def detect_and_segment(
    image_path: str,
    text_prompt: str = DEFAULT_PROMPT,
    box_threshold: float = 0.25,
    text_threshold: float = 0.25,
) -> List[DetInstance]:
    """
    Returns a list of DetInstance with labels, conf, bbox and optional mask.
    """
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")
    h, w = img.shape[:2]

    # --- Preferred path: DINO (+ SAM masks if available) ---
    dino = _load_grounding_dino()
    if dino is not None:
        try:
            classes = [c.strip() for c in text_prompt.split(",") if c.strip()]
            boxes, logits, phrases = dino.predict_with_classes(
                image=cv2.cvtColor(img, cv2.COLOR_BGR2RGB),
                classes=classes,
                box_threshold=box_threshold,
                text_threshold=text_threshold,
            )
            boxes = np.array(boxes)  # xyxy normalized [0..1]
            dets: List[DetInstance] = []
            sam, mask_gen = _load_sam()

            for i, (b_norm, score, phrase) in enumerate(zip(boxes, logits, phrases)):
                x1 = float(b_norm[0] * w)
                y1 = float(b_norm[1] * h)
                x2 = float(b_norm[2] * w)
                y2 = float(b_norm[3] * h)
                crop_mask = None

                if mask_gen is not None:
                    # Quick local SAM mask around the box: crop then map back
                    x1i, y1i, x2i, y2i = map(lambda v: max(0, int(v)), [x1, y1, x2, y2])
                    roi = img[y1i:y2i, x1i:x2i]
                    if roi.size > 0:
                        masks = mask_gen.generate(roi)
                        if len(masks) > 0:
                            m = max(masks, key=lambda m_: m_["area"])  # pick largest
                            crop = m["segmentation"].astype(bool)
                            crop_mask = np.zeros((h, w), dtype=bool)
                            crop_mask[y1i:y1i+crop.shape[0], x1i:x1i+crop.shape[1]] = crop

                dets.append(
                    DetInstance(
                        label=str(phrase),
                        confidence=float(score),
                        bbox_xyxy=(x1, y1, x2, y2),
                        mask=crop_mask,
                    )
                )
            return dets
        except Exception:
            # fallthrough to YOLO
            pass

    # --- Fallback: YOLOv8 ---
    if YOLO is None:
        return []  # nothing available
    try:
        model = YOLO("yolov8n.pt")
        res = model(image_path)[0]
        dets: List[DetInstance] = []
        for b in res.boxes:
            cls = int(b.cls)
            label = model.names.get(cls, str(cls))
            conf = float(b.conf)
            x1, y1, x2, y2 = [float(v) for v in b.xyxy[0].tolist()]
            dets.append(DetInstance(label=label, confidence=conf, bbox_xyxy=(x1, y1, x2, y2), mask=None))
        return dets
    except Exception:
        return []
