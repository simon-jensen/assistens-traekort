#!/usr/bin/env python3
"""Scenarier for scripts/match_kk.py's fletning (PR #10, reviewets B1–B3, R4, R5): kør fra repo-roden.

Kopierer index.html, data/ og scripts/ til en midlertidig mappe, lægger menneskelige poster, en sletning,
et kommunepunkt valgt i værktøjet, et tilbagetrukket forslag, 'stops' og et ukendt felt i positions.json,
kører scriptet og tjekker, at kun scriptets egne poster røres, og at ingen post får kørselstidspunktet.
"""
import copy, json, os, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tmp = tempfile.mkdtemp()
for d in ("scripts", "data"):
    shutil.copytree(os.path.join(ROOT, d), os.path.join(tmp, d))
shutil.copy(os.path.join(ROOT, "index.html"), tmp)
base = json.load(open(os.path.join(ROOT, "positions.json"), encoding="utf-8"))
kk = [k for k, v in base["trees"].items() if v.get("src") == "kk"]
if len(kk) < 4:
    sys.exit("positions.json har for få kk-poster til testen")
d = copy.deepcopy(base)
a, b, c, e = kk[:4]
d["trees"][a] = {"fx": 0.4, "fy": 0.4, "src": "kort", "ts": "2026-10-09T10:00:00.000Z"}
d["trees"][b] = {"del": 1, "ts": "2026-10-04T10:00:00.000Z"}
d["trees"][c] = {"fx": 0.5, "fy": 0.5, "src": "kort", "lat": 55.69, "lon": 12.55, "acc": 1, "ts": "2026-10-09T10:00:00.000Z",
                 "note": "Kommunens registertræ #1 valgt i værktøjet"}
d["trees"][e] = {"fx": 0.5, "fy": 0.5, "src": "gps", "lat": 55.69, "lon": 12.55, "acc": 9, "ts": "2026-10-08T10:00:00.000Z",
                 "obs": "2026-10-08T09:00:00.000Z"}
lav = "E|E-59/60|Parrotia persica"  # flerleddet nummer: altid til gennemgang, så et gammelt eget forslag skal fjernes
d["trees"][lav] = {"fx": 0.7, "fy": 0.4, "src": "kk", "lat": 55.69, "lon": 12.55, "acc": 1, "ts": "2026-10-05T16:45:32.000Z", "note": "KK høj: gammelt"}
d["stops"] = [{"ts": "2026-10-08T09:30:00.000Z", "lat": 55.69, "lon": 12.55, "acc": 8}]
d["ekstra"] = "bevares"
json.dump(d, open(os.path.join(tmp, "positions.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
r = subprocess.run([sys.executable, "scripts/match_kk.py"], cwd=tmp, capture_output=True, text=True)
print(r.stdout.strip().splitlines()[-2])
n = json.load(open(os.path.join(tmp, "positions.json"), encoding="utf-8"))
stamp = max(v["ts"] for v in base["trees"].values() if v.get("src") == "kk")
chk = [
    ("kort-post bevaret", n["trees"][a]["src"] == "kort"),
    ("sletning bevaret", n["trees"][b].get("del") == 1),
    ("kommunepunkt valgt i værktøjet bevaret", n["trees"][c]["note"].startswith("Kommunens registertræ")),
    ("gps-post med obs bevaret", n["trees"][e].get("obs") == "2026-10-08T09:00:00.000Z"),
    ("tilbagetrukket forslag fjernet", lav not in n["trees"]),
    ("stops bevaret", n.get("stops") == d["stops"]),
    ("ukendt topniveau-felt bevaret", n.get("ekstra") == "bevares"),
    ("uændrede forslag beholder ts", all(v["ts"] == base["trees"][k]["ts"] for k, v in n["trees"].items() if v.get("src") == "kk" and k in base["trees"])),
    ("ingen post nyere end datafilens hentedato", all(v["ts"] <= stamp for v in n["trees"].values() if v.get("src") == "kk")),
]
fails = 0
for name, ok in chk:
    print(("✓ " if ok else "✗ ") + name)
    fails += not ok
r2 = subprocess.run([sys.executable, "scripts/match_kk.py"], cwd=tmp, capture_output=True, text=True)
idem = "0 nye, 0 ændrede" in r2.stdout
print(("✓ " if idem else "✗ ") + "anden kørsel ændrer intet")
fails += not idem
shutil.rmtree(tmp)
sys.exit(1 if fails else 0)
