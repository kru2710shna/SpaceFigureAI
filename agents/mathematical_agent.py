import json
import os
import sys
import argparse
from typing import List, Dict, Any, Optional, Union

# Fix Windows encoding issues
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())

def append_real_dimensions(
    detections: List[Dict[str, Any]],
    *,
    meters_per_pixel: Optional[float] = None,
    pixels_per_meter: Optional[float] = None,
    units_label: str = "m"
) -> List[Dict[str, Any]]:
    """
    Appends real-world dimensions to each detection, preserving all original fields.
    """
    assert (meters_per_pixel is not None) ^ (pixels_per_meter is not None), \
        "Provide exactly one: meters_per_pixel OR pixels_per_meter"

    if pixels_per_meter is not None:
        meters_per_pixel = 1.0 / float(pixels_per_meter)
    else:
        meters_per_pixel = float(meters_per_pixel)

    out: List[Dict[str, Any]] = []
    for det in detections:
        x1, y1, x2, y2 = [float(v) for v in det["bbox_xyxy"]]
        w_px  = max(0.0, x2 - x1)
        h_px  = max(0.0, y2 - y1)
        cx_px = (x1 + x2) * 0.5
        cy_px = (y1 + y2) * 0.5

        w_m = w_px * meters_per_pixel
        h_m = h_px * meters_per_pixel
        area_m2 = w_m * h_m

        label_l = str(det.get("label", "")).lower()
        inferred: Dict[str, Union[float, int, str]] = {}

        if label_l == "wall":
            length_m = max(w_m, h_m)
            thickness_m = min(w_m, h_m)
            inferred[f"wall_length_{units_label}"] = length_m
            inferred[f"wall_thickness_{units_label}"] = thickness_m
        elif label_l in {"door", "window"}:
            opening_span_m = max(w_m, h_m)
            inferred[f"opening_span_{units_label}"] = opening_span_m

        augmented = {
            **det,
            "bbox_wh_px": [w_px, h_px],
            "bbox_center_px": [cx_px, cy_px],
            f"bbox_wh_{units_label}": [w_m, h_m],
            f"area_{units_label}2": area_m2,
            **inferred,
        }
        out.append(augmented)

    return out


# ---- MAIN EXECUTION ----
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Add real-world dimensions to detection JSON")
    parser.add_argument("input_path", help="Path to input JSON file with detections")
    parser.add_argument("--pixels-per-meter", type=float, help="Pixels per meter conversion factor")
    parser.add_argument("--meters-per-pixel", type=float, help="Meters per pixel conversion factor")
    parser.add_argument("--output-path", help="Output path (optional, defaults to detections_with_dimensions.json)")
    parser.add_argument("--units", default="m", help="Units label (default: m)")
    
    args = parser.parse_args()

    # Validate input
    if not os.path.exists(args.input_path):
        print(f"ERROR: Input file not found: {args.input_path}", file=sys.stderr)
        sys.exit(1)

    if not args.pixels_per_meter and not args.meters_per_pixel:
        print("ERROR: Must provide either --pixels-per-meter or --meters-per-pixel", file=sys.stderr)
        sys.exit(1)

    if args.pixels_per_meter and args.meters_per_pixel:
        print("ERROR: Provide only one: --pixels-per-meter OR --meters-per-pixel", file=sys.stderr)
        sys.exit(1)

    # Determine output path
    if args.output_path:
        output_path = args.output_path
    else:
        input_dir = os.path.dirname(args.input_path)
        output_path = os.path.join(input_dir, "detections_with_dimensions.json")
    
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)

    try:
        # Load detections
        with open(args.input_path, "r", encoding='utf-8') as f:
            detections = json.load(f)

        if not isinstance(detections, list):
            print(f"ERROR: Expected JSON array, got {type(detections)}", file=sys.stderr)
            sys.exit(1)

        # Append real dimensions
        kwargs = {"units_label": args.units}
        if args.pixels_per_meter:
            kwargs["pixels_per_meter"] = args.pixels_per_meter
        else:
            kwargs["meters_per_pixel"] = args.meters_per_pixel

        updated_detections = append_real_dimensions(detections, **kwargs)

        # Save updated JSON
        with open(output_path, "w", encoding='utf-8') as f:
            json.dump(updated_detections, f, indent=2)

        print(f"SUCCESS: Updated JSON saved at: {output_path}")
        sys.exit(0)

    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
# import json
# import os
# from typing import List, Dict, Any, Optional, Union

# def append_real_dimensions(
#     detections: List[Dict[str, Any]],
#     *,
#     meters_per_pixel: Optional[float] = None,
#     pixels_per_meter: Optional[float] = None,
#     units_label: str = "m"
# ) -> List[Dict[str, Any]]:
#     """
#     Appends real-world dimensions to each detection, preserving all original fields.
#     """
#     assert (meters_per_pixel is not None) ^ (pixels_per_meter is not None), \
#         "Provide exactly one: meters_per_pixel OR pixels_per_meter"

#     if pixels_per_meter is not None:
#         meters_per_pixel = 1.0 / float(pixels_per_meter)
#     else:
#         meters_per_pixel = float(meters_per_pixel)

#     out: List[Dict[str, Any]] = []
#     for det in detections:
#         x1, y1, x2, y2 = [float(v) for v in det["bbox_xyxy"]]
#         w_px  = max(0.0, x2 - x1)
#         h_px  = max(0.0, y2 - y1)
#         cx_px = (x1 + x2) * 0.5
#         cy_px = (y1 + y2) * 0.5

#         w_m = w_px * meters_per_pixel
#         h_m = h_px * meters_per_pixel
#         area_m2 = w_m * h_m

#         label_l = str(det.get("label", "")).lower()
#         inferred: Dict[str, Union[float, int, str]] = {}

#         if label_l == "wall":
#             length_m = max(w_m, h_m)
#             thickness_m = min(w_m, h_m)
#             inferred[f"wall_length_{units_label}"] = length_m
#             inferred[f"wall_thickness_{units_label}"] = thickness_m
#         elif label_l in {"door", "window"}:
#             opening_span_m = max(w_m, h_m)
#             inferred[f"opening_span_{units_label}"] = opening_span_m

#         augmented = {
#             **det,
#             "bbox_wh_px": [w_px, h_px],
#             "bbox_center_px": [cx_px, cy_px],
#             f"bbox_wh_{units_label}": [w_m, h_m],
#             f"area_{units_label}2": area_m2,
#             **inferred,
#         }
#         out.append(augmented)

#     return out


# # ---- MAIN EXECUTION ----
# if __name__ == "__main__":
#     # Input and output paths
#     input_path = os.path.join("agents", "outputs", "image_detections_blueprint.json")  # change if your file is named differently
#     output_path = os.path.join("agents", "outputs", "detections_with_dimensions.json")
#     os.makedirs(os.path.dirname(output_path), exist_ok=True)

#     # --- Load detections ---
#     with open(input_path, "r") as f:
#         detections = json.load(f)

#     # --- Append real dimensions ---
#     # Example: 200 pixels = 1 meter
#     updated_detections = append_real_dimensions(detections, pixels_per_meter=200.0)

#     # --- Save updated JSON ---
#     with open(output_path, "w") as f:
#         json.dump(updated_detections, f, indent=2)

#     print(f"✅ Updated JSON saved at: {output_path}")
