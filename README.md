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
kortet. Fremgangsmåde og dataformat: [KALIBRERING.md](KALIBRERING.md).
Placeringerne deles via filen `positions.json` i repoets rod. **Bemærk:** rå
GPS-koordinater og tidsstempler i den fil bliver offentlige.

## Data og rettigheder

- Træfortegnelsen bygger på *Liste over mere specielle træer og buske på
  Assistens Kirkegård*, Morten Scheller Jensen, 2015. Åbenlyse stavefejl i
  artsnavnene rettes i visningen; kildens stavning står ved træet.
- Grundkortet `kort.png` er Københavns Kirkegårdes officielle oversigtskort
  (© Københavns Kirkegårde).
- Skrifttyperne Fraunces, Outfit og Spline Sans Mono er selv-hostede under
  SIL Open Font License 1.1 (se `fonts/OFL-*.txt`).
- Artsbeskrivelser og sæsondata (`DESC`/`SEASON` i `index.html`) samt
  `positions.json` er projektets egne data.

*Til opfølgning:* dokumentér tilladelsen til at gengive kortet og
træfortegnelsen, og vælg licens for koden (fx MIT) og for projektets egne
data (fx CC BY 4.0). Indtil da gælder almindelig ophavsret.

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
