# depth_estimation.py
# Dense monocular depth via MiDaS (DPT-Hybrid). CPU/GPU auto-detect.

from __future__ import annotations
import numpy as np
import cv2
from typing import Tuple
from pathlib import Path
import torch
from PIL import Image


def estimate_depth(image_path: str) -> Tuple[np.ndarray, np.ndarray]:
    """
    Estimate dense monocular depth from an RGB image using MiDaS.

    Returns:
        depth_norm: normalized [0,1]
        depth_raw: raw float32 depth
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Load model + transform
    model = torch.hub.load("intel-isl/MiDaS", "DPT_Hybrid").to(device).eval()
    midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
    transform = midas_transforms.dpt_transform

    # Load image
    img_pil = Image.open(image_path).convert("RGB")

    # ✅ Handle both transform types safely (old/new MiDaS versions)
    try:
        # Case 1: expects PIL Image
        input_tensor = transform(img_pil).to(device)
    except Exception:
        # Case 2: expects normalized numpy array
        np_img = np.array(img_pil).astype(np.float32) / 255.0
        input_tensor = transform(np_img).to(device)

    # ✅ Add batch dimension if missing
    if input_tensor.ndim == 3:
        input_tensor = input_tensor.unsqueeze(0)

    # Inference
    with torch.no_grad():
        prediction = model(input_tensor)
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=img_pil.size[::-1],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

    depth = prediction.cpu().numpy()
    depth_norm = (depth - depth.min()) / (depth.max() - depth.min() + 1e-6)

    return depth_norm.astype("float32"), depth.astype("float32")


def save_depth_visual(depth_norm: np.ndarray, out_path: str) -> None:
    """Save normalized depth map as colorized image."""
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    colored = (depth_norm * 255).astype("uint8")
    colored = cv2.applyColorMap(colored, cv2.COLORMAP_MAGMA)
    cv2.imwrite(str(out_path), colored)
    print(f"✅ Depth visualization saved to {out_path}")
