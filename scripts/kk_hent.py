#!/usr/bin/env python3
"""Slanker Københavns Kommunes WFS-lag til det, siden og match_kk.py bruger, og lægger dem i data/.

Kør:  python3 scripts/kk_hent.py <trae_basis.json> <gravsteder.json> <afdelinger.json> <detekterede.json>

De fire filer hentes manuelt fra kommunens GeoServer (ingen token, licens CC BY 4.0, Københavns Kommune):

  BB=bbox=12.543,55.687,12.556,55.695,EPSG:4326
  https://wfs-kbhkort.kk.dk/k101/ows?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application%2Fjson&SRSNAME=EPSG:4326
     &typeName=k101:trae_basis&maxFeatures=10000&CQL_FILTER=stednavn%3D%27Assistens%20Kirkeg%C3%A5rd%27
     &typeName=k101:kirkegd_gravsteder&maxFeatures=50000&$BB
     &typeName=k101:kirkegd_afdelingsgr_1&maxFeatures=1000
     &typeName=k101:automatisk_detekterede_traeer_kk_beta&maxFeatures=50000&$BB

Rå filer committes ikke (7+6 MB); de slankede udgaver i data/ er på under 1 MB tilsammen.
"""
import json, os, sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data")
KILDE = "Københavns Kommune, wfs-kbhkort.kk.dk/k101 (CC BY 4.0)"


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)["features"]


def r6(v):
    return round(v, 6)


def write(name, obj):
    p = os.path.join(OUT, name)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"· {name}: {os.path.getsize(p)//1024} KB")


def main(argv):
    if len(argv) != 5:
        print(__doc__)
        return 2
    os.makedirs(OUT, exist_ok=True)
    hentet = date.today().isoformat()

    # Træregistret: kun kirkegårdens træer, kun de felter vi bruger
    rows = []
    for x in load(argv[1]):
        p, g = x["properties"], x["geometry"]
        if not g or p.get("stednavn") != "Assistens Kirkegård":
            continue
        rows.append([p["id"], p.get("traeart") or "", p.get("dansk_navn") or "", p.get("planteaar") or "",
                     p.get("kronediameter") if p.get("kronediameter") not in (None, "Ikke registreret") else "",
                     r6(g["coordinates"][0]), r6(g["coordinates"][1])])
    rows.sort()
    write("kk_traeer.json", {"kilde": KILDE, "lag": "trae_basis", "hentet": hentet,
                             "felter": ["id", "traeart", "dansk_navn", "planteaar", "kronediameter", "lon", "lat"], "rows": rows})

    # Gravsteder: afdeling, nummer og polygonens midtpunkt (polygonerne selv er 5 MB og bruges ikke)
    rows = []
    for x in load(argv[2]):
        p, g = x["properties"], x["geometry"]
        if not g or (p.get("kirkegaard_nr") or "").strip() != "1":
            continue
        afd, nr = (p.get("afdeling_nr") or "").strip(), (p.get("gravsted_nr") or "").strip()
        if not afd or not nr:
            continue
        pts = [pt for poly in g["coordinates"] for pt in poly[0]]
        rows.append([afd, nr, r6(sum(q[0] for q in pts) / len(pts)), r6(sum(q[1] for q in pts) / len(pts))])
    rows.sort()
    write("kk_gravsteder.json", {"kilde": KILDE, "lag": "kirkegd_gravsteder", "hentet": hentet,
                                 "felter": ["afd", "nr", "lon", "lat"], "rows": rows})

    # Afdelingsgrænser: polygoner som GeoJSON (bruges til punkt-i-polygon)
    feats = []
    for x in load(argv[3]):
        p, g = x["properties"], x["geometry"]
        if not g:
            continue
        coords = [[[[r6(a), r6(b)] for a, b in ring] for ring in poly] for poly in g["coordinates"]]
        feats.append({"type": "Feature", "properties": {"afd": (p.get("afd_nr") or "").strip(), "navn": p.get("afd_navn")},
                      "geometry": {"type": "MultiPolygon", "coordinates": coords}})
    write("kk_afdelinger.json", {"type": "FeatureCollection", "kilde": KILDE, "lag": "kirkegd_afdelingsgr_1", "hentet": hentet, "features": feats})

    # Automatisk detekterede træer (LiDAR): position, højde, kroneareal
    rows = []
    for x in load(argv[4]):
        p, g = x["properties"], x["geometry"]
        if not g:
            continue
        rows.append([r6(g["coordinates"][0]), r6(g["coordinates"][1]), p.get("traehoejde"), p.get("kroneareal")])
    rows.sort()
    write("kk_detekterede.json", {"kilde": KILDE, "lag": "automatisk_detekterede_traeer_kk_beta", "hentet": hentet,
                                  "felter": ["lon", "lat", "hoejde_m", "kroneareal_m2"], "rows": rows})
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
