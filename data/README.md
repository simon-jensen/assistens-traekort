# data/ — kommunens data og ortofoto til kalibreringen

Filerne her bruges kun af kalibreringsværktøjet (**🛰 Ortofoto**, **🌳 KK-træer**,
**🗺 Grundkort** og **🔲 Afdelinger** i kalibreringsbjælken), af `scripts/match_kk.py`
og af `scripts/kort_render.mjs` (eget grundkort, issue #12). Almindelige besøgende henter
dem ikke. Fremgangsmåde og vurdering: `KALIBRERING.md` og `NOTAT-kalibrering.md`.

## Kilder og licenser

| Fil | Indhold | Kilde | Licens |
|---|---|---|---|
| `kk_traeer.json` | 2.865 træer på Assistens Kirkegård fra kommunens træregister; 906 med art | Københavns Kommune, WFS-lag `k101:trae_basis` ([Træ basis på opendata.dk](https://www.opendata.dk/city-of-copenhagen/trae-basis-kommunale-traeer)) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.da) (datasætsiden) |
| `kk_gravsteder.json` | 8.567 gravsteder med afdeling, nummer og midtpunkt (32 rækker uden kirkegård 1, afdeling eller nummer er sprunget over) | Københavns Kommune, WFS-lag `k101:kirkegd_gravsteder` | CC BY 4.0 *antaget* |
| `kk_afdelinger.json` | Afdelingsgrænser for Assistens Kirkegård (115 polygoner) | Københavns Kommune, WFS-lag `k101:kirkegd_afdelingsgr_1` | CC BY 4.0 *antaget* |
| `kk_detekterede.json` | 2.928 LiDAR-detekterede træer med højde og kroneareal | Københavns Kommune, WFS-lag `k101:automatisk_detekterede_traeer_kk_beta` | CC BY 4.0 *antaget* |
| `orto_kort_2025.jpg` | Forårsortofoto 2025, 10 cm, forvrænget ind i `kort.png`'s pixelnet (2800 × 2432) | GeoDanmark / Klimadatastyrelsen via [Dataforsyningen](https://dataforsyningen.dk/data/981) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.da) ([GeoDanmarks vilkår](https://www.geodanmark.dk/)) |
| `kk_gennemgang.md` | Træer, som `match_kk.py` ikke kunne placere sikkert | genereret | — |
| `osm_assistens.json` | Veje/stier, bygninger, mure, hegn, låger, natur og arealanvendelse på og omkring kirkegården (bbox 55,687–55,695 N, 12,543–12,556 Ø) samt kirkegårdens omrids (way 3099111): 2.798 elementer, én række pr. element med tags og geometri, hentet 7. oktober 2026; slankes med `scripts/osm_slank.mjs` fra `data/raw/osm_assistens.json` | OpenStreetMap-bidragydere via Overpass API (reserve: OSM API 0.6) | [ODbL 1.0](https://www.openstreetmap.org/copyright) · © OpenStreetMap-bidragydere |
| `afdelinger.svg`, `kort_*.webp` | Vektorlag med afdelinger og de tre grundlag i kort.png's pixelnet, genereret af `scripts/kort_render.mjs` (se afsnittet nedenfor) | afledt af filerne ovenfor | som kilderne, bearbejdet |

Kommunens og GeoDanmarks filer er hentet 5. oktober 2026 og OSM-udtrækket
7. oktober (feltet `hentet`); alle er *bearbejdede*
udgaver af kilderne (slanket til de felter, siden bruger; gravsteder
reduceret til polygonernes midtpunkter; ortofotoet forvrænget). CC BY 4.0
kræver, at det fremgår.

**Licens-forbehold:** kun `trae_basis` har en fundbar datasætside på
opendata.dk (licensfeltet “CC_BY”). For gravsteder, afdelingsgrænser og de
detekterede træer oplyser hverken WFS'ens GetCapabilities eller opendata.dk
en licens. Licensen sættes pr. datasæt af dataejeren (Open Data DK's
vilkår), og kommunen bruger ikke én licens til alt (fx har “Legepladser”
egne vilkår), så CC BY 4.0 er en *antagelse*, ikke bekræftet. Spørg
Københavns Kommune (Klima-, Miljø- og Teknikforvaltningen, åbne data /
kbhkort; mail-udkast i `NOTAT-grundkort.md`, afsnit 3), og notér svaret
her. Indtil da krediteres lagene som CC BY 4.0, og de bruges kun som data
(grænser og midtpunkter), ikke som kort.

Rettighedsmæssigt er afdeling Q (grænse afledt af kommunens 176 gravsteder
i Q) og afdeling U (skal aftegnes efter GeoDanmarks ortofoto) stadig
kommunens hhv. GeoDanmarks data, bearbejdet; ingen af dem er taget fra
Københavns Kirkegårdes tegnede kort.

`osm_assistens.json` er et bearbejdet udtræk af OpenStreetMap og er
selv under ODbL. Den holdes adskilt fra kommunens filer og fra
`positions.json` og flettes kun, når grundkortet renderes; træplaceringer
og afdelingsgrænser må ikke afledes af OSM-koordinater (så skulle de ud
under ODbL).

Kreditering (står i `README.md`): *Kortdata © OpenStreetMap-bidragydere (ODbL), når
OSM-laget er i brug. Indeholder data fra Københavns Kommune
(CC BY 4.0), hentet oktober 2026, bearbejdet. Ortofoto: indeholder data fra
GeoDanmark / Klimadatastyrelsen via Dataforsyningen (CC BY 4.0), hentet
oktober 2026, bearbejdet.*

<!-- kort_render:start -->
## Eget grundkort (`scripts/kort_render.mjs`)

Renderet 2026-10-07 med `node scripts/kort_render.mjs` (Playwright/Chromium; webp og avif med Pillow, da
cwebp/avifenc ikke fandtes). Fem retninger, hver i lys og mørk udgave, i 1× (1400 × 1216) og 2× (2800 × 2432):
`kort_tegnet*` (tegnet plan), `kort_stille*` (stille kort), `kort_orto*` (dæmpet ortofoto; afdelinger
tegnes kun af vektorlaget) og `kort_plan*` (plan: skitse af syntesen i `NOTAT-grundkort-design.md`, uden teksturer,
med stier som lyse mellemrum og afdelinger i tre-fire toner) og `kort_plangroen*` (plan, kortgrøn: samme opbygning
med en lysere, mere mættet kortgrøn i KK's retning og hvide stier). `afdelinger.svg` er vektorlaget med de 19 trykflader (`#afd-A` …) og følger
sidens CSS-variabler. Kun webp ligger i repoet; PNG og AVIF er målt lokalt.

- **OSM:** hentet 2026-10-07 (2798 elementer, © OpenStreetMap-bidragydere, ODbL); omrids fra OSM way 3099111.
- **Afdelinger:** 17 af 19 afdelinger er kommunens polygoner (D, K og L samlet af flere); **Q** er det konvekse hylster af 176 gravstedsmidtpunkter med afd="Q", bufret 3 m (`data-kilde="gravsteder"`); **U** er et skøn: en cirkel med radius 14 px (ca. 6,5 m) om skoens markør (`data-kilde="skoen"`). *Mangel:* U skal tegnes af efter ortofotoet.
- **Vegetation:** svag kronetekstur fra `kk_detekterede.json` (radius = √(kroneareal/π)) i tegnet plan og stille kort; gravstedernes midtpunkter som fin tekstur i tegnet plan.

KB = 1024 byte. 1×-målet fra issuet: `kort.png` 215 KB, `kort.webp` 102 KB, `kort.avif` 76 KB.

| Fil | Pixel | PNG (KB) | WebP (KB) | AVIF (KB) |
|---|---|--:|--:|--:|
| `kort_tegnet.webp` | 1400 × 1216 | 696 | 257 | 136 |
| `kort_tegnet@2x.webp` | 2800 × 2432 | 1550 | 680 | 306 |
| `kort_tegnet_moerk.webp` | 1400 × 1216 | 674 | 256 | 133 |
| `kort_tegnet_moerk@2x.webp` | 2800 × 2432 | 1496 | 684 | 302 |
| `kort_stille.webp` | 1400 × 1216 | 557 | 118 | 82 |
| `kort_stille@2x.webp` | 2800 × 2432 | 1241 | 277 | 175 |
| `kort_stille_moerk.webp` | 1400 × 1216 | 537 | 107 | 72 |
| `kort_stille_moerk@2x.webp` | 2800 × 2432 | 1196 | 240 | 152 |
| `kort_orto.webp` | 1400 × 1216 | 2682 | 297 | 211 |
| `kort_orto@2x.webp` | 2800 × 2432 | 8972 | 840 | 645 |
| `kort_orto_moerk.webp` | 1400 × 1216 | 2370 | 209 | 158 |
| `kort_orto_moerk@2x.webp` | 2800 × 2432 | 8184 | 590 | 472 |
| `kort_plan.webp` | 1400 × 1216 | 222 | 82 | 50 |
| `kort_plan@2x.webp` | 2800 × 2432 | 494 | 185 | 100 |
| `kort_plan_moerk.webp` | 1400 × 1216 | 240 | 85 | 51 |
| `kort_plan_moerk@2x.webp` | 2800 × 2432 | 535 | 192 | 102 |
| `kort_plangroen.webp` | 1400 × 1216 | 243 | 101 | 54 |
| `kort_plangroen@2x.webp` | 2800 × 2432 | 541 | 229 | 109 |
| `kort_plangroen_moerk.webp` | 1400 × 1216 | 239 | 106 | 57 |
| `kort_plangroen_moerk@2x.webp` | 2800 × 2432 | 534 | 234 | 116 |
| `afdelinger.svg` | viewBox 1400 × 1216 | | 129 (svg) | |
<!-- kort_render:end -->

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
   og `kk_gennemgang.md`. Scriptet rører kun sine egne poster (`src: "kk"`
   med en note, der begynder med “KK høj:”/“KK middel:”); menneskers
   placeringer, et kommunepunkt valgt i værktøjet og sletninger bevares.
   Uændrede forslag beholder deres tidsstempel; nye og ændrede stemples med
   datafilens `hentet`-dato kl. 00:00Z, aldrig kørselstidspunktet, så et
   forslag aldrig er “nyere” end feltarbejde. Andre topniveau-felter i
   `positions.json` (fx `stops`) bevares.

Filerne i `data/` udløser **ikke** et bump af `VERSION` i `sw.js`. Service
workeren henter dem netværk-først (offline gives sidst kendte kopi), så en
genskabt fil vises med det samme; ortofotoet hentes først, når laget tændes.
