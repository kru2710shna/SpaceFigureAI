#!/usr/bin/env python3
"""
Filter furniture items from furniture_dataset.csv by:
- REQUIRED: item_type
- REQUIRED: at least one of (budget | aesthetic | color)

CSV is expected to have headers:
image,imagewidth,type,style,color,material,shape,details,room_type,price_range,prompt
"""

import csv
from pathlib import Path
from typing import List, Dict, Optional

# --- Aesthetic inference (lightweight, same idea as earlier) ---
_AESTHETIC_ALIASES = {
    "japandi": "Japandi", "scandi": "Scandinavian", "scandinavian": "Scandinavian",
    "minimal": "Minimal", "minimalist": "Minimal", "modern": "Modern",
    "contemporary": "Contemporary", "midcentury": "Mid-Century",
    "mid-century": "Mid-Century", "industrial": "Industrial", "boho": "Boho",
    "bohemian": "Boho", "rustic": "Rustic", "farmhouse": "Farmhouse",
    "traditional": "Traditional", "classic": "Traditional", "colonial": "Traditional",
    "art deco": "Art Deco", "deco": "Art Deco", "transitional": "Transitional",
    "coastal": "Coastal",
}

def _infer_aesthetic(style: str, materials: str, color: str, shape: str, prompt: str) -> str:
    s = " ".join([str(style or ""), str(materials or ""), str(color or ""),
                  str(shape or ""), str(prompt or "")]).lower()
    for k, v in _AESTHETIC_ALIASES.items():
        if k in s:
            return v
    mat, col = (materials or "").lower(), (color or "").lower()
    if any(w in mat for w in ["oak","ash","birch","linen","cotton"]) and any(c in col for c in ["beige","cream","white","sand","taupe"]):
        return "Scandinavian"
    if any(w in mat for w in ["rattan","bamboo","jute"]) or "earth" in s:
        return "Boho"
    if any(w in mat for w in ["concrete","steel","iron","metal"]) and any(c in col for c in ["black","gray","grey","charcoal"]):
        return "Industrial"
    if "marble" in mat or "brass" in mat:
        return "Modern"
    if "white" in col and "clean" in s:
        return "Minimal"
    if any(w in mat for w in ["reclaimed wood","distressed","oak"]) and any(c in col for c in ["walnut","oak","brown"]):
        return "Rustic"
    return _AESTHETIC_ALIASES.get((style or "").strip().lower(), (style or "Contemporary").title())

def fetch_items(
    csv_path: str,
    item_type: str,
    *,
    budget: Optional[str] = None,        # one of: budget|standard|premium|luxury
    style: Optional[str] = None,     # e.g., Japandi, Industrial, Minimal...
    color: Optional[str] = None,         # e.g., beige, gray, oak...
    limit: int = 50,
    delimiter: str = ","
) -> List[Dict]:
    """
    Returns a list of item dicts filtered from the CSV.

    Rules:
    - item_type is required
    - at least one of (budget, aesthetic, color) must be provided
    - matching is case-insensitive and substring-friendly for aesthetic/color
    """
    if not item_type:
        raise ValueError("item_type is required.")
    if not (budget or style or color):
        raise ValueError("At least one of budget, aesthetic, or color must be provided.")

    p = Path(csv_path)
    if not p.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    # Normalize filters
    item_type_norm = item_type.strip().lower()
    budget_norm = budget.strip().lower() if budget else None
    aesthetic_norm = style.strip().lower() if style else None
    color_norm = color.strip().lower() if color else None

    results: List[Dict] = []
    with p.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        # sanity check: must have required headers
        needed = {"type","style","color","material","shape","details","room_type","price_range","prompt"}
        missing = needed - set(h.lower() for h in reader.fieldnames or [])
        if missing:
            # try case-insensitive remap if user has capitalized headers
            # build a mapping lower->actual
            actual_map = {h.lower(): h for h in (reader.fieldnames or [])}
            if not missing - set(actual_map.keys()):
                # we can proceed; DictReader already provides original keys
                pass
            else:
                raise ValueError(f"CSV is missing required columns: {sorted(missing)}")

        for row in reader:
            # Normalize access but preserve original keys
            r = {k.lower(): (v or "") for k, v in row.items()}

            # 1) type filter (exact, case-insensitive)
            if r.get("type","").strip().lower() != item_type_norm:
                continue

            # 2) budget filter (exact match on price_range) if provided
            if budget_norm and r.get("price_range","").strip().lower() != budget_norm:
                continue

            # 3) style filter (supports substring & inferred)
            if aesthetic_norm:
                # If your CSV already has 'aesthetic', use it; else infer from style/material/color/shape/prompt
                csv_aesthetic = (row.get("aesthetic") or "").strip()
                if not csv_aesthetic:
                    csv_aesthetic = _infer_aesthetic(
                        r.get("style",""), r.get("material",""), r.get("color",""),
                        r.get("shape",""), r.get("prompt","")
                    )
                if aesthetic_norm not in csv_aesthetic.lower():
                    continue

            # 4) color filter (substring)
            if color_norm and color_norm not in r.get("color","").lower():
                continue

            results.append(row)
            if len(results) >= limit:
                break

    return results


# -----------------------
# Example usage (remove if importing)
# -----------------------
if __name__ == "__main__":
    items = fetch_items(
        csv_path="data/furniture_dataset.csv",
        item_type="sofa",      # or None (will be inferred)
        color="beige",                  # or "beige"
        limit=20,
        delimiter=","                # or ";" or "\t"
    )
    print(f"Found {len(items)} items")
    # Show items
    for it in items[:]:
        print({k: it[k] for k in ["type","style","color","material","price_range","prompt"]})
