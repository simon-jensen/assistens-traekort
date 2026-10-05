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

Har du ikke tid til at stå og trykke på kortet (du går fx med i en omvisning),
så brug **🚶 Omvisning** — se afsnittet “Feltarbejde under en omvisning”
nedenfor. Det gemmer et træ eller et “stop” med ét tryk, og det grundige
arbejde kan vente til computeren.

## Fra telefon til repo (vigtigt)

Placeringerne ligger først kun i browserens lokale lager på den enhed, du
brugte. De skal eksporteres for at blive fælles:

1. Tryk **⬇ Eksportér** i kalibreringsbjælken. På telefonen åbner delearket,
   så du kan AirDrope eller maile filen `positions.json` til dig selv; på
   computeren downloades den. **📋 Kopiér** lægger i stedet indholdet på
   udklipsholderen. Eksporten henter først den nyeste committede fil og
   fletter dine lokale ændringer oven på den, så en gammel fane eller to
   personer i marken ikke overskriver hinandens arbejde; ved sammenfald på
   samme træ vinder posten med nyeste tidsstempel. **Eksporten kræver
   forbindelse:** kan den nyeste fil ikke hentes, afbrydes eksporten med en
   advarsel, for ellers ville filen kun indeholde dine egne placeringer, og
   alle andres ville forsvinde, når den blev committet.
2. Læg filen som `positions.json` i repoets rod og commit.
3. Når GitHub Pages har bygget, henter siden filen automatisk, og alle ser
   placeringerne.

**Importér…** kan flette en eksporteret fil ind på en anden enhed, hvis I er
flere, der kalibrerer, eller du skifter telefon undervejs. Ved sammenfald på
samme træ vinder posten med nyeste tidsstempel, både på kortet og i eksporten.
Sletninger følger med som poster med `"del": 1`, så et træ, en kollega har
slettet, ikke dukker op igen fra en gammel telefon. Uparrede stop fra en
omvisning følger også med (feltet `stops`), så de kan parres på computeren;
ved import springes stop over, som enheden allerede kender (samme `ts`), som
allerede er parret (lokalt, i den committede fil eller i den importerede
fil), eller som er slettet på denne enhed. Et stop, der slettes på
computeren, vender altså ikke tilbage fra telefonens næste eksport.

**Pas på browserens lager.** Placeringerne ligger i localStorage, indtil de er
eksporteret. Safari kan slette lageret for en side, der ikke har været brugt i
7 dage, og en genvej på hjemmeskærmen har sit *eget* lager adskilt fra Safari.
Eksportér derfor, inden du holder pause i længere tid eller skifter mellem
Safari og hjemmeskærms-genvejen.

## GPS-nøjagtighed og GPS-ankre

Telefon-GPS rammer typisk inden for 3–10 m i det fri og dårligere under tætte
trækroner. Til “hvilket træ i rækken er det?” er det som regel nok; vil du
tættere på, så brug GPS til det grove og kortet+luppen til det fine. Ligger
GPS-positionen mere end ca. 30 m uden for kortet (du står fx på kontoret),
sættes ingen placering.

**Koordinaterne bliver offentlige.** De rå GPS-aflæsninger (`lat`/`lon`),
tidsstemplerne og noterne eksporteres ordret til `positions.json`, som ligger
i et offentligt repo. Brug kun GPS-knappen, når du faktisk står ved træet, og
skriv ikke noget i en note, der ikke tåler at blive læst af alle.

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
   {"fx": 0.55918, "fy": 0.39225, "src": "kort", "ts": "2026-08-11T09:42:17.000Z"},
  "A|A-160|Ginkgo biloba":
   {"del": 1, "ts": "2026-08-12T14:03:55.000Z"}
 }
}
```

- Nøglen er `afdeling|gravsted|art` (samme id som “set”-funktionen bruger).
- `fx`/`fy` er brøkdele af kortbilledet (0–1), samme system som
  afdelingsmarkørerne. Skalaen er ca. 0,46 m pr. billedpixel.
- `src` er `kort` (trykket på kortet), `gps` eller `kk` (scriptets forslag
  fra kommunens data, se nedenfor); ved GPS og `kk` gemmes også de rå
  koordinater (`lat`, `lon`) og nøjagtigheden i meter (`acc`), og de bliver
  stående på en `kort`-post, der er flyttet fra en GPS-placering eller valgt
  fra et kommunepunkt. De rå koordinater betyder, at placeringerne kan
  genberegnes, hvis kort-georeferencen forbedres senere — feltarbejdet skal
  ikke gøres om. En `kk`-post har desuden en `note`, der forklarer, hvordan
  den blev fundet (“KK høj: gravsted direkte”). En post fra en parring bærer
  stoppets tidsstempel som `obs`.
- `fx`/`fy` er den gældende placering; `lat`/`lon` er den rå GPS-aflæsning
  bag den. Finjustering med pilene ændrer kun `fx`/`fy`, mens den rå
  aflæsning bliver stående som dokumentation.
- `ts` er tidspunktet for placeringen (ISO 8601, UTC). Ældre poster med kun
  en dato (`"2026-08-11"`) forstås stadig.
- En post med `"del": 1` er en sletning: træet vises uden placering, og
  posten bliver stående, så sletningen også når frem til andre enheder.
- Nøgler, der ikke matcher et træ, og koordinater uden for 0–1 ignoreres.
  `scripts/check_positions.py` (kører i GitHub Actions) fanger den slags,
  før filen når siden.
- `obs` (valgfri) sættes, når en placering er lavet ved at parre et stop fra
  en omvisning med et træ: `ts` er parringens tidspunkt (det, “nyeste
  vinder” regner med), `obs` er tidspunktet for selve GPS-aflæsningen.
- `stops` (valgfri, øverste niveau) er en liste af uparrede stop fra en
  omvisning: `{"ts": …, "lat": …, "lon": …, "acc": 12, "note": "…"}`;
  `lat`/`lon`/`acc`/`note` kan mangle (et stop uden GPS har kun tidspunkt).
  Feltet er kun transport fra telefon til computer: siden læser det **ikke**
  fra den committede fil, kun ved **Importér…**. Parr stoppene, før du
  committer; check-scriptet godkender feltet, men nævner antallet.

## Kommunens data: de fleste træer placeres fra skrivebordet

Københavns Kommune udgiver gravstedspolygoner, afdelingsgrænser, sit
træregister (art og koordinat) og LiDAR-detekterede træer som åbne data
(CC BY 4.0), og GeoDanmarks forårsortofoto er frit. Det giver langt bedre
placeringer end GPS, og det meste kan gøres hjemme. Filerne ligger i
`data/` (se `data/README.md`).

**`python3 scripts/match_kk.py`** placerer listens træer automatisk: listens
numre er kirkegårdens gravstedsnumre, så gravstedet slås op direkte eller
anslås mellem nabonumrene (numrene ligger fortløbende i rækkerne; 0,6 m
median-fejl på kendte gravsteder over hele kirkegården, 1,3 m i de
afdelinger listen bruger, og 90 % inden for 5 m, når naboerne står højst
15 m fra hinanden). Står der et registreret træ af samme art tæt på
gravstedet, bruges registrets punkt; ellers “snapper” et LiDAR-detekteret
træ. Hvert forslag får sikkerhed *høj*, *middel* eller *lav*: *høj* kræver et
registertræ med både slægt og art inden for 12 m af et gravsted, der er
fundet direkte eller anslået mellem naboer højst 15 m fra hinanden, eller et
detekteret træ ved et direkte fundet gravsted; et gravsted alene, et løst
anslået gravsted eller en match kun på slægten giver højst *middel*.
Gravstedsnumre med flere led (“D-1-2-2/7”, “K1-1-4”) går altid til
gennemgang. *Høj* og *middel* skrives til `positions.json` med `src: "kk"`,
`acc` i meter og en `note`; *lav* står i `data/kk_gennemgang.md`. Scriptet
rører kun sine egne poster: en placering, et menneske har lavet eller
slettet, bevares altid, og et forslag får aldrig et tidsstempel nyere end
datafilens hentedato, så det ikke kan “indhente” feltarbejde. Siden regner
desuden altid en menneskelig post for stærkere end et `kk`-forslag, uanset
tidsstempel. Besøgende ser `kk`-forslag som almindelige prikker; tag
stikprøver i felten, før for meget bygges på dem.

**Gennemgang i kalibreringstilstanden** (på computeren):
- **🛰 Ortofoto** lægger luftfotoet oven på kortet; skyderen styrer
  gennemsigtigheden. Kronerne kan ses enkeltvis, så et tryk på kortet kan
  lande på stammen.
- **🌳 KK-træer** viser registrets træer som blå punkter (fyldte: med art;
  blege: uden) og detekterede træer som grå prikker; hold musen over for
  art, planteår og højde. Har du valgt et træ i listen, sætter et tryk på et
  blåt punkt krydset dér med registrets koordinat; posten gemmes som dit
  valg (`src: "kort"` med `lat`/`lon`, `acc` 1 m og en note om punktet), så
  scriptet ikke rører den igen. Tryk så **✓ Gem**.
- Gå `data/kk_gennemgang.md` igennem afdeling for afdeling, og tjek gerne
  stikprøver af *middel*-forslagene (noten i værktøjet fortæller, hvordan
  de blev fundet). Et `kk`-forslag, der flyttes (pilene eller et tryk på
  kortet), bliver til en almindelig `kort`-placering uden scriptets
  koordinater og note og røres ikke af scriptet igen; gemmes det uflyttet,
  forbliver det et forslag.

Rettes ankrene (**⚓ GPS-ankre**), følger både ortofotoets punkter og
registrets punkter med; selve ortofotoet er forvrænget efter de indbyggede
ankre og skal genskabes med `scripts/orto_warp.mjs`, hvis de ændres.

## Feltarbejde under en omvisning

Går du med i en guidet omvisning, kan du ikke stå med lup og pile, mens
guiden taler og gruppen går videre. **🚶 Omvisning** (knappen i
kalibreringsbjælken, eller linket `#kal=1&tur=1`) er lavet til det: en fast
bjælke nederst med to store knapper, der kan rammes uden at kigge.

- **⏺ Stop her** gemmer et *stop*: tidspunkt + GPS-position, uden træ. Nul
  læsning, nul søgning. Du parrer stoppet med det rigtige træ hjemme.
- **📡 Gem 〈træ〉** vises, når du har valgt et træ i listen (tryk **🔍 søg**
  i bjælken, skriv fx “ginkgo”, tryk på artsnavnet). Ét tryk gemmer træet som
  GPS-placering (`src: gps`) og nulstiller valget, så næste tryk ikke kan
  lande på et forkert træ. Svaret lander altid på det træ, du trykkede for,
  også hvis du når at vælge et andet imens. Valgte du en række bare for at
  læse: tryk på den igen, eller på **✕ træ** i bjælken, så er den fravalgt.
- Tilstanden holder GPS’en kørende i baggrunden, så første tryk allerede har
  en frisk aflæsning (fra de seneste 4 sekunder). Et stop gemmes straks, om
  nødvendigt kun med tidspunktet, og forbedres stille i op til 8 sekunder,
  hvis en mere præcis aflæsning kommer (20 sekunder, hvis der ingen frisk
  aflæsning var). Et træ gemmes ved første brugbare aflæsning inden for
  kortet; kommer der ingen inden for 20 sekunder, gemmes i stedet et stop med
  træets navn som note, så intet forsvinder stille. Vinduet lukker, når
  skærmen låses eller telefonen lægges i lommen, så en aflæsning efter
  oplåsning aldrig flytter en gammel fangst hen til det næste træ, og kun én
  fangst ad gangen er åben. Bekræftelse: toast, et gyldent blink i bjælken og
  (Android) en kort vibration, når en aflæsning er landet — én for stop, tre
  for træ.
- **↶ fortryd** tager seneste fangst tilbage, også en træfangst, der stadig
  venter på GPS; **✎ note** sætter en kort note på den (“ved kapellet”,
  “guiden sagde *Zelkova*”); noten bliver offentlig. **✕ afslut** spørger
  først og slukker så tilstanden.
- Tilstanden huskes på enheden, når du selv tænder den med knappen, fordi
  en genvej på hjemmeskærmen åbner siden uden `#`-del. Et delt
  `#kal=1&tur=1`-link tænder den kun i den fane (en genindlæsning af fanen
  tænder igen, men der gemmes intet på enheden). Sluk med **✕ afslut**, når
  du er færdig.
- Et stop, der ligger mere end 30 m uden for kortet (et prøvetryk hjemme),
  gemmes lokalt, men kommer ikke med i eksporten; et træ gemmes slet ikke på
  en aflæsning uden for kortet. Parring af stop er slået fra i begge
  rækkefølger, mens omvisningen er tændt; det hører til computeren.

**Dagen før**
1. Åbn siden på telefonen *med net*, så service workeren cacher den, og læg
   den på hjemmeskærmen. Åbn genvejen (den har sit eget lager, se ovenfor),
   tryk **Vis værktøjet** i sidefoden, **📍 Kalibrér** og **🚶 Omvisning**.
2. Giv GPS-tilladelse, når browseren spørger (vælg “tillad”, ikke “kun denne
   gang”, hvis muligt). Vent, til bjælken viser “GPS ±… m”.
3. Test ét tryk på **⏺ Stop her**: toast + blink, og **⏺ Stop (1)** i
   kalibreringsbjælken. Slet det igen (**⏺ Stop** → *slet*), eller lad det
   stå; et stop uden for kortet eksporteres ikke.
4. Slå flytilstand til et øjeblik og genindlæs: siden skal stadig vise sig
   (offline). Oplad telefonen; GPS i baggrunden i to timer koster batteri.
   Lad tilstanden stå tændt.

**Under omvisningen**
- Guiden standser ved et træ: tag telefonen op, tryk **⏺ Stop her**, læg den
  væk. Det er alt. Stå så vidt muligt tæt på stammen i de sekunder, det tager.
- Kender du træet, og har du ti sekunder: **🔍 søg** → artsnavn → tryk på
  rækken → **📡 Gem**. Ellers tag et stop og notér evt. artsnavnet med
  **✎ note**, når gruppen går.
- Nævner guiden et træ, der ikke er på listen (nyt, eller listen fra 2015 er
  forældet): tag et stop og skriv artsnavnet i noten. Det ender som et
  uparret stop i eksporten og kan bruges til at rette `TREES` senere.
- Siger guiden et andet artsnavn end listen: tag et stop med note; ret ikke
  noget i felten (`t.sp` må ikke ændres, se CLAUDE.md).
- Tryk hellere ét stop for meget end ét for lidt; **↶ fortryd** findes.

**Bagefter (samme dag)**
1. Mens telefonen har net: **⬇ Eksportér** og send filen til dig selv
   (eller **📋 Kopiér**). Gør det samme dag: Safari kan rydde lageret for en
   side, der ikke er brugt i 7 dage, og genvejens lager er adskilt fra
   Safaris.
2. På computeren: åbn siden med `#kal=1`, tryk **Importér…** og vælg filen.
   Stoppene vises som blå, nummererede ruder på kortet og under **⏺ Stop**.
3. Parr: tryk på et stop (ruden eller *vælg* i listen), derefter på træet i
   listen — eller træet først og så ruden. Træet får stoppets GPS-position
   som `src: gps`, stoppet forsvinder, og noten følger med. Fortrudt?
   **↶ Fortryd seneste parring** i stop-boksen. Når filen er committet,
   forsvinder de parrede stop også fra telefonen af sig selv (posten bærer
   stoppets tidsstempel som `obs`), så de ikke parres igen ved næste eksport.
4. Finjustér: tryk på træets prik, flyt med kortet/luppen/pilene, **✓ Gem**.
   Den rå GPS-aflæsning (`lat`/`lon`/`acc`) og stoppets tidsstempel (`obs`)
   bliver stående i posten som dokumentation, også efter et tryk på kortet
   (posten får så `src: kort`).
5. Slet stop, der ikke kan parres (sletningen huskes på computeren, så de
   ikke kommer igen fra telefonen), **⬇ Eksportér** igen, læg filen som
   `positions.json` i repo-roden og kør `python3 scripts/check_positions.py`,
   før du committer. Tryk **✕**/**🚶 Omvisning** på telefonen, så tilstanden
   (og GPS’en) ikke bliver ved med at køre.

## Begrænsning

Rækker, der dækker flere gravsteder (fx “A-126 +1”), kan kun få én prik —
placér den ved hovedtræet, og tilføj evt. et `"note"`-felt i postens JSON
(JSON tillader ikke kommentarer; ekstra felter ignoreres af siden og
bevares ved eksport).
