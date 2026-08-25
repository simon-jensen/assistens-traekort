# Kalibrering: placér træerne præcist på kortet

Gravstednumrene fortæller, hvilken afdeling et træ står i — men ikke hvor i
afdelingen. Kalibreringstilstanden løser det: du placerer hvert træ præcist på
kortet, enten ved at trykke på kortet eller ved at stå ved træet og bruge
telefonens GPS. Placeringerne kan bagefter gemmes i repoet, så alle ser dem.

## Sådan gør du i felten

1. Åbn siden på telefonen: https://simon-jensen.github.io/assistens-traekort/
2. Kalibreringsværktøjet er skjult for almindelige besøgende. Slå det til
   nederst på siden: tryk **Vis værktøjet** under “Kalibrering” i sidefoden
   (valget huskes på enheden). Tryk derefter på **📍 Kalibrér** over kortet.
   Genvej: åbn linket med `#kal=1` i adressen, så starter kalibreringen
   direkte — praktisk at dele med kolleger.
3. Vælg evt. en afdeling på kortet først, så listen kun viser dens træer.
4. Tryk på et træ i listen. Placér det så på én af to måder:
   - **GPS:** Stil dig ved træet og tryk **📡 Brug GPS**. Nøjagtigheden vises
     (fx “±6 m”); stå stille et øjeblik, og tryk gerne igen for en ny aflæsning.
   - **Kortet:** Tryk på kortet, dér hvor træet står. Luppen viser udsnittet i
     4× forstørrelse, og pilene flytter krydset én billedpixel ad gangen
     (1 pixel er ca. en halv meter). Zoom gerne på selve siden med to fingre —
     tryk rammer stadig rigtigt.
5. Tryk **✓ Gem**. Det næste uplacerede træ i listen vælges automatisk, så du
   kan gå en afdeling igennem som en tjekliste. Bjælken øverst tæller fremdrift
   (“37 af 328 placeret · Afd. A: 3/25”), og en afdeling, hvor alle træer er
   placeret, får et ✓ på kortet.

Et placeret træ får en prik på kortet og et 📍 i listen. Uden for
kalibreringstilstanden viser et tryk på træet i listen en pulserende guldprik
på det præcise sted. Vil du flytte eller slette en placering: slå kalibrering
til, tryk på træet (eller dets prik på kortet) og brug **Slet placering**
eller placér forfra.

## Fra telefon til repo (vigtigt)

Placeringerne ligger først kun i browserens lokale lager på den enhed, du
brugte. De skal eksporteres for at blive fælles:

1. Tryk **⬇ Eksportér** i kalibreringsbjælken. På telefonen åbner delearket,
   så du kan AirDrope eller maile filen `positions.json` til dig selv; på
   computeren downloades den. **📋 Kopiér** lægger i stedet indholdet på
   udklipsholderen. Eksporten henter først den nyeste committede fil og
   fletter dine lokale ændringer oven på den, så en gammel fane eller to
   personer i marken ikke overskriver hinandens arbejde; ved sammenfald på
   samme træ vinder posten med nyeste dato.
2. Læg filen som `positions.json` i repoets rod og commit.
3. Når GitHub Pages har bygget, henter siden filen automatisk, og alle ser
   placeringerne.

**Importér…** kan flette en eksporteret fil ind på en anden enhed, hvis I er
flere, der kalibrerer, eller du skifter telefon undervejs. Lokale ændringer
har forrang over den committede fil, indtil de eksporteres igen.

## GPS-nøjagtighed og GPS-ankre

Telefon-GPS rammer typisk inden for 3–10 m i det fri og dårligere under tætte
trækroner. Til “hvilket træ i rækken er det?” er det som regel nok; vil du
tættere på, så brug GPS til det grove og kortet+luppen til det fine.

Omregningen mellem GPS-koordinater og kortbilledet bygger på fire indbyggede
ankre: kirkegårdens hjørner (Jagtvej/Hans Tavsens Gade, Hans Tavsens
Gade/Kapelvej, Kapelvej/Nørrebrogade og Nørrebros Runddel), aflæst fra
grænselinjen i `kort.png` og parret med OpenStreetMaps polygon for
kirkegården (way 3099111). Efter tilpasningen afviger de fire ankre 0,9–1,6 m
(RMS 1,2 m) — kortet er altså pænt målfast.

Vil du forbedre omregningen: tryk **⚓ GPS-ankre**, stil dig et sted, du
entydigt kan udpege på kortet (en låge, et hjørne), skriv et navn, tryk
**⚓ Nyt anker** — og tryk så på kortet, dér hvor du står. GPS-positionen
gemmes automatisk, og omregningen genberegnes med alle ankre (mindste
kvadraters metode). Listen viser afvigelsen pr. anker, så en dårlig
GPS-aflæsning er let at spotte og slette igen.

## Dataformat

`positions.json` ser sådan ud:

```json
{
 "version": 1,
 "updated": "2026-08-11",
 "anchors": [
  {"navn": "Lågen ved Kapelvej", "lat": 55.689283, "lon": 12.553067,
   "acc": 5, "fx": 0.46786, "fy": 0.95806}
 ],
 "trees": {
  "A|A-135|Liriodendedron tulipifera":
   {"fx": 0.55918, "fy": 0.39225, "src": "kort", "ts": "2026-08-11"}
 }
}
```

- Nøglen er `afdeling|gravsted|art` (samme id som “set”-funktionen bruger).
- `fx`/`fy` er brøkdele af kortbilledet (0–1), samme system som
  afdelingsmarkørerne. Skalaen er ca. 0,46 m pr. billedpixel.
- `src` er `kort` (trykket på kortet) eller `gps`; ved GPS gemmes også de rå
  koordinater (`lat`, `lon`) og nøjagtigheden i meter (`acc`). De rå
  koordinater betyder, at placeringerne kan genberegnes, hvis
  kort-georeferencen forbedres senere — feltarbejdet skal ikke gøres om.
- `fx`/`fy` er den gældende placering; `lat`/`lon` er den rå GPS-aflæsning
  bag den. Finjustering med pilene ændrer kun `fx`/`fy`, mens den rå
  aflæsning bliver stående som dokumentation.

## Begrænsning

Rækker, der dækker flere gravsteder (fx “A-126 +1”), kan kun få én prik —
placér den ved hovedtræet, og tilføj evt. et `"note"`-felt i postens JSON
(JSON tillader ikke kommentarer; ekstra felter ignoreres af siden og
bevares ved eksport).
