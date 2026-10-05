# data/ — kommunens data og ortofoto til kalibreringen

Filerne her bruges kun af kalibreringsværktøjet (**🛰 Ortofoto** og **🌳 KK-træer**
i kalibreringsbjælken) og af `scripts/match_kk.py`. Almindelige besøgende henter
dem ikke. Fremgangsmåde og vurdering: `KALIBRERING.md` og `NOTAT-kalibrering.md`.

## Kilder og licenser

| Fil | Indhold | Kilde | Licens |
|---|---|---|---|
| `kk_traeer.json` | 2.865 træer på Assistens Kirkegård fra kommunens træregister; 906 med art | Københavns Kommune, WFS-lag `k101:trae_basis` ([Træ basis på opendata.dk](https://www.opendata.dk/city-of-copenhagen/trae-basis-kommunale-traeer)) | CC BY 4.0 |
| `kk_gravsteder.json` | 8.599 gravsteder med afdeling, nummer og midtpunkt | Københavns Kommune, WFS-lag `k101:kirkegd_gravsteder` | CC BY 4.0 |
| `kk_afdelinger.json` | Afdelingsgrænser for Assistens Kirkegård (115 polygoner) | Københavns Kommune, WFS-lag `k101:kirkegd_afdelingsgr_1` | CC BY 4.0 |
| `kk_detekterede.json` | 2.928 LiDAR-detekterede træer med højde og kroneareal | Københavns Kommune, WFS-lag `k101:automatisk_detekterede_traeer_kk_beta` | CC BY 4.0 |
| `orto_kort_2025.jpg` | Forårsortofoto 2025, 10 cm, forvrænget ind i `kort.png`'s pixelnet (2800 × 2432) | GeoDanmark / Klimadatastyrelsen via [Dataforsyningen](https://dataforsyningen.dk/data/981) | CC BY 4.0 |
| `kk_gennemgang.md` | Træer, som `match_kk.py` ikke kunne placere sikkert | genereret | — |

Kreditering: *Trædata og gravsteder: Københavns Kommune (CC BY 4.0). Ortofoto:
GeoDanmark / Klimadatastyrelsen, Dataforsyningen (CC BY 4.0).* Begge står i
`README.md`.

## Format

JSON-filerne er kompakte tabeller: `{"kilde", "lag", "hentet", "felter": [...],
"rows": [[...], ...]}`, hvor `felter` navngiver kolonnerne i `rows`.
Koordinater er WGS84 (`lon`, `lat`, EPSG:4326) med seks decimaler.
`kk_afdelinger.json` er almindelig GeoJSON med `afd` og `navn` pr. polygon.
Siden omregner koordinaterne til kortet med de samme GPS-ankre som
kalibreringen (`llToFrac` i `index.html`).

Vigtigt fund: artsnavnene i træregistret bærer de samme stavefejl som listen
fra 2015 (“Crytomeria”, “Physocarbus”, “Atropupurea”), så registret er opmålt
med listen i hånden. Det gør matchningen i `match_kk.py` troværdig.

## Rå filer: `data/raw/` (ikke i repoet)

Læg de rå WFS-udtræk og det originale ortofoto (4000 × 4365 pixel) i
`data/raw/`; mappen står i `.gitignore`, så de aldrig ryger med i et commit.
Udtrækkene kan hentes igen uden token (se nedenfor), men ortofotoet kræver
en token på Dataforsyningen, så gem originalen. Den skal kun bruges igen,
hvis GPS-ankrene ændres og ortofotoet skal forvrænges på ny.

## Sådan genskabes filerne

1. Hent de rå WFS-lag (ingen token). Bbox er kirkegårdens omrids:

   ```
   BB="bbox=12.543,55.687,12.556,55.695,EPSG:4326"
   U="https://wfs-kbhkort.kk.dk/k101/ows?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application%2Fjson&SRSNAME=EPSG:4326"
   cd data/raw
   curl -o trae_basis.json   "$U&typeName=k101:trae_basis&maxFeatures=10000&CQL_FILTER=stednavn%3D%27Assistens%20Kirkeg%C3%A5rd%27"
   curl -o gravsteder.json   "$U&typeName=k101:kirkegd_gravsteder&maxFeatures=50000&$BB"
   curl -o afdelinger.json   "$U&typeName=k101:kirkegd_afdelingsgr_1&maxFeatures=1000"
   curl -o detekterede.json  "$U&typeName=k101:automatisk_detekterede_traeer_kk_beta&maxFeatures=50000&$BB"
   cd ../..
   python3 scripts/kk_hent.py data/raw/trae_basis.json data/raw/gravsteder.json data/raw/afdelinger.json data/raw/detekterede.json
   ```

2. Ortofotoet kræver en gratis bruger og token på dataforsyningen.dk. Hent
   kirkegården i Web Mercator, 4000 × 4365 pixel (ca. 20 cm pr. pixel):

   ```
   https://api.dataforsyningen.dk/orto_foraar_DAF?token=…&service=WMS&version=1.3.0&request=GetMap&layers=geodanmark_2025_10cm&styles=&crs=EPSG:3857&bbox=1396280,7496357,1397728,7497937&width=4000&height=4365&format=image/jpeg
   ```

   Gem det som `data/raw/orto_assistens_2025.jpg`, og forvræng det ind i
   kortets pixelnet med `scripts/orto_warp.mjs`
   (kræver Node og Playwright/Chromium; den affine afbildning beregnes af
   bbox'en og sidens fire GPS-ankre, se kommentaren i scriptet). Bruges en
   anden bbox eller størrelse, skal tallene i scriptet opdateres.

3. `python3 scripts/match_kk.py` skriver nye forslag til `positions.json`
   (menneskelige placeringer med `src` `kort`/`gps` bevares) og
   `kk_gennemgang.md`.

`orto_kort_2025.jpg` udløser **ikke** et bump af `VERSION` i `sw.js`; den
hentes først, når laget tændes, og caches derefter som alt andet.
