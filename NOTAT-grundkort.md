# Notat: Sådan skiftes kortet

*7. oktober 2026. Svar på issue #12 og præciseringen af 7. oktober: grundkortet
skal skiftes fra Københavns Kirkegårdes (KK) oversigtskort til projektets eget
kort af åbne data. Notatet beskriver den tekniske plan, de tre designretninger,
rettighederne, hvad en pitch skal kunne vise, og en felttest-protokol. Alt
bygget i denne omgang ligger bag kalibreringsknapperne; besøgende ser stadig
`kort.png`. OSM-udtrækket blev hentet 7. oktober fra en maskine med net; alle
renderinger, tal og skærmbilleder i notatet er med OSM-laget (se “Ikke gjort”).*

## Konklusion i fem linjer

1. Pixelnettet beholdes (1400 × 1216). Alle prototyper er renderet ind i det
   med den samme affine omregning som `scripts/orto_warp.mjs`, så ingen
   koordinat i `positions.json`, `FRACS` eller ankrene flyttes.
2. Kortet bygges i tre lag: et bitmap-grundlag (OSM-rendering *eller*
   dæmpet ortofoto), ét vektorlag (`data/afdelinger.svg`) med afdelinger,
   mure, bygninger og låger oven på begge, og sidens eksisterende datalag.
3. Afdelingsgrænserne kommer fra kommunens polygoner. 17 af de 19 afdelinger
   med træer findes direkte; **Q** findes ikke som polygon og er afledt af
   kommunens 176 Q-gravsteder; **U** findes hverken som polygon eller
   gravsteder og er et skøn, der skal tegnes af efter ortofotoet.
4. De håndtegnede `FRACS` kan udgå for 18 af 19 afdelinger, når vektorlaget
   er standard; polygonen er trykfladen, bogstavet dens etiket. U beholder
   indtil videre sin markør.
5. Anbefaling: se afsnit “Æstetik”. Valget træffes efter felttesten.

## 1. Teknisk plan

### Pixelnet: beholdt

Alle koordinater i projektet er brøkdele af `kort.png` (1400 × 1216). Det
nye kort renderes ind i præcis det net med den affine tilpasning fra de fire
GPS-ankre (hjørnerne fra OSM's polygon way 3099111), som `orto_warp.mjs` og
`llToFrac()` i `index.html` allerede bruger. Konsekvens: hver gemt koordinat
peger stadig på samme fysiske sted, ortofoto-varianten er gratis, og selve
skiftet er bagefter ét billede plus afledte filer plus `VERSION`.

Udsnittet er ikke ideelt: kortet har park og signatur til venstre og højre,
som mobilbeskæringen i dag skærer væk med ren CSS (x 280–1290, dvs. 390 af
1400 px eller 28 %). Lodret er der lidt at hente (afdelingspolygonernes bbox
fylder y 41–1189 af 1216 px), så et tættere udsnit giver reelt kun det, CSS
allerede giver, plus en højere opløsning i samme filstørrelse. Det koster:
et omregningsscript, der skalerer `fx`/`fy` i `positions.json` (302
poster), `FRACS` (38 markører), de fire `SEED_ANCHORS`, ankrene i
`positions.json`, `orto_warp.mjs`'s konstanter og ortofotoet, kørt i ét
commit, plus ny `kort.*`, nyt `VERSION` og nye tests. Det er en dags
arbejde og en risiko for stille forskydninger, mod en gevinst, som
2-finger-zoom og 2×-filerne allerede giver.
Anbefaling: behold nettet nu; tag udsnittet op igen, når
grundkortet er skiftet og kalibreringen er færdig, hvor en omregning kan
testes mod feltplaceringer.

### SVG eller bitmap, lag for lag

| Lag | Form | Hvorfor |
|---|---|---|
| Grundlag (OSM-rendering eller ortofoto) | bitmap, webp + avif, 1× og 2× | luppen (`drawImage` af `#mapimg`) og mobilbeskæringen regner med et billede i 1400 × 1216; `<picture>` vælger format, `srcset` 2× til skarpe skærme |
| Det særlige (afdelinger, mure, bygninger, låger) | SVG inline i `#mapinner`, `viewBox 0 0 1400 1216`, klasser med præfiks `gk-`, farver som CSS-variabler | skarp ved zoom, følger lys/mørk uden ny fil, polygonerne er trykflader med `pointer-events`; 41 paths (19 trykflader + 22 underafdelinger) |
| Data (træprikker, hotspots, KK-træer, “Hvor er jeg?”) | som i dag (absolut positionerede elementer i `%`) | uændret; de ligger i `.mapinner` og følger beskæring og forstørrelse |

Vektorlaget indlejres inline (ikke `<img src=…svg>`), fordi polygonerne skal
kunne få `pointer-events` og tilstandsklasser (valgt, peek, ✓). Filen hentes
netværk-først som resten af `data/` og cachen falder tilbage offline.

### Budget i service workeren

Kriterium 5 i issue'et: i dag 215 KB for `kort.png` (102 KB webp, 76 KB
avif). Målinger af de nye filer står i tabellen i `data/README.md` (skrevet af
`scripts/kort_render.mjs`) og i afsnit “Tal” nedenfor. Besøgende henter kun
det valgte grundlag (ét format, én opløsning via `<picture>`/`srcset`), plus
vektorlaget; ortofoto-varianten bliver aldrig standard for besøgende, før
dens størrelse er inden for budgettet.

### Luppen

Luppen tegner i dag `#mapimg` (kort.png) 4× forstørret. Med vælgeren tegner
den det element, der er det valgte grundlag (`grundkortImg()`), så det, man
finjusterer efter, er det, man ser. Vektorlaget tegnes ikke i luppen (den
viser grundlaget, og krydset er det, der skal rammes). En fælde, fundet i
design-reviewet: på en telefon vælger `srcset` 2×-filen, men `naturalWidth`
er tæthedskorrigeret og siger stadig 1400, mens `drawImage` læser rå pixel;
skalaen tages derfor fra `currentSrc` (`gkSkala()`), og
`tests/grundkort.test.mjs` tjekker det ved DPR 2.

### Mobilbeskæringen

Uændret: `.mapinner{width:calc(100% * 1400/1010); margin-left:calc(-100% *
280/1010)}` beskærer til x 280–1290. Alle nye grundlag er renderet i samme
net, så beskæringen rammer det samme. Alt væsentligt (afdelingspolygonernes
bbox er x 297–1274, y 41–1189) ligger inden for udsnittet.

### FRACS-erstatning

Når vektorlaget er tændt, skjules `.hot`-knapperne, og `#afd-X`-polygonerne
får samme adfærd (`selectSec`, peek, `done`). Afstanden fra hver
`FRACS`-markør til polygonens arealvægtede centroide (0,46 m/px) står i
afsnit “Tal”: medianen er omkring 22 m og den største omkring 37 m (C), fordi
`FRACS` er placeret, hvor bogstavet står på KK's kort, ikke i afdelingens
midte. Det bekræfter, at `FRACS` kan udgå for de 18 afdelinger med en polygon
(bogstavet sættes i centroiden eller i et manuelt punkt i scriptet), mens U
beholder markøren, indtil dens grænse er tegnet af.

### Datalagene i ét kort

Ingen flettes på datasiden: `data/osm_assistens.json` (ODbL),
`data/kk_afdelinger.json` (CC BY 4.0), `data/orto_kort_2025.jpg` (CC BY 4.0)
og `positions.json` (projektets egne) er hver sin fil; kun renderingen og
siden lægger dem oven på hinanden. Det er en samling, ikke en afledt
database (se afsnit 3).

### Ét vedligeholdelsesscript

`scripts/kort_render.mjs` læser `data/osm_assistens.json` (hvis den findes),
`data/kk_afdelinger.json`, `data/kk_gravsteder.json` (til Q),
`data/kk_detekterede.json` (kronetekstur) og `data/orto_kort_2025.jpg`, og
skriver `data/afdelinger.svg`, de seks grundlag i 1× og 2× som webp, og et
afsnit med renderingsdato, OSM's udtræksdato og filstørrelser i
`data/README.md`. Frisk OSM-udtræk: `scripts/osm_slank.mjs` (curl-kommandoen
står øverst i scriptet). Ingen af filerne i `data/` kræver et `VERSION`-bump.

### Migrationen som commits

1. **OSM-udtræk** (gjort 7. oktober; gentages, når OSM er rettet): kør curl-kommandoen
   i `scripts/osm_slank.mjs`, læg svaret i `data/raw/osm_assistens.json`,
   kør `node scripts/osm_slank.mjs …` og `node scripts/kort_render.mjs`;
   commit `data/osm_assistens.json`, de genererede grundlag og
   `data/README.md`. Intet bump.
2. **Felttest og valg af retning** (ingen commit; afsnit 5).
3. **Afdeling U**: tegn U's grænse af efter ortofotoet (eller få polygonen
   fra kommunen) som en lille GeoJSON i `data/` eller en tabel i
   `kort_render.mjs`; kør scriptet igen. Intet bump.
4. **Vektorlaget som standard**: `#afdlag` tændes for alle, `.hot`-knapperne
   fjernes (eller beholdes som reserve bag en klasse), `FRACS` reduceres til
   det, `centerMap()` og “nærmeste afdeling” bruger (eller erstattes af
   polygonernes centroider). Bump `VERSION`.
5. **Grundkortet**: den valgte retnings 1×-billede bliver `kort.webp`/
   `kort.avif` (+ `kort.png` som kilde), `<picture>` får `srcset` 2×,
   krediteringslinjen “Kortdata © OpenStreetMap-bidragydere · afdelinger og
   træregister: Københavns Kommune (CC BY 4.0) · ortofoto: GeoDanmark (CC BY
   4.0)” sættes synligt under kortet, header-teksten “officielt kort” og
   “Københavns Kirkegårdes eget kort” rettes, README “Data og rettigheder”
   opdateres (KK-linjen fjernes). Bump `VERSION`. Her bortfalder spørgsmålet
   om tilladelse til KK's kort.
6. **Ortofoto for besøgende** (valgfrit): knappen 🗺 flyttes ud af
   kalibreringen som en enkel “Luftfoto”-omskifter, hvis størrelsen tillader
   det (afsnit “Tal”). Bump `VERSION`.
7. **Oprydning**: `scripts/orto_warp.mjs` og `kort_render.mjs` deler
   ankerlæsning; `data/README.md` og `KALIBRERING.md` opdateres; LICENSE-fil
   (afsnit 3).

## 2. Æstetik: de tre retninger

*Skærmbilleder fra headless Chromium på en 390 × 844-telefon (DPR 3) med
kalibrering tændt ligger i `docs/grundkort/` (`<grundlag>_<lys|moerk>_<lag|uden>.webp`,
`sol_*.webp` er sol-simuleringen, `lup_*.webp` luppen) og i PR'ens
sammenligningstavle. Målinger: design-rapporten `/tmp/design/rapport.md`
fra sessionen; tallene står i afsnit “Tal”. Skærmbillederne er genskabt
7. oktober med `scripts/grundkort_skaermbilleder.mjs`, efter at OSM-laget kom
ind: stier, mure, låger, bygninger og gadenavne er med i alle tre.*

| | tegnet plan | stille kort | ortofoto med lag |
|---|---|---|---|
| **Idé** | streg og flade som en klassisk kirkegårdsplan: papir, blæk-konturer, Fraunces 600-bogstaver, svag kronetekstur og gravstedsprikker | flade, dæmpede mos-toner uden konturer, stier som lyse mellemrum, Outfit-bogstaver | GeoDanmarks forårsfoto dæmpet (lys: papirslør; mørk: nedtonet), så vektorlaget bærer bogstaver og grænser |
| **For** | gentager headerens udtryk (Fraunces, papir/blæk); højeste kontrast (11:1 lys, 10:1 mørk); holder bedst i sol; en rigtig mørk udgave | roligst som baggrund for prikkerne; mindste fil (116 KB webp, 79 KB avif); markørerne træder tydeligst frem | viser det, man ser i felten (kroner, stier, tage); passer kommunens grænser inden for ca. 0,5 m; luppen får noget at sigte efter |
| **Imod** | over budgettet med OSM-laget (256 KB webp, 133 KB avif); underafdelingsnavne 3 CSS-px på telefon; luppen viser kun tekstur | grænser og tekstur forsvinder helt i sol; bogstaver kun 4,9–5,3:1; Outfit-bogstaver bryder med headerens Fraunces | lys tilstand 3,3–3,5:1 for bogstav mod foto (haloen redder det); tungest (292 KB / 826 KB 2×); gråt foto mod papir/mos-paletten |
| **Telefon i sol** | bedst: bogstaver 2,4:1 efter simuleringen, kontur og mur overlever | dårligst: fladen bliver hvid, kun bogstaverne står | bogstaverne holder via haloen; tynde grænser forsvinder først |
| **Mørk tilstand** | 9,7–10,9:1, blænder ikke | 5,1–5,3:1, lidt gråt | 4,9–5,3:1 med SVG-laget; fotoet er dæmpet nok |

Fælles iagttagelser:

- **Bogstaverne** er ca. 10 CSS-px høje på telefonen uden zoom (30 fysiske
  px ved DPR 3) og 18 CSS-px med 🔍 Forstør; det er læseligt. Sidens
  `.hot`-knapper (12 px Fraunces i en 30 px-cirkel) er stadig større.
- **Underafdelingsnavne** (UK, Ny Russisk, Iris …) er 3,2 CSS-px uden zoom
  og 5,7 med: ulæselige. De skal mindst fordobles eller kun vises ved zoom.
- **Dobbelte bogstaver**: uden vektorlaget står bitmap-bogstavet (i
  centroiden) og `.hot`-cirklen (på `FRACS`) ved siden af hinanden; med
  laget skjules `.hot`. Ved skiftet skal bitmap'en renderes uden bogstaver
  (vektorlaget bærer dem), eller `.hot` flyttes til centroiderne.
- **SVG-laget på KK's kort** virker i lys tilstand (5,1:1) men ikke i mørk
  (1,13:1, fordi KK's kort forbliver lyst); det er endnu et argument for
  at skifte.
- **Luppen** viser på tegnet/stille kun tekstur, på ortofotoet kroner; i
  kalibreringen er ortofotoet derfor det rigtige grundlag.

**Anbefaling:** *tegnet plan* som standardgrundlag for besøgende, med
vektorlaget som bærer af afdelingerne, og ortofotoet som grundlag i
kalibreringen (og eventuelt som “Luftfoto”-omskifter for besøgende, hvis
størrelsen tillader det). Begrundelsen er sol og mørke: tegnet plan er den
eneste retning, der både holder bogstaverne læselige i sol og har en mørk
udgave i sidens egne skrifter og farver. To forudsætninger: stier, mure,
låger og bygninger skal ind (OSM-udtrækket, ellers tegnes de af efter
ortofotoet), og underafdelingsnavnene skal gøres større. Stille kort
frarådes som standard på grund af sol. Valget bekræftes i felttesten
(afsnit 5), ikke på skærmen.

## 3. Rettigheder

*Ikke juridisk rådgivning. Kilderne til dette afsnit er samlet i rettigheds-
rapporten fra sessionen (ODbL 1.0 og CC BY 4.0 læst i kopier på GitHub;
OSMF's retningslinjer og ophavsretsloven kun som søgeuddrag, fordi siderne
var blokeret; opendata.dk's register og kommunens WFS er slået op direkte
7. oktober). Alt, der kun hviler på søgeuddrag, bør tjekkes mod originalen,
før det citeres i en pitch.*

### Hvad der er taget fra KK's kort, og hvad der bevidst ikke er

- **Taget (fakta, ikke ophavsret):** at afdelingerne hedder A–U, hvor de
  ligger, og at der skal være 19 af dem med træer. Det bruges kun som
  facitliste: KK's kort kontrollerer, at ingen afdeling mangler eller er
  mærket forkert. Selve grænserne kommer fra kommunens polygoner
  (`data/kk_afdelinger.json`), Q's fra kommunens gravsteder, U's fra et skøn,
  der skal tegnes af efter ortofotoet (ikke efter KK's tegning).
- **Ikke taget (beskyttet udtryk):** tegningen, stregføringen, farvevalget,
  signaturer og symboler, typografien, etiketternes placering, layoutet og
  generaliseringen. Renderingsscriptet åbner ikke `kort.png`, og
  verifikationen sammenligner de hyppigste farver i hver rendering med
  `kort.png`'s for at bevise det (afsnit “Tal”).
- **Kort er nævnt udtrykkeligt i ophavsretslovens § 1, stk. 2** (“Kort samt
  tegninger … af beskrivende art”), så KK's kort er efter alt at dømme et
  værk. EU-Domstolen (C-490/14, Esterbauer) har fastslået, at oplysninger
  trukket ud af et kort kan være en database; systematisk aflæsning af KK's
  tegning kunne altså ramme § 71 (katalogbeskyttelse). Det nye kort undgår
  det, fordi intet tal i det stammer fra tegningen: grænserne er kommunens,
  stier og bygninger OSM's, og et script tegner dem.
- **Løs ende:** `FRACS` (afdelingsmarkørerne) og de fire ankres pixelside er
  aflæst på `kort.png`. Det er få punktvise fakta, efter alt at dømme ikke en
  væsentlig del, men til en ren pitch bør `FRACS` udgå til fordel for
  polygonerne (afsnit 1), og ankrene bør om muligt genmåles mod ortofotoet.

### OSM og ODbL

- Et statisk billede renderet af OSM-data er et **Produced Work** (ODbL
  § 4.5 b). Det kræver en synlig notits (§ 4.3): “Kortdata ©
  OpenStreetMap-bidragydere (ODbL)” med link til
  openstreetmap.org/copyright, placeret ved kortet for den besøgende, ikke
  kun i README. Undtagelsen for små udsnit (under 10.000 m² eller under 100
  objekter) gælder ikke for kirkegården.
- **Samling, ikke afledt database:** `data/osm_assistens.json` (ODbL),
  `data/kk_afdelinger.json` (CC BY 4.0) og `positions.json` (projektets) er
  tre filer, der ikke henviser til hinanden, og med adskilte objekttyper
  (veje/bygninger fra OSM; afdelingsgrænser fra kommunen; træpunkter fra
  projektet og kommunen). Det er en Collective Database (§ 4.5 a), og
  renderingen er et Produced Work; share-alike når hverken `positions.json`
  eller afdelingerne. `osm_assistens.json` er selv et udtræk under ODbL og
  bærer licensen i feltet `licens`.
- **Undtagelsen:** afledes træplaceringer eller afdelingsgrænser (fx U) af
  OSM-koordinater og lægges i projektets egne filer, bliver de filer
  afledte databaser under ODbL. Derfor må U's grænse tegnes efter ortofotoet,
  ikke bygges af OSM's stier, og `natural=tree`-noder må aldrig kopieres til
  `positions.json`.
- **De fire GPS-ankre** (hjørner fra OSM way 3099111) er fire punkter fra ét
  objekt, langt under OSMF's tærskel på 100 objekter, og dermed en
  ubetydelig mængde.
- Stavemåde: projektet skriver “bidragydere” (Retskrivningsordbogens form);
  OSM's egen danske oversættelse bruger “bidragsydere”. Én form overalt.

### Kommunens data og GeoDanmark

- `trae_basis` har en datasætside på opendata.dk, hvor begge ressourcer er
  mærket “CC_BY” (feltet `license_id` i CKAN-API'et er tomt). Slået op
  7. oktober 2026 i opendata.dk's register (CKAN-API'et på admin.opendata.dk):
  Københavns Kommune har 216 datasæt, 196 under CC BY 4.0, 2 under CC0 1.0
  (“Toiletter TMF”, “Vejstøj 2022”) og 18 uden licensfelt. **Ingen** af dem
  dækker `kirkegd_afdelingsgr_1`, `kirkegd_gravsteder` eller
  `automatisk_detekterede_traeer_kk_beta`, og WFS'ens GetCapabilities siger
  kun `Fees: NONE` og `AccessConstraints: NONE` uden licens pr. lag.
  Licensen sættes altså pr. datasæt (CC0 forekommer), så “kommunens
  standardlicens” er en antagelse. **Forbehold:** CC BY 4.0 er ikke
  bekræftet for de tre lag; spørg Bydata, Københavns Kommune (bydata@kk.dk,
  dataejer ifølge WFS'en og datasætsiden for Træ basis). Mail-udkast:

  > **Emne:** Licens for WFS-lagene kirkegd_afdelingsgr_1 og kirkegd_gravsteder
  >
  > Jeg laver et frivilligt, ikke-kommercielt trækort over Assistens
  > Kirkegård (https://simon-jensen.github.io/assistens-traekort/) og bruger
  > lagene k101:kirkegd_afdelingsgr_1, k101:kirkegd_gravsteder og
  > k101:automatisk_detekterede_traeer_kk_beta fra wfs-kbhkort.kk.dk. Lagene
  > har ingen datasætside på opendata.dk, og GetCapabilities angiver ingen
  > licens. Kan I bekræfte, at de er udgivet under CC BY 4.0 ligesom “Træ
  > basis”, og hvilken krediteringstekst I ønsker? På forhånd tak.

- Q (afledt af kommunens gravsteder) og U (aftegnet efter GeoDanmarks
  ortofoto) ændrer intet: det er stadig kommunens hhv. GeoDanmarks data,
  bearbejdet, og CC BY 4.0 kræver blot, at bearbejdningen fremgår (§ 3 a).
- GeoDanmark/Klimadatastyrelsen: CC BY 4.0; krediteringen “indeholder data
  fra GeoDanmark / Klimadatastyrelsen, hentet …, bearbejdet” står allerede i
  `data/README.md`.

### Forslag til licens for projektets eget

- **Kode** (`index.html`'s HTML/CSS/JS, `sw.js`, `scripts/`, `tests/`):
  **MIT**. Den korteste tilladende licens; en kommune eller et lokaludvalg
  kan drive siden videre uden andet krav end copyright-linjen.
- **Egne data** (`positions.json`, `DESC`/`SEASON`, det renderede grundkort):
  **CC BY 4.0**, samme licens som kommunens og GeoDanmarks data, så en
  offentlig part kan bruge det hele under ét kendt vilkår. Undtagelser:
  `kk`-forslagene i `positions.json` indeholder kommunens data og krediteres
  som sådan; det renderede kort beholder OSM-notitsen; `osm_assistens.json`
  forbliver ODbL; `TREES` og `kort.png` er ikke projektets.
- **README skal have**, før en pitch: krediteringslinjen under kortet,
  `LICENSE`-fil (MIT, “Copyright (c) 2026 Simon Jensen”, med forord om at
  data og skrifter har egne licenser), “bearbejdet” ved hver CC BY-kilde, og
  de tre åbne punkter nævnt eksplicit: KK's tilladelse til det nuværende
  kort (bortfalder ved skiftet), tilladelsen til træfortegnelsen (Morten
  Scheller Jensen, 2015; listen kan være omfattet af § 71 til udgangen af
  2030), og kommunens bekræftelse af licensen på de tre lag.

Krediteringslinje til visning under kortet, når det nye kort er i brug (erstatter “Kort © Københavns Kirkegårde …”):

```
Kortdata © OpenStreetMap-bidragydere (ODbL) · afdelinger og gravsteder: Københavns Kommune (CC BY 4.0, bearbejdet) · ortofoto: GeoDanmark/Klimadatastyrelsen (CC BY 4.0, bearbejdet) · træliste: M. Scheller Jensen 2015
```

## 4. Hvad en pitch skal kunne vise

- **Det færdige kort** på en telefon, i lys og mørk tilstand, med afdelinger,
  træer og “Hvor er jeg?”, uden en eneste linje fra KK's tegning.
- **De åbne kilder**, én ad gangen: kommunens afdelinger og træregister,
  GeoDanmarks ortofoto, OpenStreetMap; og at kortet kan genskabes med ét
  script, når kilderne opdateres.
- **Krediteringen** synlig under kortet og fuldstændig i README; licensen på
  projektets egen kode og data, så en offentlig part ved, hvad den må.
- **En demo**: skift grundlag (tegnet ↔ luftfoto) med samme afdelinger og
  prikker ovenpå; luppen; kalibreringens fremdrift pr. afdeling.
- **Det, der mangler**: U's grænse, bekræftelse af licensen på afdelingslaget,
  tilladelse til KK's kort indtil skiftet. Sig det, før de spørger.

## 5. Felttest-protokol (Simon, telefon, `#kal=1`)

Gør det i denne rækkefølge; hver kombination tager et minut. Noter “ja/nej”
og ét ord om, hvad der generede.

1. **Dagslys, skygge, lys tilstand.** Tryk 🗺 Grundkort, indtil “tegnet plan”
   vises; tænd 🔲 Afdelinger. Kan du uden zoom finde afdeling F, Q og U? Er
   stierne til at følge med øjet? Gentag for “stille kort” og “ortofoto”.
2. **Direkte sol.** Samme tre grundlag. Hvad forsvinder først: tynde stier,
   afdelingsgrænser eller bogstaver? Ortofotoet plejer at tabe her.
3. **2-finger-zoom** på hvert grundlag: er bitmap'en skarp (2×), og er
   SVG-bogstaverne skarpe? Rammer et tryk på en polygon den rigtige afdeling
   (listen filtreres, bogstavet markeres)?
4. **Mørk tilstand** (slå telefonen om): gentag punkt 1 og 3. Blænder noget?
   Er mørk “tegnet plan” for kontrastfattig, eller mørk “stille” for grå?
5. **Kalibrering med lup**: vælg et træ, tryk på kortet, se luppen. Viser
   den det valgte grundlag? Er ortofotoet i luppen en hjælp til at ramme
   stammen, hvor tegningen ikke er?
6. **Pasning**: stå ved to låger og et stikryds, tryk 🧭 Hvor er jeg?, og se
   om prikken lander på lågen/krydset i OSM-renderingen og i ortofotoet.
   Noter afvigelsen i skridt.
7. **Q og U**: gå til Q (Niels Bohr) og U (ved Hans Tavsens Gade mellem T og
   UU). Passer Q's afledte grænse med stierne? Hvor går U's grænse i
   virkeligheden (tag et foto af stien, så U kan tegnes af)?
8. **Vælg** én retning og skriv tre linjer i issue #12: hvilken, hvad der
   skal rettes først, og om ortofotoet skal være et lag for besøgende.

## Tal

### Filstørrelser mod budgettet (kriterium 5)

Målt af `scripts/kort_render.mjs` (tabellen står også i `data/README.md`;
KB = 1024 byte; webp med Pillow quality 85, avif quality 62). Målet er
`kort.png` 215 KB, `kort.webp` 102 KB, `kort.avif` 76 KB.

| Grundlag (1×, 1400 × 1216) | PNG | WebP | AVIF | 2× WebP | 2× AVIF |
|---|--:|--:|--:|--:|--:|
| tegnet plan, lys | 681 | **256** | 133 | 675 | 301 |
| tegnet plan, mørk | 657 | 254 | 131 | 671 | 296 |
| stille kort, lys | 546 | **116** | 79 | 271 | 170 |
| stille kort, mørk | 526 | 102 | 70 | 236 | 148 |
| ortofoto, lys | 2628 | **292** | 208 | 826 | 638 |
| ortofoto, mørk | 2351 | 208 | 154 | 576 | 465 |
| `afdelinger.svg` | | 129 | | | |

Tallene er med OSM-laget (7. oktober). Uden laget var tegnet plan 83 KB og
stille kort 46 KB som webp og `afdelinger.svg` 24 KB, så OSM-laget (nabo-
karréernes bygninger, stierne, murene og gadenavnene) koster tegnet plan
ca. 170 KB og stille kort ca. 70 KB i 1×-webp; hvad hver del vejer, er ikke
målt. Stille kort ligger nu omtrent på budgettet (116 KB webp mod
`kort.webp`s 102, 79 KB avif mod `kort.avif`s 76), tegnet plan 2,5 gange over
som webp og 1,75 gange over som avif. To greb, der ikke er prøvet: tegn
bygninger uden for muren som flade uden skravering, og klip OSM-laget til en
smal bræmme om kirkegården. `afdelinger.svg` bærer nu også mure og bygninger
for hele udsnittet; Pages sender den gzippet, så 129 KB bliver langt mindre
over nettet. Ortofotoet ligger 3 gange over budgettet i 1× og 8 gange i 2×;
det kan være et lag, der hentes på forlangende (som i dag), ikke et
standardgrundlag offline.

### FRACS mod polygoncentroider (0,46 m pr. pixel)

Målt i integrationsarbejdet (`/tmp/fracs_afstande.md`, scriptet
`fracs_afstande.py`): arealvægtet centroide af afdelingens polygon(er) med
huller fratrukket, efter den affine omregning fra ankrene; samme mapping og
samme centroider som etiketterne i `kort_render.mjs`; Q = middel af de 176
gravstedsmidtpunkter. En uafhængig måling tidligt i sessionen uden
hul-fradrag gav samme tal for 14 af de 18 målte og 0,3–4,5 m anderledes for J, K,
M og O (K: 22,9 mod 18,4 m), hvilket viser, hvor meget hullerne i K's og M's polygoner
flytter centroiden.

| Afd. | Polygoner | FRACS (px) | Centroide (px) | Afstand (m) |
|---|---|---|---|---|
| A | 1 | 815, 1069 | 865, 1047 | 25,4 |
| B | 1 | 834, 827 | 818, 800 | 14,3 |
| C | 1 | 990, 837 | 1036, 772 | 36,5 |
| D | 5 | 795, 601 | 858, 606 | 29,2 |
| E | 1 | 1009, 514 | 1044, 482 | 22,1 |
| F | 1 | 1034, 290 | 1101, 302 | 31,5 |
| G | 1 | 1049, 123 | 1063, 122 | 6,6 |
| H | 1 | 606, 1006 | 620, 1055 | 23,8 |
| J | 1 | 606, 809 | 627, 844 | 18,5 |
| K | 17 | 606, 662 | 631, 630 | 18,4 |
| L | 39 | 785, 481 | 808, 430 | 25,7 |
| M | 2 | 683, 350 | 636, 365 | 22,7 |
| O | 3 | 645, 151 | 636, 147 | 4,2 |
| P | 1 | 376, 1069 | 423, 1064 | 21,7 |
| Q | 176 gravsteder | 428, 819 | 434, 837 | 8,5 |
| R | 1 | 486, 552 | 435, 611 | 35,5 |
| S | 1 | 494, 340 | 466, 365 | 17,2 |
| T | 1 | 361, 393 | 378, 392 | 7,9 |
| U | ingen kilde | 362, 428 | – | – |

Median 21,9 m, største 36,5 m (C), mindste 4,2 m (O), 18 af 19 målt. Alle
19 markører ligger inde i den polygon, der bærer deres bogstav (A i A, …,
U i UU, L i Malus), så mærkningen stemmer med kommunens data; afstandene
skyldes, at markørerne står, hvor KK's kort har sit bogstav. Konklusion:
`FRACS` kan udgå som trykflader for de 18, polygonen overtager; U beholder
markøren, indtil grænsen er tegnet.

### Afdelinger: dækning i kommunens data

| | Antal | Kilde |
|---|---|---|
| Afdelinger med træer (TREESECS) | 19 | `index.html` |
| … med egen polygon hos kommunen | 17 | `data/kk_afdelinger.json` (D, K, L samlet af 5, 17 og 39 polygoner) |
| … afledt af gravsteder (Q) | 1 | `data/kk_gravsteder.json`, 176 punkter |
| … uden kilde (U) | 1 | skøn, cirkel om `FRACS["U"]`, radius 14 px |
| Kommunepolygoner i alt | 115 | 53 forskellige `afd`-koder |

### Farver: intet fra kort.png

Verifikationen (`/tmp/verifikation_1.md`, punkt 5) dekodede renderingerne og
`kort.png` og sammenlignede de ti hyppigste farver: renderingernes
hyppigste farve er sidens papir (`#f4f1e7` i lys, `#1c1f19` i mørk, afstand
1,0 fra CSS-variablen), mens `kort.png`'s grønne (`#cee2b8`, `#aec881`) og
blå (`#99b8cb`) ikke går igen i nogen rendering (nærmeste match er nær-hvid
eller grå med afstand 8,6 eller mere). `scripts/kort_render.mjs` åbner
aldrig `kort.png` (grep: filnavnet står kun i kommentarer).

### Kontrast, skrifthøjde og sol (design-rapporten)

WCAG-kontrast mellem afdelingsbogstav og flade (AA kræver 4,5:1), målt i
kildebillederne og i telefon-skærmbillederne (DPR 3), tre til seks
bogstaver pr. variant:

| Grundlag | Lys | Mørk |
|---|---|---|
| tegnet plan, bogstav i bitmap | 11,1–11,9 | 9,7–10,9 |
| stille kort, bogstav i bitmap | 4,9–5,3 | 5,1–5,3 |
| SVG-lag på tegnet plan | 5,1–5,2 | 5,4–5,6 |
| SVG-lag på stille kort | 4,4–4,6 | 4,6–4,7 |
| SVG-lag på ortofoto | 3,3–3,5 (bogstav mod halo 6,8) | 4,9–5,3 |
| SVG-lag på KK's kort | 5,1 | 1,13 (kun haloen bærer) |

Skrifthøjde på en 390 px-telefon: afdelingsbogstav 27–28 billedpx = 9,9
CSS-px (29,6 fysiske px ved DPR 3) uden zoom, 17,8 CSS-px med 🔍 Forstør;
underafdelingsnavne 9 billedpx = 3,2 CSS-px uden zoom, 5,7 med.

Sol-simulering (kontrast 0,45, lysstyrke 1,25 på de lyse skærmbilleder):
bogstav mod flade falder til 2,42 (tegnet), 1,9 (stille), 1,7 (ortofoto);
stille korts kronetekstur falder fra std 0,052 til 0,001 (væk), tegnet plans
fra 0,107 til 0,069, ortofotoets fra 0,105 til 0,080.

### Pasning: kommunens polygoner mod ortofotoet

Pasningen er målt for kommunens afdelingsgrænser
mod ortofotoet i 14 udsnit på 120 × 120 px (`/tmp/design/pasning_*.png`,
øjemål ±1 px). 11 kunne aflæses: median 1 px = 0,46 m, største 5 px =
2,3 m (ydermurens hjørne i A, hvor polygonen skærer hjørnet af); inde i
parken følger grænserne hække og stier inden for ca. 0,5 m. Tre punkter
(nordkanten langs Jagtvej, stikrydset ved Ny Russisk, R's vestkant) var
dækket af kroner eller skygge. Det, OSM leverer, står i næste afsnit; de
brede grusstier, tagene og teglmuren langs Nørrebrogade ses skarpt på
fotoet, nordmuren ved Jagtvej gør ikke.

### OSM: dækning og pasning (kriterium 4)

Udtrækket (Overpass, OSM-basis 7. oktober 2026 18:29 UTC; bbox
55,687–55,695 N, 12,543–12,556 Ø, plus way 3099111) har 2.798 elementer
(1.377 noder, 1.397 ways, 24 relationer), 1,5 MB råt og 462 KB slanket.
673 af dem ligger inden for kirkegårdens omrids. Målt med et lille script i
sessionen (afstande i `kort.png`'s pixelnet, 0,46 m/px):

- **Stier:** 154 `footway` (10,8 km), 51 `path` (3,2 km), 2 `cycleway`
  (Hans Tavsens Stien, Poppelalléen) og 5 `service`; 125 af de 212
  stistykker har `surface` (compacted 39, fine_gravel 38, asphalt 13,
  dirt 12, grass 11).
- **Mure, hegn, låger:** 12 murstykker (2,6 km), 2 hegn, 59 hække (1,0 km);
  6 `barrier=gate`, 1 `entrance` og 1 drejekors. Lågerne tegnes som
  åbninger i nærmeste mur.
- **Bygninger:** kapellet (`building=chapel`) og 13 andre (7 `yes`,
  4 skure, 1 `government`, 1 `service`).
- **Andet:** 10 `historic=tomb` med navn (H.C. Andersen, Niels Bohr,
  Dan Turèll, Martin Andersen Nexø m.fl.) og Ben Websters mindesten;
  47 bænke, 4 drikkevandsposter, 3 toiletter; 287 `natural=tree`, som
  bevidst ikke tegnes og aldrig må kopieres til `positions.json` (afsnit 3).
- **Gadenavne:** 15 navngivne gader rører rammen. Første rendering viste
  kun fem (Jagtvej, Meinungsgade, Peter Fabers Gade, Struenseegade og et for
  kort stykke af Frederik VII's Gade), fordi scriptet valgte den længste
  strækning pr. navn i hele bbox'en, og Nørrebrogades og Kapelvejs længste
  stykker ligger uden for billedet. Rettet i `kort_render.mjs` (strækninger
  med samme navn sammenføjes, klippes til rammen, og den længste del inden
  for rammen vinder): nu står også Nørrebrogade, Kapelvej, Sjællandsgade,
  Prinsesse Charlottes Gade og Hans Egedes Gade.

Pasning mellem OSM og kommunens polygoner (samme affine afbildning for
begge):

- OSM's omrids (way 3099111, 37 punkter) mod nærmeste kant i kommunens
  afdelingspolygoner: median 0,3 m, middel 1,1 m, 90 %-fraktil 1,7 m. Tre
  punkter ligger 4–16 m væk (ydermuren ved Jagtvej nord for G: 16 m; to
  punkter på vestsiden mod Hans Tavsens Park: 7 og 4 m), hvor kommunens
  afdelinger ikke når ud til muren; det er dækning, ikke forskydning.
- Omvendt har de 74 af kommunens 1.881 polygonpunkter, der ligger inden for
  10 px af OSM-omridset, median 0,4 m til det.
- OSM's mure (55 punkter på eller ved kirkegården) mod kommunens
  polygonkanter: median 0,3 m, 90 %-fraktil 6,7 m (de store afstande er
  murstykker, der ikke følger en afdelingsgrænse).

Sammen med polygonernes pasning mod ortofotoet (median 0,5 m, ovenfor)
betyder det, at OSM's stier og mure kan ligge i samme pixelnet som
afdelingerne uden lokal tilpasning. OSM er ikke målt direkte mod
ortofotoet; lågerne og stikrydsene tjekkes i felttesten (afsnit 5).

## Ikke gjort herfra, og hvorfor

- **OSM-udtrækket** er hentet 7. oktober fra en maskine med net
  (cloud-sessionens netværkspolitik blokerede Overpass og OSM's API).
  overpass-api.de svarer 406 på curls standard-User-Agent, så
  curl-kommandoen i `scripts/osm_slank.mjs` sætter `-A` med projektets navn.
  Slankning, rendering og skærmbilleder er kørt igen; dækning og pasning
  står i “Tal”. OSM's stier og låger er frivilliges aftegning og tjekkes i
  felten (afsnit 5).
- **Pasning af OSM mod ortofotoet** er ikke målt direkte; OSM er målt mod
  kommunens polygoner (median 0,3 m) og polygonerne mod ortofotoet
  (median 0,5 m).
- **Licensen på afdelingslaget** er stadig ubekræftet, nu efter opslag i
  originalerne (afsnit 3): opendata.dk har ingen datasætside for de tre lag,
  og WFS'ens GetCapabilities siger kun `Fees: NONE` og
  `AccessConstraints: NONE`. Mail-udkastet i afsnit 3 kan sendes til
  bydata@kk.dk.
- **Afdeling U** har ingen åben datakilde; grænsen skal tegnes af efter
  ortofotoet (felttest punkt 7) eller hentes hos kommunen.
- **KK's tilladelse til det nuværende kort** er stadig udokumenteret; den
  bortfalder først ved skiftet.
