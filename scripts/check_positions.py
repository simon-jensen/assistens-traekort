#!/usr/bin/env python3
"""Tjekker datablokkene i index.html og, hvis den findes, positions.json.

Kør:  python3 scripts/check_positions.py
Afslutter med kode 1 ved fejl, så GitHub Actions stopper en fejlbehæftet fil,
før den når GitHub Pages og tavst fjerner alle placeringer for alle.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errors, notes = [], []

src = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()


def grab(name):
    m = re.search(r"const " + name + r"=(\[.*?\]|\{.*?\});\n", src, re.S)
    if not m:
        errors.append(f"index.html: fandt ikke 'const {name}='")
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as e:
        errors.append(f"index.html: {name} er ikke gyldig JSON: {e}")
        return None


TREES, RARE, FRACS, TREESECS, META = (grab(n) for n in ("TREES", "RARE", "FRACS", "TREESECS", "META"))
DESC, SEASON = grab("DESC"), grab("SEASON")

ids = set()
if TREES is not None:
    for t in TREES:
        for k in ("sec", "plot", "allplots", "sp", "nr", "yr", "age", "note"):
            if k not in t:
                errors.append(f"TREES: {t.get('nr') or t.get('plot')} mangler feltet '{k}'")
        tid = f"{t.get('sec')}|{t.get('plot')}|{t.get('sp')}"
        if tid in ids:
            errors.append(f"TREES: dobbelt træ-id {tid}")
        ids.add(tid)
        if TREESECS is not None and t.get("sec") not in TREESECS:
            errors.append(f"TREES: afdeling {t.get('sec')} ({t.get('plot')}) findes ikke i TREESECS")
        if t.get("allplots") and t["allplots"][0] != t.get("plot"):
            errors.append(f"TREES: {t.get('plot')}: allplots[0] afviger fra plot")
    notes.append(f"{len(TREES)} træer, {len(ids)} entydige id'er")

if TREESECS is not None and FRACS is not None:
    for s in TREESECS:
        if s not in FRACS:
            errors.append(f"FRACS mangler markør for afdeling {s}")
    for s, f in FRACS.items():
        if not (isinstance(f, list) and len(f) == 2 and all(0 <= v <= 1 for v in f)):
            errors.append(f"FRACS[{s}] skal være [fx, fy] i 0-1")

if SEASON is not None:
    for k, v in SEASON.items():
        if not isinstance(v.get("m"), list) or any(m not in range(1, 13) for m in v["m"]):
            errors.append(f"SEASON[{k}]: 'm' skal være en liste af måneder 1-12")
        if not isinstance(v.get("yr"), bool):
            errors.append(f"SEASON[{k}]: 'yr' skal være true/false")
if DESC is not None and SEASON is not None:
    for k in SEASON:
        if k not in DESC:
            notes.append(f"SEASON-nøglen '{k}' har ingen DESC-post")

# ---- positions.json ----
LAT = (55.684, 55.697)
LON = (12.538, 12.562)
TS = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z)?$")
pp = os.path.join(ROOT, "positions.json")
if os.path.exists(pp):
    try:
        d = json.load(open(pp, encoding="utf-8"))
    except json.JSONDecodeError as e:
        errors.append(f"positions.json er ikke gyldig JSON: {e}")
        d = None
    if isinstance(d, dict):
        if d.get("version") != 1:
            errors.append("positions.json: 'version' skal være 1")
        trees = d.get("trees", {})
        if not isinstance(trees, dict):
            errors.append("positions.json: 'trees' skal være et objekt")
            trees = {}
        n_pos = n_del = 0
        for k, v in trees.items():
            if k not in ids:
                errors.append(f"positions.json: nøglen '{k}' matcher intet træ i index.html")
                continue
            if not isinstance(v, dict):
                errors.append(f"positions.json: '{k}' skal være et objekt")
                continue
            if v.get("del"):
                n_del += 1
            else:
                n_pos += 1
                for c in ("fx", "fy"):
                    if not isinstance(v.get(c), (int, float)) or not 0 <= v[c] <= 1:
                        errors.append(f"positions.json: '{k}': {c} skal være et tal i 0-1")
                if v.get("src") not in (None, "kort", "gps"):
                    errors.append(f"positions.json: '{k}': src skal være 'kort' eller 'gps'")
            if "ts" in v and not (isinstance(v["ts"], str) and TS.match(v["ts"])):
                errors.append(f"positions.json: '{k}': ts skal være YYYY-MM-DD eller ISO-tidsstempel")
            if "lat" in v or "lon" in v:
                if not (LAT[0] <= v.get("lat", 0) <= LAT[1] and LON[0] <= v.get("lon", 0) <= LON[1]):
                    errors.append(f"positions.json: '{k}': lat/lon ligger uden for Assistens Kirkegård")
        anchors = d.get("anchors", [])
        if not isinstance(anchors, list):
            errors.append("positions.json: 'anchors' skal være en liste")
            anchors = []
        for a in anchors:
            ok = isinstance(a, dict) and all(isinstance(a.get(c), (int, float)) for c in ("lat", "lon", "fx", "fy"))
            if not ok or not (LAT[0] <= a["lat"] <= LAT[1] and LON[0] <= a["lon"] <= LON[1] and 0 <= a["fx"] <= 1 and 0 <= a["fy"] <= 1):
                errors.append(f"positions.json: ugyldigt anker {a.get('navn') if isinstance(a, dict) else a!r}")
        notes.append(f"positions.json: {n_pos} placeringer, {n_del} sletninger, {len(anchors)} ankre")
else:
    notes.append("positions.json findes ikke endnu (det er i orden)")

for n in notes:
    print("·", n)
if errors:
    print(f"\n{len(errors)} fejl:")
    for e in errors:
        print("✗", e)
    sys.exit(1)
print("✓ Alt i orden")
