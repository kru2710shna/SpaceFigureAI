#!/usr/bin/env python3
"""
Filter furniture items from furniture_dataset.csv by:
- REQUIRED: item_type
- REQUIRED: at least one of (budget | aesthetic | color)

CSV is expected to have headers:
image,imagewidth,type,style,color,material,shape,details,room_type,price_range,prompt
"""

import csv
import json
from pathlib import Path
from typing import List, Dict, Optional
RESULTS_DIR = Path("backend/answers")
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
    item_types: List[str],
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
    if not item_types:
        raise ValueError("item_type is required.")
    if not (budget or style or color):
        raise ValueError("At least one of budget, aesthetic, or color must be provided.")

    p = Path(csv_path)
    if not p.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    # Normalize filters
    item_types_norm = [item_type.strip().lower() for item_type in item_types]
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
            # Normalize row for comparison
            r = {k.lower(): (v or "") for k, v in row.items()}
            
            # 1) Type filter (check if row type matches any in the list)
            row_type = r.get("type", "").strip().lower()
            if row_type not in item_types_norm:
                continue
            
            # 2) Budget filter (if provided)
            if budget_norm and r.get("price_range", "").strip().lower() != budget_norm:
                continue
            
            # 3) Aesthetic filter (if provided)
            if aesthetic_norm:
                csv_aesthetic = _infer_aesthetic(
                    r.get("style", ""), r.get("material", ""), r.get("color", ""),
                    r.get("shape", ""), r.get("prompt", "")
                )
                if aesthetic_norm not in csv_aesthetic.lower():
                    continue
            
            # 4) Color filter (if provided)
            if color_norm and color_norm not in r.get("color", "").lower():
                continue
            
            results.append(row)
            if len(results) >= limit:
                break
    
    return results

def parse_budget_range(budget_str: str) -> Optional[str]:
    """
    Convert budget string like '$10k-$20k' to price_range format.
    Maps to: budget|standard|premium|luxury
    """
    budget_lower = budget_str.lower().strip()
    
    # Extract numeric values
    if "10k" in budget_lower and "20k" in budget_lower:
        return "premium"
    elif "5k" in budget_lower and "10k" in budget_lower:
        return "standard"
    elif "20k" in budget_lower:
        return "luxury"
    elif "5k" in budget_lower or "budget" in budget_lower:
        return "budget"
    
    # Default mappings
    if any(word in budget_lower for word in ["luxury", "high-end", "premium"]):
        return "luxury"
    elif any(word in budget_lower for word in ["standard", "moderate", "mid"]):
        return "standard"
    elif any(word in budget_lower for word in ["budget", "affordable", "economical"]):
        return "budget"
    
    return "standard"

def save_results(session_id: str, results: Dict):
    """Save processed results to JSON file."""
    output_path = RESULTS_DIR / f"{session_id}_results.json"
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Results saved to: {output_path}")

def process_response_file(json_path: str):
    """Process a questionnaire response JSON file."""
    path = Path(json_path)
    
    if not path.exists():
        raise FileNotFoundError(f"Response file not found: {json_path}")
    
    # Load response
    with path.open("r", encoding="utf-8") as f:
        response_data = json.load(f)
    
    # Process and fetch items
    
    answers = response_data.get("answers", {})
    
    # Extract parameters
    aesthetic = answers.get("step0", None)
    budget_str = answers.get("step1", None)
    style = answers.get("step2", None)
    color =answers.get("color", None)

    budget = parse_budget_range(budget_str)
    items = fetch_items(
        csv_path="./agents/data/furniture_dataset.csv",
        item_types=answers.get("item_type", ["sofa", "lamp", "table", "bed"]),
        budget=budget
    )
    # Save results
    session_id = response_data.get("sessionId", "unknown")
    save_results(session_id, items)
    
    return items

# -----------------------
# Example usage (remove if importing)
# -----------------------
if __name__ == "__main__":
    process_response_file("backend/answers/answer.json")
