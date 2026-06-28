#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description="Build a reviewable POI queue from filtered GB1900 candidates and optional OSM hints.")
    parser.add_argument("--in", dest="input_path", default="data/raw/gb1900-london-1895-six-inch.poi-prominent.json")
    parser.add_argument("--osm", dest="osm_path", default="data/raw/gb1900-london-1895-six-inch.poi-prominent.osm.json")
    parser.add_argument("--out", dest="output_path", default="data/raw/gb1900-london-1895-six-inch.poi-review-queue.json")
    parser.add_argument("--summary-out", dest="summary_path", default="data/raw/gb1900-london-1895-six-inch.poi-review-queue.summary.json")
    return parser.parse_args()


def load_json(path, fallback):
    p = Path(path)
    if not p.exists():
        return fallback
    return json.loads(p.read_text())


def choose_osm_hint(item):
    hints = item.get("osmHints") or {}
    search = hints.get("searchBest")
    reverse = hints.get("reverse")
    if search and search.get("distanceMeters", 999999) <= 250:
        return {
            "confidence": "medium",
            "source": "search",
            **search,
        }
    if reverse and reverse.get("displayName"):
        return {
            "confidence": "low",
            "source": "reverse",
            **reverse,
        }
    return None


def main():
    args = parse_args()
    base_items = load_json(args.input_path, [])
    osm_items = load_json(args.osm_path, [])
    osm_by_id = {item["id"]: item for item in osm_items}

    queue = []
    with_osm = 0
    for item in base_items:
        osm_item = osm_by_id.get(item["id"], {})
        osm_hint = choose_osm_hint(osm_item) if osm_item else None
        if osm_hint:
            with_osm += 1
        queue.append({
            "id": item["id"],
            "reviewStatus": "candidate",
            "name": item["name"],
            "canonicalName": "",
            "typeGuess": item.get("typeGuess", "unknown"),
            "confirmedType": "",
            "priorityScore": item.get("priorityScore"),
            "classificationCount": item.get("classificationCount"),
            "coordinates": item["coordinates"],
            "promotionReason": item.get("promotionReason"),
            "sourceRefs": item.get("sourceRefs", []),
            "osmHint": osm_hint,
            "defaultVisitText": "",
            "tags": [],
            "notes": "",
        })

    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(queue, indent=2) + "\n")

    summary = {
        "inputCount": len(base_items),
        "queueCount": len(queue),
        "queueWithOsmHints": with_osm,
        "samples": queue[:80],
    }
    summary_path = Path(args.summary_path)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, indent=2) + "\n")

    print(json.dumps({
        "queueCount": len(queue),
        "queueWithOsmHints": with_osm,
        "output": args.output_path,
        "summaryOut": args.summary_path,
    }, indent=2))


if __name__ == "__main__":
    main()
