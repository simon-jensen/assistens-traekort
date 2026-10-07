# Assistens Kirkegård · Trækort

Interaktivt kort over 328 bemærkelsesværdige træer og buske på Assistens
Kirkegård i København. Træerne er lagt på Københavns Kirkegårdes officielle
oversigtskort, afdeling for afdeling.

**Live:** https://simon-jensen.github.io/assistens-traekort/

## Brug

- Tryk på en afdeling på kortet for at se dens træer, eller søg på art, dansk
  navn eller gravstedsnummer.
- Filtre: **Sjældne** (botanisk sjældne arter), **★ Værd at se nu** (arter med
  noget at byde på i indeværende måned) og **Skjul sete**.
- Fluebenet "set" gemmes kun i din egen browser.
- **Sådan kender du den** åbner kendetegn i felten for de arter, der har en
  beskrivelse; de øvrige har et opslagslink til Wikipedia.
- Links kan deles med afdeling og søgning, fx `#afd=F&q=ginkgo`.

## Kalibrering (medarbejdere)

Træerne kan placeres præcist på kortet, på stedet med GPS eller med et tryk på
kortet; **🚶 Omvisning** gemmer et træ eller et stop med ét tryk, når der
ikke er tid til mere. De fleste placeringer kommer dog fra skrivebordet:
`scripts/match_kk.py` placerer træerne ud fra kommunens gravsteds- og
træregister, og **🛰 Ortofoto**/**🌳 KK-træer** viser luftfoto og registrets
punkter under kalibreringen. Fremgangsmåde og dataformat:
[KALIBRERING.md](KALIBRERING.md).
Placeringerne deles via filen `positions.json` i repoets rod. **Bemærk:** rå
GPS-koordinater, tidsstempler og noter i den fil bliver offentlige.

## Data og rettigheder

Kort fortalt: grundkortet er på vej fra Københavns Kirkegårdes tegnede kort
til projektets eget kort, renderet af et script ud fra åbne data
(OpenStreetMap, Københavns Kommune, GeoDanmark). Plan og prototyper:
[NOTAT-grundkort.md](NOTAT-grundkort.md) og issue #12. Intet her er juridisk
rådgivning.

- Træfortegnelsen bygger på *Liste over mere specielle træer og buske på
  Assistens Kirkegård*, Morten Scheller Jensen, 2015. Åbenlyse stavefejl i
  artsnavnene rettes i visningen; kildens stavning står ved træet.
- **Københavns Kirkegårdes kort er på vej ud.** Grundkortet `kort.png` er
  indtil videre Københavns Kirkegårdes officielle oversigtskort (© Københavns
  Kirkegårde); tilladelsen til at gengive det er ikke dokumenteret og gælder,
  indtil kortet er udskiftet. Det nye kort gengiver intet af KK's tegning
  (streger, farver, symboler, skrift, layout). Afdelingsbogstaver,
  afdelingernes beliggenhed og stiers og bygningers placering er fakta og
  hentes fra kommunens åbne data og OpenStreetMap, ikke fra tegningen; et
  script tegner dem, intet er kalkeret. KK's kort bruges kun til at
  kontrollere, at ingen afdeling mangler. Afdelingsmarkørerne (`FRACS`) blev
  aflæst på KK's kort og erstattes af kommunens polygoner ved skiftet.
- **OpenStreetMap:** kortdata © OpenStreetMap-bidragydere, under
  [Open Database License (ODbL)](https://www.openstreetmap.org/copyright).
  Det renderede grundkort er et “Produced Work” og krediteres synligt under
  kortet, når det tages i brug. `data/osm_assistens.json` er et slanket
  udtræk (`scripts/osm_slank.mjs`) og er selv under ODbL. OSM-data,
  kommunens afdelinger og `positions.json` ligger i hver sin fil, henviser
  ikke til hinanden og flettes kun i renderingen; samlingen er en
  “Collective Database” (ODbL § 4.5), så share-alike omfatter hverken
  `positions.json` eller afdelingsgrænserne. **Hent derfor aldrig
  træplaceringer eller afdelingsgrænser fra OSM-koordinater ind i projektets
  egne filer.** De fire GPS-ankre (hjørner fra OSM way 3099111) er en
  ubetydelig mængde og udløser ikke share-alike.
- Trædata, gravsteder, afdelingsgrænser og LiDAR-detekterede træer i
  `data/`: indeholder data fra Københavns Kommune, hentet 5. oktober 2026 fra
  kommunens WFS (wfs-kbhkort.kk.dk), bearbejdet (slanket til de felter, siden
  bruger, gravsteder reduceret til midtpunkter, afdeling Q's grænse afledt af
  gravstederne). Licens
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.da) ifølge
  datasætsiden for [Træ basis på opendata.dk](https://www.opendata.dk/city-of-copenhagen/trae-basis-kommunale-traeer);
  for de tre øvrige lag er licensen *ikke bekræftet* (ingen datasætside
  blandt kommunens 216 på opendata.dk, intet i WFS'ens GetCapabilities;
  tjekket 7. oktober 2026) og skal bekræftes hos kommunen (se
  `data/README.md`).
- Ortofoto forår 2025 (`data/orto_kort_2025.jpg`): indeholder data fra
  GeoDanmark / Klimadatastyrelsen, hentet 5. oktober 2026 via
  [Dataforsyningen](https://dataforsyningen.dk/data/981), bearbejdet
  (forvrænget ind i kortets pixelnet). Licens
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.da). Se
  `data/README.md`.
- Skrifttyperne Fraunces, Outfit og Spline Sans Mono er selv-hostede under
  SIL Open Font License 1.1 (se `fonts/OFL-*.txt`).
- Artsbeskrivelser og sæsondata (`DESC`/`SEASON` i `index.html`) samt
  `positions.json` er projektets egne data. **Forslag til licens** (ikke
  besluttet): koden (`index.html`'s HTML/CSS/JavaScript, `sw.js`,
  `scripts/`, `tests/`) under MIT, projektets egne data og det renderede
  grundkort under CC BY 4.0, samme licens som kommunens og GeoDanmarks data.
  Undtaget er `kk`-forslagene i `positions.json` (indeholder data fra
  Københavns Kommune), `data/osm_assistens.json` (ODbL), træfortegnelsen og
  `kort.png`, som ikke er projektets.

*Til opfølgning:* (1) dokumentér Københavns Kirkegårdes tilladelse til det
nuværende `kort.png`, indtil det er udskiftet; (2) dokumentér tilladelsen til
træfortegnelsen; (3) få kommunens bekræftelse af licensen for
`kirkegd_afdelingsgr_1`, `kirkegd_gravsteder` og
`automatisk_detekterede_traeer_kk_beta` (mail-udkast i NOTAT-grundkort.md);
(4) vælg licens for koden og projektets egne data (forslaget ovenfor) og læg
en `LICENSE`-fil i roden. Indtil da gælder almindelig ophavsret.

## Udvikling

Der er intet byggetrin. `index.html` indeholder CSS (inkl. `@font-face`),
HTML, data og JavaScript; `fonts/` er skrifttyperne. Kør
`python3 -m http.server` i mappen og åbn `http://localhost:8000/` (GPS,
udklipsholder og service worker kræver HTTPS eller localhost).

**Offline:** `sw.js` cacher siden, kortet og fontene, så den virker uden
dækning på kirkegården; `positions.json` hentes altid over nettet, når det
er muligt. **Bump `VERSION` i `sw.js` ved hvert deploy**, der ændrer
`index.html`, kortet, fontene eller ikonerne, ellers kan gamle besøgende
hænge fast i den gamle udgave. `manifest.webmanifest` og `icon-*.png` gør,
at siden kan lægges på hjemmeskærmen.

**Kortet** ligger som `kort.png` (kilde), `kort.webp` og `kort.avif`
(hentes af moderne browsere). Ændres kilden, genskab de to andre, i samme
størrelse (1400×1216, ellers rammer luppen og markørerne forkert):

```
avifenc -q 75 -s 4 kort.png kort.avif
cwebp -q 85 -m 6 kort.png -o kort.webp
```

`scripts/check_positions.py` tjekker datablokkene i `index.html` og
`positions.json`. Den kører automatisk i GitHub Actions ved push og pull
requests, så en fejl i `positions.json` ikke tavst fjerner alle placeringer.

Siden udgives fra `main` med GitHub Pages. Pages sender `cache-control:
max-age=600`, så ændringer kan være op til 10 minutter om at slå igennem.
