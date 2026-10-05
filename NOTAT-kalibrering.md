# Notat: er GPS-kalibrering i felten den rigtige metode?

*5. oktober 2026. Vurdering af den nuværende metode (tryk på kortet + lup,
eller GPS pr. træ, localStorage, eksport via deleark, manuel commit af
`positions.json`) over for alternativerne. Netværksadgangen ved
udarbejdelsen var begrænset til søgeresultater; hvad der ikke kunne
verificeres direkte, står markeret.*

## Konklusion

Nej, ikke som hovedmetode. GPS i felten kan placere et træ i den rigtige
afdeling og i den rigtige ende af en række, men ikke skelne nabotræer, og
328 træer taget ét ad gangen er mange timers feltarbejde for et resultat, der
alligevel skal rettes bagefter. Den bedste vej er omvendt: placér træerne
hjemme ved computeren på et frit ortofoto (12,5 cm pr. pixel), gerne med
kommunens træregister som udgangspunkt, og brug felten til det, kun felten
kan: verificere arter og afgøre de tvivlstilfælde, hvor ortofotoet ikke
rækker. Omvisningen torsdag passer præcis til dét: artsverifikation og en
håndfuld markante træer.

## GPS under trækroner

- En telefon rammer typisk 3–10 m i det fri. Under gamle, tætte kroner som
  på Assistens giver flervejsudbredelse og skygning ofte 10–20 m, og det tal,
  telefonen selv oplyser (`accuracy`), er et skøn, der tit er for optimistisk.
- Træerne på listen står få meter fra hinanden; i rækker 3–6 m. Selv en god
  aflæsning (±5 m) dækker altså 2–4 kandidater. Kortets egen georeference er
  bedre end det (ankrene afviger 1,2 m RMS), så GPS er flaskehalsen.
- GPS er godt til: at bekræfte afdelingen, at finde “hvilken ende af
  rækken”, at give et groft første bud på træer, man ikke kan udpege på
  kortet, og at tidsstemple et besøg. GPS er ikke godt til: den endelige
  placering. Rå aflæsninger bør altid betragtes som et udgangspunkt for
  finjustering, aldrig som facit.
- Praktiske greb, der hjælper lidt: stå helt inde ved stammen, giv
  modtageren 5–10 sekunder, tag den bedste af flere aflæsninger
  (omvisningstilstanden gør det automatisk). De flytter resultatet fra
  “dårligt” til “brugbart”, ikke til “præcist”.

## Alternativer, der kan give mange træer på én gang

**Kommunens træregister (bedste kandidat, ikke verificeret).** Københavns
Kommune udgiver “Træ basis (Kommunale træer)” og “Gadetræer” på opendata.dk
(GeoJSON/CSV) og som WFS-laget `k101:trae_basis` på `wfs-kbhkort.kk.dk`
uden token. Felterne omfatter latinsk art, slægt, dansk navn og planteår;
registret rummer ca. 60.000 træer, heraf ca. 35.000 med art (treemap.dk,
2020). Kirkegårdene drives af Teknik- og Miljøforvaltningen, så træerne er
kommunale, men **om kirkegårdstræerne er med i registret, kunne ikke
verificeres**: WFS-kaldet blev blokeret af netværkspolitikken. Det afgøres
med ét kald fra en almindelig maskine:

```
https://wfs-kbhkort.kk.dk/k101/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=k101:trae_basis&outputFormat=json&SRSNAME=EPSG:4326&bbox=12.543,55.687,12.556,55.695,EPSG:4326
```

Kommer der hundredvis af træer med art, kan de matches mod listen på art +
afdeling (afdelingspolygoner aflæst i `kort.png`) og give et automatisk
første bud på de fleste af de 328, med GIS-nøjagtighed (typisk ≤1–2 m).
Kommer der ingen, falder kilden bort, og man har brugt ti minutter. Licensen
er typisk CC BY 4.0 for kommunens datasæt (ikke aflæst for netop dette).

**Frit ortofoto (bedste grundlag for præcision).** GeoDanmarks forårsortofoto
(Klimadatastyrelsen, tidl. SDFI) er frie data under CC BY 4.0 med 12,5 cm
pr. pixel (10 cm, hvor kommunen har tilkøbt) og en nøjagtighed på 20–30 cm.
Billederne er taget før løvspring, så kronerne, stammerne og gravstedernes
mønster er lette at se. Adgangen kræver en gratis bruger og en token.
Bemærk: Dataforsyningens `orto_foraar_wmts` lukker i bølger fra efteråret
2026; de blivende tjenester ligger på Datafordeleren (WMS og WMTS, også i
Web Mercator). Et ortofoto giver ikke art, men det er netop dér, listen fra
2015 og omvisningen bidrager. To måder at bruge det på: (a) georeferér
`kort.png` mod ortofotoet én gang i QGIS og placér træerne i QGIS, eksportér
til `positions.json`; (b) vis ortofotoet som skjult sidelag i
kalibreringstilstanden på computeren. (a) kræver ingen kode og kan starte i
morgen. Skråfoto (frie data, <5 m) er et supplement til at genkende arter
og kronefacon, ikke til koordinater.

**OpenStreetMap (lavest prioritet).** Antallet af `natural=tree`-noder med
artstag på kirkegården kunne ikke slås op (Overpass blokeret); forventningen
er få eller ingen. Og OSM’s licens (ODbL) kræver deling på samme vilkår for
en afledt database: kopieres mange koordinater derfra, skal `positions.json`
ud under ODbL. De fire hjørneankre, projektet allerede bruger, er
uproblematiske.

## Arbejdsgangen fra telefon til repo

Deleark + manuel commit er holdbart for én til to personer, der kender
repoet, og det er det, der findes nu. Det skalerer ikke til flere kolleger:
localStorage kan forsvinde (Safari efter 7 dages fravær; hjemmeskærmens
genvej har sit eget lager), fletning sker kun på “nyeste tidsstempel”, og
ingen får besked, hvis to personer placerer samme træ forskelligt. Et
lavteknologisk næste trin: en issue-skabelon på GitHub, hvor man indsætter
den eksporterede JSON, og én person fletter og committer; eller en lille
indbakke-mappe (`indbakke/*.json`), som check-scriptet fletter til
`positions.json` i CI. Begge kan vente, til der faktisk er flere end én i
marken.

Skal rå GPS-aflæsninger blive offentlige? Træerne er offentlige, og
koordinaterne er ikke følsomme i sig selv; det, der kan læses ud, er hvornår
en medarbejder stod hvor. Det er en lille sag, men ikke ingenting. Anbefaling:
behold `lat`/`lon`/`acc` (de gør det muligt at genberegne placeringer, hvis
georeferencen forbedres), men overvej at afrunde `ts` til dato ved eksport,
når placeringen alligevel er finjusteret. Det er en beslutning for repoets
ejer, ikke en teknisk nødvendighed.

## Anbefalet rækkefølge

1. **Torsdag (omvisningen):** artsverifikation og 5–15 præcise stop/placeringer
   af markante træer med omvisningstilstanden; notér uoverensstemmelser med
   listen i noter. Ikke fuld kalibrering, og ingen forventning om bedre end
   ±5–15 m i felten.
2. **Ti minutter ved en computer:** kør WFS-kaldet ovenfor. Er kirkegården
   med, er det den største enkeltgevinst i projektet.
3. **Ortofoto:** opret bruger/token, georeferér `kort.png` i QGIS (eller tilføj
   et sidelag), og placér træerne afdeling for afdeling hjemmefra ud fra
   gravstedsnumrene; brug torsdagens stop og GPS som kontrol.
4. **Felt kun til tvivl:** gå ud til de træer, ortofotoet ikke afgør, med
   tryk-på-kortet (ikke GPS) som metode, nu hvor kortet er fyldt ud.
5. **Arbejdsgang:** først når der er flere end én i marken, erstat deleark +
   manuel commit med en indbakke i repoet.

Intet af punkt 2–5 er implementeret i denne omgang; kun omvisningstilstanden
og dette notat.
