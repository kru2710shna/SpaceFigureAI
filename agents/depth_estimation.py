import torch
import cv2
import numpy as np
from PIL import Image
import argparse, os


def generate_depth(input_path, output_path):
    print(f"🔹 Input: {input_path}")
    print(f"🔹 Output: {output_path}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"⚙️ Using device: {device}")

    # ✅ Load MiDaS model
    model_type = "DPT_Large"  # "DPT_Hybrid" for faster CPU inference
    model = torch.hub.load("intel-isl/MiDaS", model_type)
    model.to(device)
    model.eval()

    # ✅ Load transforms
    midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
    if "DPT" in model_type:
        transform = midas_transforms.dpt_transform
    else:
        transform = midas_transforms.small_transform

    # ✅ Load + preprocess image
    img = Image.open(input_path).convert("RGB")
    img = np.array(img)

    # 🔧 Apply MiDaS transform correctly
    input_batch = transform(img).to(device)

    with torch.no_grad():
        prediction = model(input_batch)

        # Resize to original image dimensions
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=img.shape[:2],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

        depth = prediction.cpu().numpy()

    # ✅ Normalize depth map for visualization
    # Normalize depth and boost contrast
    depth = (depth - depth.min()) / (depth.max() - depth.min())
    depth = np.power(depth, 1.8)  # gamma adjustment to exaggerate relief
    depth_uint8 = (depth * 255).astype("uint8")
    cv2.imwrite(output_path, depth_uint8)
    print(f"✅ Depth map saved to {output_path}")

    # Optionally: also save a colorized version (for debugging)
    colorized_path = output_path.replace(".png", "_color.png")
    depth_color = cv2.applyColorMap(depth_uint8, cv2.COLORMAP_JET)
    cv2.imwrite(colorized_path, depth_color)
    print(f"🌈 Colorized depth map saved to {colorized_path}")


# ---------- CLI ----------
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    generate_depth(args.input, args.output)
