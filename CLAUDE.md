# Assistens Kirkegård · Trækort — regler for agenter og udviklere

Statisk single-page site på GitHub Pages: `index.html` indeholder CSS, HTML,
data og JavaScript. Intet byggetrin. Sproget er dansk i UI, kommentarer og
commits. Læs `README.md` (overblik) og `KALIBRERING.md` (positions.json og
merge-regler), før du ændrer noget.

## 1. Bump `VERSION` i `sw.js`, når cachede filer ændres (VIGTIGT)

`sw.js` er en service worker, der cacher siden hos besøgende. Cachen hedder
efter `VERSION`. Ændrer du en af filerne herunder uden at bumpe `VERSION`,
bliver besøgende ved med at se den gamle udgave.

Filer, der udløser et bump: `index.html`, `kort.png`, `kort.avif`,
`kort.webp`, alt i `fonts/`, `icon-*.png`, `manifest.webmanifest`.

Gør sådan, i **samme commit** som ændringen:

```
const VERSION = '2026-09-22';   // ret til dagens dato; ved flere deploys samme dag: '2026-09-22b'
```

CI (`.github/workflows/check.yml` → `scripts/check_sw_version.py`) fejler,
hvis en af filerne er ændret, og VERSION-linjen i `sw.js` er uændret.
`positions.json` kræver **ikke** et bump; den hentes altid over nettet.

## 2. Kør tjekket før du committer

```
python3 scripts/check_positions.py
```

Det validerer datablokkene i `index.html` og `positions.json`. Ubuntu-CI
kører det samme ved push og pull request.

## 3. Data ligger inline i `index.html` på én linje hver

`const TREES=…`, `DESC=…`, `SEASON=…` er meget lange linjer (op til 47 KB).
Læs dem ikke rå; parse dem med python:

```python
import re, json
src = open("index.html", encoding="utf-8").read()
def grab(n):
    m = re.search(r"const " + n + r"=(\[.*?\]|\{.*?\});\n", src, re.S)
    return json.loads(m.group(1))
```

- `t.sp` er kildens stavning og **må ikke rettes**: den indgår i træ-id'et
  (`sec|plot|sp`), som "set"-fluebenet og `positions.json` bruger. Stavefejl
  rettes i visningen via `SP_TOKEN`/`SP_PAIR` (giver `t._vis`).
- Beskrivelser (`DESC`) og sæson (`SEASON`) slås op via `specKey()`. Brug
  aldrig en anden arts beskrivelse som reserve for en slægt; kun en ren
  slægtsnøgle (fx `DESC["Catalpa"]`).

## 4. Kortet

`kort.png` (1400×1216) er kilden; `kort.avif` og `kort.webp` er afledte og
skal genskabes i **samme størrelse**, ellers rammer luppen og markørerne
forkert:

```
avifenc -q 75 -s 4 kort.png kort.avif
cwebp -q 85 -m 6 kort.png -o kort.webp
```

Alle koordinater (`FRACS`, `positions.json`, GPS-ankre) er brøkdele af det
fulde billede. Beskæringen på mobil er ren CSS og ændrer ikke koordinaterne.

## 5. positions.json

Format og merge-regler står i `KALIBRERING.md`. Kort: nøglen er træ-id'et,
`fx`/`fy` i 0–1, `ts` er ISO-tidsstempel, nyeste vinder, sletninger er
`{"del": 1, "ts": …}`. Filen committes af medarbejdere efter feltarbejde;
`scripts/check_positions.py` skal være grøn.

## 6. Lokal test

```
python3 -m http.server 8000     # åbn http://localhost:8000/
```

Service workeren cacher også lokalt. Ser du ikke dine ændringer: bump
`VERSION`, eller afregistrér workeren og ryd cachen i DevTools → Application.
GPS, udklipsholder og service worker kræver HTTPS eller localhost.

## 7. Deploy

GitHub Pages udgiver `main` direkte. Pages sender `cache-control:
max-age=600`, så ændringer kan være op til 10 minutter om at slå igennem.
Første besøg efter et deploy kan vise den gamle side én gang (service
workeren opdaterer i baggrunden); andet besøg viser den nye.
