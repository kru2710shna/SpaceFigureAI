#!/usr/bin/env python3
"""
make_furniture_dataset.py
Generate a synthetic furniture_dataset.csv suitable for the build_fit_catalog.py script.

Usage:
  python make_furniture_dataset.py --out data/furniture_dataset.csv --n 100 --seed 42
"""

import argparse
import csv
import os
import random
from pathlib import Path

TYPES = [
    "bed", "sofa", "chair", "table", "desk", "lamp", "wardrobe", "cabinet", "dresser", "bookshelf"
]

# Aesthetic-ish styles; your enrichment infers 'aesthetic' later—these serve as inputs
STYLES = [
    "modern", "contemporary", "scandinavian", "japandi", "industrial",
    "midcentury", "rustic", "farmhouse", "traditional", "colonial",
    "transitional", "coastal", "art deco", "minimal"
]

COLORS = [
    "white", "black", "beige", "gray", "charcoal", "oak", "walnut",
    "brown", "cream", "sand", "navy", "olive", "teal"
]

MATERIALS = [
    "oak", "walnut", "pine", "birch", "linen", "cotton", "leather", "velvet",
    "fabric", "metal", "steel", "iron", "aluminum", "marble", "glass",
    "rattan", "bamboo", "jute", "concrete"
]

SHAPES = [
    "rectangular", "round", "oval", "square", "slim", "low-profile",
    "wingback", "channel-tufted", "splayed-legs", "pedestal-base"
]

DETAILS_COMMON = [
    "clean lines", "soft edges", "tall headboard", "storage drawers",
    "floating design", "wall-mounted", "3-seat", "sectional chaise",
    "extendable", "coffee table", "glass doors", "open shelving",
    "task lighting", "matte finish", "brushed brass", "live-edge",
    "ribbed texture", "cane panels"
]

ROOM_TYPES = ["living", "bedroom", "dining", "kids", "office", "studio"]

PRICE_RANGES = ["budget", "standard", "premium", "luxury"]

# Details that fit better for specific types (to increase realism)
TYPE_DETAILS_HINTS = {
    "bed": ["tall headboard", "storage drawers", "low-profile", "channel-tufted"],
    "sofa": ["3-seat", "sectional chaise", "low-profile", "channel-tufted"],
    "chair": ["wingback", "slim", "splayed-legs"],
    "table": ["extendable", "coffee table", "live-edge", "pedestal-base"],
    "desk": ["storage drawers", "slim", "matte finish"],
    "lamp": ["task lighting", "matte finish", "tall"],
    "wardrobe": ["glass doors", "cane panels"],
    "cabinet": ["glass doors", "matte finish", "cane panels"],
    "dresser": ["storage drawers", "matte finish"],
    "bookshelf": ["open shelving", "wall-mounted"]
}

# Shapes that pair nicely with types
TYPE_SHAPE_HINTS = {
    "bed": ["rectangular", "low-profile"],
    "sofa": ["rectangular", "low-profile"],
    "chair": ["wingback", "slim", "rectangular"],
    "table": ["rectangular", "round", "oval", "square"],
    "desk": ["rectangular", "slim"],
    "lamp": ["tall", "slim"],
    "wardrobe": ["rectangular"],
    "cabinet": ["rectangular", "square"],
    "dresser": ["rectangular"],
    "bookshelf": ["rectangular", "slim"]
}

# Realistic size ranges in inches (L x B x H)
# Format: (min_length, max_length, min_breadth, max_breadth, min_height, max_height)
SIZE_RANGES = {
    "bed": {
        "twin": (75, 80, 38, 42, 24, 36),
        "full": (75, 80, 53, 56, 24, 36),
        "queen": (80, 84, 60, 64, 24, 40),
        "king": (80, 84, 76, 80, 24, 40),
    },
    "sofa": (72, 96, 32, 40, 30, 38),  # 3-seater standard
    "chair": (24, 32, 24, 32, 30, 42),  # dining/accent chair
    "table": {
        "dining": (60, 96, 36, 48, 28, 30),
        "coffee": (36, 54, 18, 30, 16, 20),
        "side": (18, 24, 18, 24, 20, 26),
    },
    "desk": (48, 72, 24, 30, 28, 30),
    "lamp": {
        "floor": (12, 18, 12, 18, 54, 72),
        "table": (8, 15, 8, 15, 18, 30),
    },
    "wardrobe": (48, 72, 20, 28, 72, 84),
    "cabinet": (30, 48, 16, 20, 30, 42),
    "dresser": (48, 72, 18, 22, 30, 40),
    "bookshelf": (30, 48, 12, 16, 60, 84),
}

def generate_realistic_size(item_type, details="", shape=""):
    """Generate realistic L x B x H dimensions in inches based on furniture type."""
    
    # Handle special cases with sub-types
    if item_type == "bed":
        # Determine bed size based on common distributions
        bed_sizes = ["twin", "full", "queen", "king"]
        weights = [0.15, 0.20, 0.45, 0.20]  # Queen most common
        bed_size = random.choices(bed_sizes, weights=weights, k=1)[0]
        ranges = SIZE_RANGES["bed"][bed_size]
    elif item_type == "table":
        if "coffee" in details.lower():
            ranges = SIZE_RANGES["table"]["coffee"]
        elif "side" in details.lower() or shape == "round":
            ranges = SIZE_RANGES["table"]["side"]
        else:
            ranges = SIZE_RANGES["table"]["dining"]
    elif item_type == "lamp":
        if "floor" in details.lower() or "tall" in details.lower():
            ranges = SIZE_RANGES["lamp"]["floor"]
        else:
            ranges = SIZE_RANGES["lamp"]["table"]
    else:
        ranges = SIZE_RANGES.get(item_type, (24, 48, 18, 24, 30, 36))
    
    # Unpack ranges
    min_l, max_l, min_b, max_b, min_h, max_h = ranges
    
    # Generate dimensions with some variation
    length = random.randint(min_l, max_l)
    breadth = random.randint(min_b, max_b)
    height = random.randint(min_h, max_h)
    
    # Apply shape-based adjustments
    if shape in ["round", "oval"]:
        # For round/oval, make length and breadth similar (diameter-like)
        avg = (length + breadth) // 2
        variation = random.randint(-3, 3)
        length = avg + variation
        breadth = avg - variation
    elif shape == "square":
        # Square items have equal length and breadth
        avg = (length + breadth) // 2
        length = breadth = avg
    elif shape == "slim":
        # Slim items have reduced breadth
        breadth = int(breadth * 0.6)
    elif "low-profile" in shape or "low-profile" in details:
        # Low-profile reduces height
        height = int(height * 0.75)
    
    return f"{length}x{breadth}x{height}"

def pick_with_bias(options, weights=None):
    if weights and len(weights) == len(options):
        return random.choices(options, weights=weights, k=1)[0]
    return random.choice(options)

def coherent_detail(item_type):
    opts = TYPE_DETAILS_HINTS.get(item_type, DETAILS_COMMON)
    # mix in some common details
    pool = opts + random.sample(DETAILS_COMMON, k=min(3, len(DETAILS_COMMON)))
    return random.choice(pool)

def coherent_shape(item_type):
    hinted = TYPE_SHAPE_HINTS.get(item_type, SHAPES)
    # ensure shape exists in global SHAPES or treat as label
    return random.choice(hinted)

def random_image_path(item_type, idx):
    # You can later replace with real URLs or S3 paths
    return f"images/{item_type}_{idx:03d}.jpg"

def random_prompt(t, s, c, m, sh, d, r):
    # Short descriptive prompt that your embedding/aesthetic step can use
    bits = [
        s, c, m, t,
        ("with " + d) if d else "",
        sh if sh not in ["rectangular", "round", "square", "oval", "slim"] else "",
        f"for {r} room"
    ]
    # Clean up double spaces and empties
    txt = " ".join([b for b in bits if b]).strip()
    return txt[0].upper() + txt[1:]

def generate_rows(n=100, seed=42):
    random.seed(seed)
    rows = []
    # Slight bias so common furniture appears a bit more often
    type_weights = [0.12, 0.14, 0.12, 0.12, 0.10, 0.10, 0.07, 0.07, 0.08, 0.08]
    for i in range(1, n + 1):
        t = pick_with_bias(TYPES, type_weights)
        s = pick_with_bias(STYLES)
        c = pick_with_bias(COLORS)
        # Pick 1–2 materials, prefer coherent combos
        mats = [pick_with_bias(MATERIALS)]
        if random.random() < 0.35:
            m2 = pick_with_bias([m for m in MATERIALS if m != mats[0]])
            mats.append(m2)
        m = "/".join(mats)

        sh = coherent_shape(t)
        d = coherent_detail(t)
        r = pick_with_bias(ROOM_TYPES)
        price_range = pick_with_bias(PRICE_RANGES, weights=[0.25, 0.45, 0.22, 0.08])

        # Generate realistic size based on type, shape, and details
        size = generate_realistic_size(t, d, sh)

        # image + width
        img = random_image_path(t, i)
        imgw = random.choice([240, 320, 360, 448, 480, 512, 640])

        prompt = random_prompt(t, s, c, mats[0], sh, d, r)

        rows.append({
            "type": t,
            "style": s,
            "color": c,
            "material": m,
            "shape": sh,
            "details": d,
            "room_type": r,
            "price_range": price_range,
            "size": size,
            "prompt": prompt
        })
    return rows

def write_csv(rows, out_path):
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["type","style","color","material",
        "shape","details","room_type","price_range","size","prompt"
    ]
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="Output CSV path, e.g., data/furniture_dataset.csv")
    ap.add_argument("--n", type=int, default=100, help="Number of rows to generate")
    ap.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = ap.parse_args()

    rows = generate_rows(n=args.n, seed=args.seed)
    write_csv(rows, args.out)

    print(f"[OK] Wrote {len(rows)} rows to {args.out}")

if __name__ == "__main__":
    main()