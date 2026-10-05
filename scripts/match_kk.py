#!/usr/bin/env python3
"""Foreslår placeringer af listens træer ud fra Københavns Kommunes data i data/ (se data/README.md).

Kør:  python3 scripts/match_kk.py            # skriver positions.json og data/kk_gennemgang.md
      python3 scripts/match_kk.py --toer     # viser kun statistik, skriver intet

Tre kilder, i prioriteret rækkefølge:
  1. Gravstedet (kk_gravsteder.json): listens numre er kirkegårdens gravstedsnumre. Findes gravstedet,
     bruges dets midtpunkt; ellers anslås det mellem nærmeste lavere og højere nummer i samme afdeling
     (numrene ligger fortløbende i rækkerne; valideret til 0,6 m median-fejl på kendte gravsteder).
  2. Træregistret (kk_traeer.json): står der et registreret træ af samme art tæt på gravstedet, bruges
     registrets punkt (det er selve træet). Uden gravsted bruges registret, hvis arten er entydig i afdelingen.
  3. LiDAR-detekterede træer (kk_detekterede.json): et detekteret træ tæt på gravstedet "snapper" punktet.

Hvert forslag får en sikkerhed: 'høj' og 'middel' skrives til positions.json (src "kk", acc = anslået
usikkerhed i meter), 'lav' kommer kun i gennemgangslisten. Scriptet overskriver aldrig en placering,
et menneske har lavet (src "kort"/"gps"), kun sine egne gamle kk-poster. t.sp røres ikke.
"""
import json, math, os, re, sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
IMGW, IMGH, LON0, LAT0 = 1400, 1216, 12.55, 55.69
KX, KY = 111320 * math.cos(math.radians(55.69)), 111320  # grader -> meter

src = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()


def grab(name):
    m = re.search(r"const " + name + r"=(\[.*?\]|\{.*?\});\n", src, re.S)
    return json.loads(m.group(1))


TREES = grab("TREES")
SP_TOKEN = json.loads(re.search(r"const SP_TOKEN=(\{.*?\});\nfunction fixSp", src, re.S).group(1))
SEED = [dict(lat=float(a), lon=float(b), fx=float(c) / IMGW, fy=float(d) / IMGH)
        for a, b, c, d in re.findall(r"\{lat:([\d.]+),lon:([\d.]+),fx:(\d+)/IMGW,fy:(\d+)/IMGH", src)]


def jload(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


# ---- GPS -> kortbrøk: samme affine mindste-kvadraters tilpasning som i index.html ----
def fit_affine(anchors):
    def lsq(get):
        S = [[0.0] * 4 for _ in range(3)]
        for a in anchors:
            r = [a["lon"] - LON0, a["lat"] - LAT0, 1]
            v = get(a)
            for i in range(3):
                for j in range(3):
                    S[i][j] += r[i] * r[j]
                S[i][3] += r[i] * v
        for i in range(3):
            m = max(range(i, 3), key=lambda k: abs(S[k][i]))
            S[i], S[m] = S[m], S[i]
            for k in range(i + 1, 3):
                f = S[k][i] / S[i][i]
                for j in range(i, 4):
                    S[k][j] -= f * S[i][j]
        x = [0, 0, 0]
        for i in range(2, -1, -1):
            x[i] = (S[i][3] - sum(S[i][j] * x[j] for j in range(i + 1, 3))) / S[i][i]
        return x
    return lsq(lambda a: a["fx"]), lsq(lambda a: a["fy"])


def ll_to_frac(TF, lat, lon):
    u, v = lon - LON0, lat - LAT0
    return (TF[0][0] * u + TF[0][1] * v + TF[0][2], TF[1][0] * u + TF[1][1] * v + TF[1][2])


def dist_m(a, b):  # (lon, lat) -> meter
    return math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY)


# ---- artsnavne -> tokens, med sidens staveretning, så "Crytomeria" og "Cryptomeria" mødes ----
STOP = {"sp", "hybr", "syn", "var", "ssp", "stk", "allé", "alle", "lang", "ved", "kapel", "plantet", "x", "cv"}


def toks(s):
    s = s.lower()
    for a, b in zip("áíúýéóà", "aiuyeoa"):
        s = s.replace(a, b)
    s = re.sub(r"[\"'”“‘’().,/]", " ", s)
    s = re.sub(r"\b[a-z]-?\d[\w-]*\b", " ", s)  # gravstedshenvisninger i artsfeltet
    out = set()
    for w in s.split():
        w = SP_TOKEN.get(w, w).lower()
        if len(w) > 2 and w not in STOP and not w.isdigit():
            out.add(w)
    return out


# ---- punkt i afdelingspolygon ----
def point_in_ring(pt, ring):
    x, y, inside = pt[0], pt[1], False
    for i in range(len(ring)):
        x1, y1 = ring[i - 1]
        x2, y2 = ring[i]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def section_of(afd, pt):
    for f in afd:
        for poly in f["geometry"]["coordinates"]:
            if point_in_ring(pt, poly[0]) and not any(point_in_ring(pt, h) for h in poly[1:]):
                return f["properties"]["afd"]
    return None


def main(argv):
    dry = "--toer" in argv
    grav = jload("kk_gravsteder.json")["rows"]
    reg = jload("kk_traeer.json")["rows"]
    afd = jload("kk_afdelinger.json")["features"]
    det = jload("kk_detekterede.json")["rows"]

    anchors = list(SEED)
    pp = os.path.join(ROOT, "positions.json")
    old = {"version": 1, "anchors": [], "trees": {}}
    if os.path.exists(pp):
        old = json.load(open(pp, encoding="utf-8"))
        anchors += [a for a in old.get("anchors", []) if all(isinstance(a.get(k), (int, float)) for k in ("lat", "lon", "fx", "fy"))]
    TF = fit_affine(anchors)

    # gravsteder pr. afdeling: nummer -> (lon, lat); bogstav-suffix (0219A) holdes adskilt
    gsec = {}
    for a, nr, lon, lat in grav:
        m = re.match(r"0*(\d+)([A-Z]*)$", nr)
        if m:
            gsec.setdefault(a.upper(), {}).setdefault((int(m.group(1)), m.group(2)), (lon, lat))

    def grav_pos(sec, n, suf):
        d = gsec.get(sec)
        if not d:
            return None
        if (n, suf) in d:
            return d[(n, suf)], 1.5, "gravsted direkte"
        if (n, "") in d:
            return d[(n, "")], 2.0, "gravsted direkte (uden bogstav)"
        nums = sorted({k[0] for k in d})
        lo = max((k for k in nums if k < n), default=None)
        hi = min((k for k in nums if k > n), default=None)
        if lo is None or hi is None:
            return None
        p1, p2 = d[next(k for k in d if k[0] == lo)], d[next(k for k in d if k[0] == hi)]
        gap = dist_m(p1, p2)
        w = (n - lo) / (hi - lo)
        pt = (p1[0] + (p2[0] - p1[0]) * w, p1[1] + (p2[1] - p1[1]) * w)
        how = f"anslået mellem {sec}-{lo} og {sec}-{hi} ({gap:.0f} m fra hinanden)"
        if gap <= 15 and hi - lo <= 12:
            return pt, 3.0, how
        if gap <= 40:
            return pt, 8.0, how
        return pt, 20.0, how

    # registertræer med art, med afdeling fra polygonerne
    R = []
    for rid, art, dk, aar, krone, lon, lat in reg:
        if art:
            R.append(dict(id=rid, art=art, tk=toks(art), pt=(lon, lat), sec=section_of(afd, (lon, lat))))
    D = [(lon, lat) for lon, lat, h, k in det]

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    stats, review, out = {}, [], {}
    for t in TREES:
        tid = f"{t['sec']}|{t['plot']}|{t['sp']}"
        q = toks(t["sp"])
        m = re.match(r"([A-ZÆØÅ]+\d?)-(\d+)([A-Z]?)", t["plot"].replace(" ", ""))
        sec = t["sec"].upper()
        g = None
        if m:
            a = m.group(1).upper() if m.group(1).upper() in gsec else sec
            g = grav_pos(a, int(m.group(2)), m.group(3))

        # artskandidater i registret: stærk (slægt+art) eller kun slægt, når registret selv kun har slægt
        strong = [r for r in R if len(q & r["tk"]) >= 2]
        weak = [r for r in R if len(q & r["tk"]) == 1 and len(r["tk"]) == 1]
        cands = strong or weak
        in_sec = [r for r in cands if r["sec"] == sec]

        pos = acc = None
        why = []
        konf = "lav"
        if g:
            gpt, gacc, how = g
            why.append(how)
            near = sorted((dist_m(r["pt"], gpt), r) for r in cands)
            near = [(d, r) for d, r in near if d <= (12 if gacc <= 3 else 15)]
            if near:  # registret kender selve træet; et løst anslået gravsted giver kun 'middel'
                d, r = near[0]
                pos, acc = r["pt"], 1.0
                why.append(f"registertræ #{r['id']} «{r['art']}» {d:.0f} m fra gravstedet")
                konf = "høj" if gacc <= 8 else "middel"
            else:
                dd = sorted((dist_m(p, gpt), p) for p in D)
                if dd and dd[0][0] <= max(6, gacc):
                    pos, acc = dd[0][1], max(2.0, gacc * 0.6)
                    why.append(f"detekteret træ {dd[0][0]:.0f} m fra gravstedet")
                    konf = "høj" if gacc <= 2 else ("middel" if gacc <= 8 else "lav")
                else:
                    pos, acc = gpt, gacc
                    konf = "høj" if gacc <= 2 else ("middel" if gacc <= 3 else "lav")
            if konf == "lav" and len(in_sec) == 1 and strong:
                pos, acc, konf = in_sec[0]["pt"], 3.0, "middel"
                why.append(f"eneste «{in_sec[0]['art']}» i afdelingen: registertræ #{in_sec[0]['id']}")
        elif len(in_sec) == 1 and strong:
            pos, acc, konf = in_sec[0]["pt"], 3.0, "middel"
            why.append(f"intet gravsted; eneste «{in_sec[0]['art']}» i afd. {sec}: registertræ #{in_sec[0]['id']}")
        elif in_sec:
            why.append(f"intet gravsted; {len(in_sec)} registertræer af arten i afd. {sec}: " + ", ".join(f"#{r['id']}" for r in in_sec[:6]))
        elif cands:
            secs = sorted({r["sec"] or "?" for r in cands})
            why.append(f"intet gravsted; arten findes kun i afd. {', '.join(secs)} i registret")
        else:
            why.append("intet gravsted og ingen art i registret")

        stats[konf] = stats.get(konf, 0) + 1
        line = f"{t['plot']} · {t['_vis'] if '_vis' in t else t['sp']} — {konf}: " + "; ".join(why)
        if konf in ("høj", "middel") and pos:
            fx, fy = ll_to_frac(TF, pos[1], pos[0])
            if not (-0.02 <= fx <= 1.02 and -0.02 <= fy <= 1.02):
                review.append((sec, line + " (uden for kortet!)"))
                continue
            out[tid] = {"fx": round(min(1, max(0, fx)), 5), "fy": round(min(1, max(0, fy)), 5), "src": "kk",
                        "lat": round(pos[1], 6), "lon": round(pos[0], 6), "acc": acc, "ts": now,
                        "note": "KK " + konf + ": " + "; ".join(why)}
        else:
            if pos:
                fx, fy = ll_to_frac(TF, pos[1], pos[0])
                line += f" → forslag fx={fx:.4f} fy={fy:.4f}"
            review.append((sec, line))

    print("Sikkerhed:", ", ".join(f"{k} {v}" for k, v in sorted(stats.items(), key=lambda z: -z[1])))
    print(f"{len(out)} forslag til positions.json, {len(review)} til gennemgang")
    if dry:
        return 0

    # flet: menneskers placeringer (kort/gps) og nyere poster bevares; egne gamle kk-poster erstattes
    trees = dict(old.get("trees", {}))
    kept = 0
    for k, v in out.items():
        cur = trees.get(k)
        if cur and not cur.get("del") and cur.get("src") in ("kort", "gps"):
            kept += 1
            continue
        if cur and cur.get("del") and cur.get("ts", "") > "2026-10-05":
            kept += 1  # en sletning nyere end denne kørsel: respekteret
            continue
        trees[k] = v
    new = {"version": 1, "updated": now[:10], "anchors": old.get("anchors", []), "trees": trees}
    with open(pp, "w", encoding="utf-8") as f:
        json.dump(new, f, ensure_ascii=False, indent=1)
    print(f"positions.json: {sum(1 for v in trees.values() if not v.get('del'))} placeringer ({kept} menneskelige bevaret)")

    review.sort()
    with open(os.path.join(DATA, "kk_gennemgang.md"), "w", encoding="utf-8") as f:
        f.write("# Træer til gennemgang efter match_kk.py\n\n")
        f.write(f"Genereret {now[:10]}. Disse {len(review)} træer fik ingen placering med sikkerhed 'høj' eller 'middel'. ")
        f.write("Placér dem i kalibreringstilstanden med ortofoto og KK-lag slået til (se KALIBRERING.md).\n\n")
        cur = None
        for sec, line in review:
            if sec != cur:
                cur = sec
                f.write(f"\n## Afdeling {sec}\n\n")
            f.write(f"- {line}\n")
    print("data/kk_gennemgang.md skrevet")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
