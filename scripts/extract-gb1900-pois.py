#!/usr/bin/env python3
import argparse
import binascii
import csv
import io
import json
import re
import struct
import zipfile
from collections import Counter
from pathlib import Path


TYPE_RULES = [
    ("school", [r"\bsch\.?s?\b", r"\bschools?\b"]),
    ("church", [r"\bch\.?\b", r"\bchurch\b", r"\bchap\.?\b", r"\bchapel\b"]),
    ("hospital", [r"\bhospl\.?\b", r"\bhospital\b"]),
    ("station", [r"\bsta\.?\b", r"\bstation\b"]),
    ("post_office", [r"\bp\.?o\.?\b", r"\bpost office\b"]),
    ("public_house", [r"\bp\.?h\.?\b", r"\bpublic house\b"]),
    ("bridge", [r"\bbridge\b"]),
    ("wharf", [r"\bwharf\b", r"\bwharves\b"]),
    ("pier", [r"\bpier\b", r"\bferry\b"]),
    ("dock", [r"\bdock\b"]),
    ("hall", [r"\bhall\b"]),
    ("museum", [r"\bmuseum\b"]),
    ("barracks", [r"\bbarracks\b"]),
    ("garden", [r"\bgarden\b"]),
    ("road", [r"\broad\b", r"\bstreet\b", r"\blane\b", r"\bsquare\b", r"\bplace\b", r"\bapproach\b"]),
]

LOW_SIGNAL_NAMES = {
    "XXXX", "X X X X", "X.X.X.X", "B.M.", "M.P", "M.S", "L.B", "D.Fn"
}


def parse_args():
    parser = argparse.ArgumentParser(description="Extract GB1900 candidate POIs within a bounds box or sheet manifest.")
    parser.add_argument("--zip", dest="zip_path", default="data/raw/GB1900_raw_dump.zip")
    parser.add_argument("--manifest", default="data/raw/nls-sheet-index/london-1895-six-inch.manifest.json")
    parser.add_argument("--out", default="data/raw/gb1900-london-1895-six-inch.poi-candidates.json")
    parser.add_argument("--summary-out", default="data/raw/gb1900-london-1895-six-inch.summary.json")
    parser.add_argument("--min-classifications", type=int, default=3)
    return parser.parse_args()


def parse_wkb_point(hex_string):
    raw = binascii.unhexlify(hex_string)
    endian = "<" if raw[0] == 1 else ">"
    geom_type = struct.unpack(endian + "I", raw[1:5])[0]
    offset = 9 if (geom_type & 0x20000000) else 5
    lon, lat = struct.unpack(endian + "dd", raw[offset:offset + 16])
    return lon, lat


def load_bounds(manifest_path):
    data = json.loads(Path(manifest_path).read_text())
    sheets = data["sheets"] if isinstance(data, dict) else data
    return {
        "west": min(sheet["bounds"]["west"] for sheet in sheets),
        "south": min(sheet["bounds"]["south"] for sheet in sheets),
        "east": max(sheet["bounds"]["east"] for sheet in sheets),
        "north": max(sheet["bounds"]["north"] for sheet in sheets),
        "sheetCount": len(sheets),
        "sheetIds": [sheet["imageId"] for sheet in sheets],
    }


def guess_type(name):
    lower = name.lower().strip()
    for type_name, patterns in TYPE_RULES:
        for pattern in patterns:
            if re.search(pattern, lower):
                return type_name
    return "unknown"


def priority_score(name, type_guess, classification_count):
    score = classification_count
    if type_guess != "unknown":
        score += 5
    if re.search(r"[A-Za-z].*[A-Za-z].*[A-Za-z]", name):
        score += 1
    if name.isupper() and len(name) > 6:
        score += 1
    if name in LOW_SIGNAL_NAMES:
        score -= 5
    return score


def main():
    args = parse_args()
    bounds = load_bounds(args.manifest)
    zip_path = Path(args.zip_path)

    candidates = []
    type_counts = Counter()

    with zipfile.ZipFile(zip_path) as zf:
        with zf.open("GB1900_final_raw_dump_july_2018/gb1900_locations.csv") as handle:
            text = io.TextIOWrapper(handle, encoding="utf-16", newline="")
            reader = csv.DictReader(text)
            for row in reader:
                try:
                    lon, lat = parse_wkb_point(row["g_point_wgs"])
                    classification_count = int(row.get("classification_count") or 0)
                except Exception:
                    continue
                if classification_count < args.min_classifications:
                    continue
                if not (bounds["west"] <= lon <= bounds["east"] and bounds["south"] <= lat <= bounds["north"]):
                    continue

                name = (row.get("first_transcription") or "").strip()
                if not name:
                    continue
                type_guess = guess_type(name)
                score = priority_score(name, type_guess, classification_count)
                candidate = {
                    "id": row["pin_id"],
                    "name": name,
                    "typeGuess": type_guess,
                    "priorityScore": score,
                    "classificationCount": classification_count,
                    "coordinates": {
                        "lng": round(lon, 8),
                        "lat": round(lat, 8),
                    },
                }
                candidates.append(candidate)
                type_counts[type_guess] += 1

    candidates.sort(key=lambda item: (-item["priorityScore"], -item["classificationCount"], item["name"]))

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(candidates, indent=2) + "\n")

    summary = {
        "zipPath": str(zip_path),
        "manifest": args.manifest,
        "bounds": bounds,
        "minClassifications": args.min_classifications,
        "candidateCount": len(candidates),
        "typeCounts": dict(type_counts.most_common()),
        "topSamples": candidates[:50],
    }
    summary_path = Path(args.summary_out)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, indent=2) + "\n")

    print(json.dumps({
        "candidateCount": len(candidates),
        "out": str(out_path),
        "summaryOut": str(summary_path),
        "topTypes": dict(type_counts.most_common(12)),
    }, indent=2))


if __name__ == "__main__":
    main()
