# main.py
# Orchestrator: runs perception → depth → geometry → orientation → scene JSON.
# Usage (backend): python -m agents.tour_guide_agent.main --input <img_or_dir> --output outputs [--camera_height_m 1.5 --fov_deg 90]

from __future__ import annotations
import argparse, sys, json, os
from pathlib import Path
from typing import List, Dict, Any

from .perception import detect_and_segment, DetInstance
from .depth_estimation import estimate_depth, save_depth_visual
from .geometry import plane_stats_from_depth, estimate_dimensions
from .orientation import estimate_orientation
from .scene_builder import to_scene_json, render_overlay

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff")


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _list_images(p: Path) -> List[Path]:
    if p.is_file() and p.suffix.lower() in IMAGE_EXTS:
        return [p]
    if p.is_dir():
        return sorted([x for x in p.iterdir() if x.suffix.lower() in IMAGE_EXTS])
    raise FileNotFoundError(f"Invalid input path: {p}")


def run_one(
    img_path: Path,
    out_dir: Path,
    camera_height_m: float | None,
    fov_deg: float | None,
    prompt: str | None,
) -> Dict[str, Any]:
    _ensure_dir(out_dir)
    # 1) detection + optional masks
    dets: List[DetInstance] = detect_and_segment(str(img_path), text_prompt=prompt or "")

    # 2) depth
    depth_norm, depth_raw = estimate_depth(str(img_path))
    depth_vis_path = str(out_dir / f"{img_path.stem}_depth.png")
    save_depth_visual(depth_norm, depth_vis_path)

    # 3) geometry + rough dimensions
    geom_stats = plane_stats_from_depth(depth_norm)
    dim_stats = estimate_dimensions(depth_norm, camera_height_m=camera_height_m, fov_deg=fov_deg)

    # 4) orientation
    orient_stats = estimate_orientation(str(img_path))

    # 5) JSON + overlay
    scene = to_scene_json(str(img_path), dets, {
        "mean": float(depth_norm.mean()),
        "std": float(depth_norm.std()),
        "vis_path": depth_vis_path,
    }, geom_stats, dim_stats, orient_stats)

    overlay_path = str(out_dir / f"{img_path.stem}_annotated.jpg")
    render_overlay(str(img_path), dets, depth_map_vis_path=depth_vis_path, out_path=overlay_path)
    scene["annotated_image"] = overlay_path

    # Small convenience: counts by label
    counts: Dict[str, int] = {}
    for d in dets:
        counts[d.label] = counts.get(d.label, 0) + 1
    scene["counts"] = counts

    return scene


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="Image file or directory")
    ap.add_argument("--output", required=True, help="Output directory")
    ap.add_argument("--camera_height_m", type=float, default=None)
    ap.add_argument("--fov_deg", type=float, default=None)
    ap.add_argument("--prompt", type=str, default=None, help="Custom detection prompt for DINO")
    args = ap.parse_args()

    in_path = Path(args.input)
    out_dir = Path(args.output)
    _ensure_dir(out_dir)

    images = _list_images(in_path)
    results: List[Dict[str, Any]] = []
    for img in images:
        try:
            scene = run_one(
                img_path=img,
                out_dir=out_dir,
                camera_height_m=args.camera_height_m,
                fov_deg=args.fov_deg,
                prompt=args.prompt,
            )
            results.append(scene)
        except Exception as e:
            results.append({"image": str(img), "error": str(e)})

    sys.stdout.write(json.dumps(results, indent=2))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
