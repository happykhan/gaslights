#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path


KEEP_TYPE_GUESSES = {
    "church",
    "school",
    "hospital",
    "station",
    "wharf",
    "public_house",
    "dock",
    "hall",
    "post_office",
    "bridge",
    "pier",
    "barracks",
    "garden",
    "museum",
}

KEEP_NAME_PATTERNS = [
    r"\bworks?\b",
    r"\bmarket\b",
    r"\btheatre\b",
    r"\bhotel\b",
    r"\binn\b",
    r"\bbrewery\b",
    r"\bmill\b",
    r"\bfactory\b",
    r"\bdepot\b",
    r"\bstation\b",
    r"\bbridge\b",
    r"\bwharf\b",
    r"\bdock\b",
    r"\bhospital\b",
    r"\bchurch\b",
    r"\bchap(?:el)?\.?\b",
    r"\bschool\b",
    r"\bhall\b",
    r"\bcollege\b",
    r"\bcourt\b",
    r"\bgardens?\b",
    r"\bbarracks\b",
    r"\bmuseum\b",
    r"\bbank\b",
    r"\boffice\b",
    r"\bprison\b",
    r"\bworkhouse\b",
    r"\bfoundling\b",
]

DROP_NAME_PATTERNS = [
    r"\bstreet\b",
    r"\broad\b",
    r"\blane\b",
    r"\bsquare\b",
    r"\bplace\b",
    r"\bapproach\b",
    r"\bterrace\b",
    r"\brow\b",
    r"\bwalk\b",
    r"\bcrescent\b",
    r"\bavenue\b",
    r"\bbuildings\b",
]

STREET_LIKE_END_PATTERNS = [
    r"\bst\.?$",
    r"\bstreet$",
    r"\broad$",
    r"\blane$",
    r"\bsquare$",
    r"\bplace$",
    r"\bapproach$",
    r"\bterrace$",
    r"\brow$",
    r"\bwalk$",
    r"\bcrescent$",
    r"\bavenue$",
    r"\brd\.?$",
]

LOW_SIGNAL_EXACT = {
    "sch.", "sch", "schs.", "schs", "ch.", "ch", "chap.", "chap", "church",
    "hospl.", "hall", "station", "pier", "garden", "schools", "school",
    "market", "dock", "wharves", "wharf", "barracks"
}


def parse_args():
    parser = argparse.ArgumentParser(description="Filter in-bounds GB1900 candidates to likely persistent/prominent POIs.")
    parser.add_argument("--in", dest="input_path", default="data/raw/gb1900-london-1895-six-inch.poi-candidates.json")
    parser.add_argument("--out", dest="output_path", default="data/raw/gb1900-london-1895-six-inch.poi-prominent.json")
    parser.add_argument("--summary-out", dest="summary_path", default="data/raw/gb1900-london-1895-six-inch.poi-prominent.summary.json")
    parser.add_argument("--min-score", type=int, default=8)
    return parser.parse_args()


def normalized(name):
    return re.sub(r"\s+", " ", name.strip().lower())


def is_low_signal(name):
    return normalized(name) in LOW_SIGNAL_EXACT


def name_matches(patterns, name):
    lower = normalized(name)
    return any(re.search(pattern, lower) for pattern in patterns)


def likely_prominent(item, min_score):
    name = item["name"]
    type_guess = item.get("typeGuess", "unknown")
    score = int(item.get("priorityScore", 0))
    lower = normalized(name)

    if score < min_score:
      return False, "low_score"
    if type_guess == "road":
      return False, "road"
    if any(re.search(pattern, lower) for pattern in STREET_LIKE_END_PATTERNS):
      return False, "street_suffix"
    if name_matches(DROP_NAME_PATTERNS, name) and type_guess in {"road", "unknown"}:
      return False, "street_like"
    if is_low_signal(name) and type_guess in {"unknown", "school", "church", "hospital", "hall", "garden", "pier"}:
      return False, "low_signal_generic"
    if type_guess in KEEP_TYPE_GUESSES:
      return True, "keep_type"
    if name_matches(KEEP_NAME_PATTERNS, name):
      return True, "keep_name"
    if item.get("classificationCount", 0) >= 5 and len(name) >= 10 and type_guess != "road":
      return True, "high_confidence_name"
    return False, "filtered"


def main():
    args = parse_args()
    items = json.loads(Path(args.input_path).read_text())
    kept = []
    reasons = {}
    for item in items:
        keep, reason = likely_prominent(item, args.min_score)
        reasons[reason] = reasons.get(reason, 0) + 1
        if not keep:
            continue
        kept.append({
            **item,
            "reviewStatus": "candidate",
            "promotionReason": reason,
            "sourceRefs": [
                {
                    "kind": "gb1900",
                    "label": "GB1900 raw gazetteer pin",
                    "pinId": item["id"],
                    "license": "CC0",
                }
            ],
        })

    kept.sort(key=lambda item: (-int(item["priorityScore"]), -int(item["classificationCount"]), item["name"]))

    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(kept, indent=2) + "\n")

    summary = {
        "input": args.input_path,
        "output": args.output_path,
        "minScore": args.min_score,
        "keptCount": len(kept),
        "reasonCounts": reasons,
        "samples": kept[:100],
    }
    summary_path = Path(args.summary_path)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps({"keptCount": len(kept), "output": args.output_path, "summaryOut": args.summary_path}, indent=2))


if __name__ == "__main__":
    main()
