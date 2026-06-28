#!/usr/bin/env python3
import argparse
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path


NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
USER_AGENT = "Gaslights-POI-Enrichment/0.1 (historical map review use)"


def parse_args():
    parser = argparse.ArgumentParser(description="Enrich filtered GB1900 POIs with cautious OSM/Nominatim hints.")
    parser.add_argument("--in", dest="input_path", default="data/raw/gb1900-london-1895-six-inch.poi-prominent.json")
    parser.add_argument("--out", dest="output_path", default="data/raw/gb1900-london-1895-six-inch.poi-prominent.osm.json")
    parser.add_argument("--cache", dest="cache_path", default="data/raw/osm-nominatim-cache.json")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--delay-seconds", type=float, default=1.1)
    return parser.parse_args()


def load_json(path, fallback):
    p = Path(path)
    if not p.exists():
        return fallback
    return json.loads(p.read_text())


def save_json(path, payload):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(payload, indent=2) + "\n")


def http_json(url):
    request = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def reverse_url(lat, lon):
    params = {
        "format": "jsonv2",
        "lat": f"{lat:.8f}",
        "lon": f"{lon:.8f}",
        "zoom": "18",
        "addressdetails": "1",
        "namedetails": "1",
    }
    return f"{NOMINATIM_BASE}/reverse?{urllib.parse.urlencode(params)}"


def search_url(name, lat, lon):
    params = {
        "format": "jsonv2",
        "q": f"{name}, London",
        "limit": "3",
        "viewbox": f"{lon - 0.015:.6f},{lat + 0.015:.6f},{lon + 0.015:.6f},{lat - 0.015:.6f}",
        "bounded": "1",
        "addressdetails": "1",
        "namedetails": "1",
    }
    return f"{NOMINATIM_BASE}/search?{urllib.parse.urlencode(params)}"


def haversine_meters(lat1, lon1, lat2, lon2):
    radius = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def choose_search_match(results, lat, lon, name):
    if not results:
        return None
    name_lower = name.lower()
    scored = []
    for item in results:
        try:
            item_lat = float(item["lat"])
            item_lon = float(item["lon"])
        except Exception:
            continue
        distance = haversine_meters(lat, lon, item_lat, item_lon)
        display = (item.get("display_name") or "").lower()
        score = distance
        if name_lower in display:
            score -= 150
        scored.append((score, distance, item))
    if not scored:
        return None
    scored.sort(key=lambda entry: entry[0])
    score, distance, item = scored[0]
    return {
        "osmType": item.get("type"),
        "osmCategory": item.get("category"),
        "displayName": item.get("display_name"),
        "lat": item.get("lat"),
        "lon": item.get("lon"),
        "distanceMeters": round(distance, 1),
        "importance": item.get("importance"),
    }


def enrich_one(item, cache, delay_seconds):
    lat = item["coordinates"]["lat"]
    lon = item["coordinates"]["lng"]
    name = item["name"]

    reverse_key = f"reverse:{lat:.8f},{lon:.8f}"
    if reverse_key not in cache:
        cache[reverse_key] = http_json(reverse_url(lat, lon))
        time.sleep(delay_seconds)
    reverse = cache[reverse_key]

    search_key = f"search:{name}:{lat:.8f},{lon:.8f}"
    if search_key not in cache:
        cache[search_key] = http_json(search_url(name, lat, lon))
        time.sleep(delay_seconds)
    search_results = cache[search_key]

    reverse_hint = None
    if isinstance(reverse, dict):
        reverse_hint = {
            "osmType": reverse.get("type"),
            "osmCategory": reverse.get("category"),
            "displayName": reverse.get("display_name"),
            "name": reverse.get("name"),
        }
    search_hint = choose_search_match(search_results if isinstance(search_results, list) else [], lat, lon, name)

    return {
        **item,
        "osmHints": {
            "reverse": reverse_hint,
            "searchBest": search_hint,
        },
    }


def main():
    args = parse_args()
    items = load_json(args.input_path, [])
    cache = load_json(args.cache_path, {})
    subset = items[:args.limit]
    enriched = []
    for index, item in enumerate(subset, start=1):
        print(f"[{index}/{len(subset)}] {item['name']}")
        enriched.append(enrich_one(item, cache, args.delay_seconds))
        save_json(args.cache_path, cache)
    save_json(args.output_path, enriched)
    print(json.dumps({
        "inputCount": len(items),
        "enrichedCount": len(enriched),
        "output": args.output_path,
        "cache": args.cache_path,
    }, indent=2))


if __name__ == "__main__":
    main()
