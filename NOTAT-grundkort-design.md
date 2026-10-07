# Notat: Design-gennemgang af grundkortforslagene (PR #13)

*7. oktober 2026. Kartografisk og UX-mæssig gennemgang af de tre designretninger i
`NOTAT-grundkort.md` (tegnet plan, stille kort, ortofoto med lag), set fra en
telefon udendørs. Grundlag: renderingerne i `data/kort_*.webp`, skærmbillederne i
`docs/grundkort/`, `scripts/kort_render.mjs`, `data/afdelinger.svg`,
`data/osm_assistens.json` og `index.html` på `main` efter PR #13. Alle mål på
telefon er regnet for 390 CSS-px bredde med mobilbeskæringen (1010 af 1400 px),
altså 0,386 CSS-px pr. kortpixel.*

## Konklusion i fem linjer

1. **Fremgangsmåden holder.** Samme pixelnet, åbne data, ét script, polygoner som
   trykflader, ortofotoet i kalibreringen: det er rigtigt og skal ikke laves om.
   Koordinaterne røres ikke, uanset hvad der vælges nedenfor.
2. **Ingen af de tre retninger bør vælges, som de står.** Tegnet plan har de
   bedste bogstaver og de bedste mure, men den dårligste figur/grund og stier,
   man ikke kan se. Stille kort er roligst, men mangler hierarki: grænser og
   stier har samme farve, og bogstaverne er for spinkle. Ortofotoet er et lag, ikke
   et grundkort. KK's kort er i dag mere læseligt på telefonen end begge prototyper,
   og det er værd at forstå hvorfor (afsnit 2).
3. **Det bedste kort er en syntese, "plan":** KK-kortets tre greb (afdelinger som
   farvede flader, stier som brede lyse mellemrum, omgivelser næsten hvide) i
   sidens egne farver og skrift (papir, blæk, mos, Fraunces). Specifikation i
   afsnit 4; den kan renderes med det eksisterende script som en fjerde retning.
4. **Lagdelingen skal rettes, før der vælges.** I prototypen tegnes mure, bygninger,
   låger og bogstaver både i bitmap'en og i `afdelinger.svg`. Alt stregværk og al
   tekst hører hjemme i SVG'en, bitmap'en bærer højst flader; helst er hele kortet
   én SVG (afsnit 3). Det giver skarp 2-finger-zoom, gratis mørk tilstand, ingen
   2×-filer, og underafdelingsnavne, der kan vises kun ved zoom.
5. **Målingerne måler det forkerte.** Bogstavernes kontrast overlever i alle tre
   retninger; det, der forsvinder i sol og på telefon, er stier og grænser
   (0,5–0,9 CSS-px). Felttesten skal måle "find vej fra låge til træ", ikke
   "find bogstavet F" (afsnit 6).

## 1. Det, der er rigtigt

- **Pixelnettet beholdes.** Enhver anden beslutning havde kostet en omregning af
  302 placeringer, 38 markører og ankrene og en risiko for stille forskydninger.
  Rigtigt kald, og rigtigt at udskyde udsnitsspørgsmålet.
- **Tre lag, ét script.** Grundlag, det særlige og data er den rigtige
  opdeling, og `kort_render.mjs` er ét sted at vedligeholde. OSM-udtrækket viste
  sig at bære det meste: 208 sti-ways, 12 murstykker, 8 låger, 14 bygninger
  (kapellet 494 m², to skure, en forvaltningsbygning og ti småbygninger), 59
  hække og 11 navngivne gravsteder inden for muren.
- **Polygoner som trykflader** med bogstavet som etiket, og `FRACS` ud for 18 af
  19 afdelinger: rigtigt. Q afledt af gravstederne og U som markeret skøn er
  ærligt håndteret.
- **Rettigheder og kreditering** er gennemtænkt, og ortofotoet som grundlag i
  luppen er den rigtige konklusion (luppen på tegnet/stille viser kun tekstur,
  se `docs/grundkort/lup_tegnet.webp`).
- **Fonte i renderingen** er sidens egne, så kortet og headeren taler samme sprog.

## 2. Lag for lag: hvad billederne viser

Sammenlign `docs/grundkort/kk_lys_uden.webp` med `tegnet_lys_lag.webp` og
`stille_lys_lag.webp` i telefonstørrelse. KK's kort læses straks som "grønne
blokke med hvide stier imellem". Prototyperne læses som "en beige hhv. grøn
flade med prikker på". Forskellen er ikke farvevalg, det er hierarki.

### 2.1 Figur og grund: omgivelserne er for tunge

Kirkegården er motivet; byen omkring er kulisse. KK's kort gør byen næsten hvid.
I **tegnet plan** er nabokarréerne skraverede med 1,3 px blæk i 4 px-mønster og
har konturer; de er det mørkeste og mest urolige på hele kortet og trækker øjet
væk fra kirkegården, især langs Nørrebrogade. De koster også: omgivelserne
alene fylder 104 af filens 253 KB (målt ved at male kirkegårdens bbox over med
papirfarve og gemme igen). I **stille kort** er karréerne brune flader
(`bark` 32 %) og Hans Tavsens Park lige så grøn som kirkegården, så
kirkegården står ikke frem fra parken. I mørk tilstand bliver skraveringen hvid
på sort og blænder (`tegnet_moerk_lag.webp`).

**Anbefaling:** karréer som én flad, kontur-løs tone tæt på papiret
(`color-mix(ink 7 %, paper)`), gader som papir, parker en anelse lysere grøn end
kirkegården. Ingen skravering, ingen bygningskonturer uden for muren.

### 2.2 Stier: det vigtigste navigationslag er det mindst synlige

En besøgende finder et træ ved at følge stier. KK tegner stierne som brede, hvide
mellemrum mellem de grønne afdelinger (ca. 6 px i 1400-nettet, 2,3 CSS-px på
telefon). Prototyperne tegner stierne som linjer oven på en sammenhængende
flade:

| Element | px @1400 | CSS-px på telefon | ved 🔍 Forstør (250 %) |
|---|--:|--:|--:|
| sti (footway), begge retninger | 2,2 | 0,85 | 2,1 |
| sti (path) | 1,8 | 0,70 | 1,8 |
| afdelingsgrænse, tegnet plan | 1,35 | 0,52 | 1,3 |
| afdelingsgrænse, stille kort | 2,4 | 0,93 | 2,3 |
| mur | 3,0 | 1,16 | 2,9 |
| KK's sti-mellemrum | ca. 6 | 2,3 | 5,8 |

Under 1 CSS-px forsvinder en lys streg på en lys flade i sol og i halvskygge,
og i tegnet plan er stien oven i købet papirfarvet på en flade, der er 89 %
papir. I stille kort har stier og afdelingsgrænser samme farve og næsten samme
bredde, så kortet kan ikke fortælle, om en linje er noget, man går på, eller
noget, man går over.

**Anbefaling:** stier som negativt rum, tegnet *efter* afdelingsfladerne i
papirfarve: hovedalléer 7 px, footway 5 px, path 4 px, runde ender. Så
bliver afdelingerne "øer" mellem stierne, præcis som på KK's kort, og
afdelingsgrænser behøver kun en tynd streg dér, hvor to afdelinger mødes uden
sti imellem.

### 2.3 Afdelingsflader og -grænser: én tone og 39 øer

Alle 19 afdelinger har samme fyld. Identiteten hviler alene på en 0,5 CSS-px
blækstreg, og på telefonen kan man ikke se, hvor D holder op og B begynder,
uden at finde stregen. KK bruger to-tre grønne toner, så naboafdelinger
adskiller sig med det samme.

Kommunens polygoner har desuden en egenskab, der ikke er håndteret: L består af
39 polygoner, K af 17, D af 5, M af 2 (tabellen i `NOTAT-grundkort.md`). Hver
ø får sin egen blækkontur, og på telefonen ser L og K ud som bunker af små
kasser (`crop` af L/M-området bekræfter det). Det er polygonernes geometri, ikke
bygninger: OSM har kun 14 bygninger inden for muren.

**Anbefaling:** tre mos-toner (16 %, 24 %, 32 % i papir), fordelt så ingen
naboafdelinger deler tone (grådig farvning ud fra polygonernes naboskab; fire
toner, hvis tre ikke slår til). Øer i samme afdeling tegnes kun med fyld; stregen
lægges på afdelingens samlede ydergrænse (union af polygonerne, eller konveks
hylster pr. ø-gruppe med stierne som skillelinje). Underafdelinger (UK, Ny
Russisk, Iris …) samme tone som moderafdelingen med en 0,6 px lysere kant.

### 2.4 Bogstaver og navne

Fraunces 600 i blæk med papir-halo (tegnet plan) er det rigtige valg: det binder
kortet til headeren, og halo'en gør den uafhængig af underlaget. Outfit 400 i
mos på mos (stille kort) er for spinkel: 4,9–5,3:1 og tynd streg, som sol
æder først. 40 px giver 15,5 CSS-px skrift og ca. 11 CSS-px versalhøjde på
telefonen; det går, men 46 px er bedre, og fladerne har plads.

Underafdelingsnavnene er 13 px, altså 5 CSS-px på telefonen: ulæselige, som
notatet selv siger. De skal ikke fordobles i bitmap'en (så kolliderer de med
bogstaverne); de skal være SVG-tekst, der kun vises i `.mapwrap.zoom`, hvor 13 px
bliver 12,5 CSS-px.

I prototypen tegnes bogstaverne i øvrigt to gange, når 🔲 Afdelinger er tændt:
bitmap'ens blækbogstav og SVG'ens mosgrønne bogstav oven på hinanden
(`--gk-lbl-op` sættes i scriptets kompositbilleder, men ikke i `index.html`).
Det er dét, der giver de underligt tofarvede bogstaver i `tegnet_lys_lag.webp`.
Det påvirker vurderingen af sammenligningstavlen og bør rettes, før felttesten.

### 2.5 Teksturer: kroner, gravprikker, OSM-træer og hække

- **Kronetekstur** (2.928 cirkler i mos 5–6 %) giver plettet papir. På
  telefonen læses det som snavs, ikke som skov, og det koster filstørrelse
  (højfrekvent støj komprimerer dårligt). Fjern den fra grundkortet. Hvis man vil
  antyde beplantning, så som én flade (afdelingens tone) og ikke som pletter.
- **Gravstedsprikker** (8.567 punkter i blæk 16 %) er et klassisk
  kirkegårdsplan-tegn og ser fint ud i 1:1, men på telefonen er de under 1 px og
  bliver til gråt skær. Behold dem kun som et SVG-mønster, der vises ved zoom.
- **OSM's `natural=tree`** (287 prikker i mos 60 %) er en fejl i et trækort:
  de forveksles med sidens egne træprikker (7 px i `moss-d`), og de er
  tilfældige (OSM har kortlagt 287 af kirkegårdens flere tusind træer). Udelad.
- **Hække** (59 stykker i klar mos 2,6 px) ser ud som grønne streger strøet ud
  over K og S. Dæmp til 1,2 px i `moss-d` 50 %, eller vis dem kun ved zoom.

### 2.6 Mure, kapel, låger, bygninger

Det er det, der er bedst i tegnet plan: muren i blæk, kapellet som sort flade,
lågerne som åbninger i muren med tværstreger. Behold. To småting: omridset
(3,2 px) og muren (3 px) ligger oven på hinanden og giver en 6 px kant dér, hvor
OSM har mur; tegn kun én. Og de syv `building=yes` inde på kirkegården under
ca. 40 m² (fx Peter von Scholtens gravmæle på 32 m²) er gravmæler, ikke
bygninger; drop dem under en arealgrænse.

### 2.7 Mørk tilstand

Tegnet plan i mørk er en lysplan: hvid skravering, hvide konturer, hvide
bogstaver på sort. Det er flot i 1:1, men på en telefon om aftenen blænder det,
og det er det modsatte af, hvad mørk tilstand skal. Stille kort i mørk er den
bedste af de seks renderinger: dæmpet grøn flade, lysere stier, brune karréer,
ingen glans. Med flade omgivelser (2.1) og stier som negativt rum (2.2) får
"plan" den samme ro, men med Fraunces-bogstaver i lys blæk og muren som den
eneste skarpe linje. Fjern `.mapwrap img{filter:brightness(.88)}` for det nye
kort; det er en nødløsning for KK's lyse bitmap.

### 2.8 Sol

Sol-simuleringen (kontrast 0,45, lysstyrke 1,25) er en grov model, men den
viser det rigtige: det, der overlever, er mættede flader, brede lyse mellemrum
og fede bogstaver med halo; det, der forsvinder, er tynde linjer og svage
teksturer. Det taler for KK's og "plan"s opbygning og imod begge prototyper, som
begge bygger på tynde linjer. Mos-tonerne i "plan" bør derfor ligge i den
mættede ende (op til 32–36 %), og stierne skal være brede nok til at overleve
som mellemrum, ikke som streger.

### 2.9 Ortofotoet

Som grundlag for besøgende er det dæmpede ortofoto (45 % papirslør, mætning
0,7) et falmet fotokopi: det hverken viser kronerne tydeligt eller bærer
bogstaverne godt (3,3–3,5:1). Som *lag på forlangende* er det derimod
værdifuldt: besøgende genkender træer og stier, og kalibreringen har brug for
det. Vis det så klart (mætning 0,9, højst 15 % slør), og lad vektorlaget bære
alt med kraftig halo. 292 KB (826 KB i 2×) er for meget til at ligge i service
workerens standardcache; hent det, når knappen trykkes, som i dag.

### 2.10 Luppen

Luppen skal altid vise ortofotoet i kalibreringen; på et tegnet grundlag har
den intet at sigte efter. Det fjerner samtidig det eneste krav, der binder
grundkortet til et bitmap (`drawImage` af `#mapimg`), se afsnit 3.

## 3. Fremgangsmåden: lagdeling og format

Opdelingen i bitmap-grundlag og vektorlag er rigtig i princippet, men snittet
ligger forkert. I dag tegner bitmap'en også mure, bygninger, låger, stier,
gadenavne og bogstaver, og `afdelinger.svg` tegner mure, bygninger, låger og
bogstaver *igen* ovenpå. Det giver dobbelt tegning (2.4), to steder at
vedligeholde hver stil, og et bitmap, der skal findes i lys, mørk, 1× og 2×
(seks filer, 1,1 MB i repoet for tegnet plan alene).

**Anbefaling A (helst): hele kortet som én SVG.** `viewBox 0 0 1400 1216`, så
alle koordinater gælder uændret. Indhold: karréer som én sti pr. tone (ikke 562
`<path>` som nu), afdelinger (19 + 22), stier (én `<path>` pr. klasse), mure,
bygninger, låger, bogstaver, gadenavne. Teksturer udgår eller bliver
`<pattern>`. Det bliver skønsmæssigt 40–60 KB rå, 15–25 KB gzippet, mod 102 KB
webp i dag. Gevinster: skarp ved 250 % zoom uden 2×-filer; mørk tilstand gratis
via CSS-variabler; underafdelingsnavne, gravmønster og orienteringspunkter kan
vises kun i `.zoom`; stilen kan justeres i DevTools på telefonen i felten uden
at rendere igen; og fil-budgettet (kriterium 5) er løst. Det, der skal ændres i
`index.html`: `<picture>` erstattes af SVG'en indlejret inline (hentet som i dag
med `fetch` og cachet af service workeren med `VERSION`-bump), `.mapinner`-
beskæringen virker uændret på et `<svg width=100%>`, og luppen tegner
ortofotoet (2.10). Risici: ældre telefoner med 1–2.000 SVG-noder (holdbart,
hvis karréer og stier samles pr. klasse), og skriftindlæsning (Fraunces er
selv-hostet og allerede på siden). Prøv det på den ældste telefon i husstanden,
før det besluttes.

**Anbefaling B (hvis A viser sig tung): bitmap kun med flader.** Karréer,
parker, afdelingstoner og ortofoto i bitmap; alt stregværk og al tekst i
SVG'en. Flader uden tekstur komprimerer til få KB, og de to mørk-varianter kan
undværes, hvis fladerne tones med CSS (`filter`) i stedet for at renderes igen.

I begge tilfælde: fjern alt stregværk fra bitmap-funktionerne i
`kort_render.mjs`, og lad `afdelinger.svg` (eller `kort.svg`) være det eneste
sted, stier, mure, bygninger, låger og tekst findes.

**Processen.** De tre retninger varierer skrift, fyld, tekstur, stregføring og
omgivelser på én gang, så sammenligningen kan ikke sige, *hvad* der virker. Vurdér
pr. lag (afsnit 2) og saml det bedste: bogstaver og mure fra tegnet plan, ro og
mørk tilstand fra stille kort, flader og stier fra KK's opbygning.

## 4. Anbefalet retning: "plan" (specifikation)

Mål i px ved 1400 × 1216. Farver som sidens variabler; mørk tilstand får de
samme regler med mørk-paletten, intet `filter`.

| Lag | Lys | Mørk | Streg | Bemærkning |
|---|---|---|---|---|
| Baggrund | `paper` | `paper` | | |
| Karréer (OSM `building` uden for muren) | `color-mix(ink 7 %, paper)` | `color-mix(ink 8 %, paper)` | ingen | én flade, ingen skravering |
| Parker, græs | `color-mix(moss 8 %, paper)` | `color-mix(moss 10 %, paper)` | ingen | lysere end kirkegården |
| Gader | `paper` (negativt rum) | `paper` | ingen kant | navne i Fraunces kursiv 15 px, `faint` |
| Kirkegårdens grund (omrids 3099111) | `color-mix(moss 12 %, paper)` | `color-mix(moss 12 %, paper)` | | ses kun i stier og kanter |
| Afdelinger, tre toner | mos 16 / 24 / 32 % i papir | mos 18 / 26 / 34 % i papir | ingen kant mod sti | ingen naboer med samme tone; øer kun fyld |
| Afdelingsgrænse uden sti | `ink` 30 % | `ink` 30 % | 0,8 | kun hvor to afdelinger mødes uden sti |
| Underafdelinger | som moderafdeling | som moderafdeling | 0,6, `paper` 60 % | navn kun i `.zoom`, Fraunces kursiv 20 px |
| Stier | `paper` | `color-mix(ink 22 %, paper)` | hovedallé 7, footway 5, path 4, trappe 4 + tværstreger | tegnes efter fladerne, runde ender |
| Mur | `ink` | `ink` | 2,6 | én linje; omrids kun hvor OSM ingen mur har (1 px) |
| Låger | gab i `paper` 6 + tværstreger `ink` 1,4 | samme | | som i dag |
| Kapel | `ink` 85 % | `ink` 85 % | 1 | |
| Andre bygninger inde ≥ 40 m² | `bark` 35 % | `bark` 35 % | 0,8 `bark` | under 40 m² udelades |
| Hække | `moss-d` 50 % | `moss-d` 50 % | 1,2 | eller kun i `.zoom` |
| Bogstaver A–U | `ink`, halo `paper` 6 | `ink`, halo `paper` 6 | | Fraunces 600, 46 px, i centroiden (L og T manuelt som nu) |
| Orienteringspunkter (`.zoom`) | `faint` | `faint` | | Kapellet, Sansehaven, 4–6 kendte gravsteder fra OSM (`historic=tomb` med navn: H.C. Andersen, Niels Bohr, Kierkegaard hvis kortlagt …), WC, drikkevand; små, kursiv, kun ved zoom |
| Teksturer | ingen | ingen | | gravmønster evt. som `<pattern>` i `.zoom` |
| OSM-træer, bænke, skraldespande | udelades | | | |

Det, besøgende ser uden zoom, er dermed: grønne afdelinger i tre toner, hvide
stier, sort mur med låger, kapellet, 19 bogstaver, gadenavne. Alt andet kommer
ved zoom. Det er også den rækkefølge, øjet skal læse kortet i.

## 5. Interaktion og UX

- **Trykflader.** Polygonen er den rigtige visuelle flade, men ikke altid en
  tilstrækkelig trykflade: T er 37 px høj i nettet, altså 14 CSS-px på telefonen;
  U's skøn er 28 px i diameter. Apple og Google anbefaler mindst 44 CSS-px.
  Behold derfor `.hot`-knapperne som usynlige, 44 px store trykmål i centroiden
  (de findes allerede og er CSS-px-store), og lad polygonen være sekundært mål
  og den synlige tilstand. Så bevares også tastaturnavigation og `aria-pressed`.
- **Aktiv tilstand.** Guld-kant på polygonen og guld-bogstav er fint; tilføj et
  svagt fyld (`gold` 12 %), så hele fladen "lyser", ikke kun kanten.
- **Knappen 🗺 Grundkort** cykler gennem fire tilstande; det er i orden til en
  prototype, men ikke til en felttest, hvor man vil springe direkte. Brug en
  segmenteret vælger (fire små knapper) i kalibreringsbjælken. Når retningen er
  valgt, forsvinder den igen; tilbage bliver én knap for besøgende:
  **"Luftfoto"** (ortofoto til/fra). Den hører hjemme i `.maptools` ved siden af
  🔍 Forstør, ikke i kalibreringen.
- **Kreditering.** Den foreslåede linje (OSM, kommune, GeoDanmark, træliste) er
  fire linjer 10 px mono på en telefon. ODbL kræver kun en synlig notits med
  link. Skriv kort under kortet: "Kort: © OpenStreetMap-bidragydere · Københavns
  Kommune · GeoDanmark · [Om data og rettigheder]" med link til README, hvor den
  fulde tekst står.
- **Header og hint.** "Træerne lagt på Københavns Kirkegårdes eget kort" og
  `.maphint`s "Kort © Københavns Kirkegårde. Markørerne sidder …" skal rettes
  samtidig med skiftet (står allerede i migrationsplanen, trin 5).
- **Mørk tilstand** uden `filter` på kortet, og `#afdlag`'s `z-index` under
  prikkerne som nu.

## 6. Felttesten: tilføjelser til protokollen

Protokollen i `NOTAT-grundkort.md` afsnit 5 tester, om man kan *finde* F, Q og U
og om bogstaverne kan læses. Det består alle retninger. Tilføj:

1. **Vejfindingsopgaver med tid.** "Du står ved lågen fra Kapelvej; find træ
   nr. … i afdeling B" og "fra Nørrebrogade-lågen til afdeling O". Notér tid og
   antal gange, blikket flytter mellem telefon og omgivelser. Det er her stier
   som streger taber til stier som mellemrum.
2. **KK's kort som nullinje.** Alle opgaver køres også på KK's kort; det nye kort
   skal være mindst lige så hurtigt, ellers er skiftet et tab for besøgende, selv
   om det er en gevinst for rettighederne.
3. **Én anden person end forfatteren.** Den, der har tegnet kortet, kender det.
   En gæst, der aldrig har set siden, afslører hierarkiproblemerne på to minutter.
4. **Sol bagfra og forfra**, og telefonens lysstyrke på automatisk, ikke maks.
5. **Blyantstest:** print en side med alle retninger i telefonstørrelse i gråtone.
   Det, der stadig kan læses, er hierarkiet; farven må kun være en hjælp ovenpå.

## 7. Prioriteret rækkefølge

1. **Lagdelingen:** stregværk og tekst ud af bitmap'en og ind i SVG'en; ret
   dobbelttegningen af bogstaver i `index.html` (`--gk-lbl-op`, eller bedre:
   bitmap uden bogstaver). Luppen på ortofotoet altid.
2. **Render "plan"** efter tabellen i afsnit 4 som fjerde retning i
   `kort_render.mjs` (`--kun plan`), lys og mørk, og læg den i
   sammenligningstavlen. Fjern kroner, gravprikker, OSM-træer og skravering; stier
   som negativt rum; tre afdelingstoner; øer uden kontur.
3. **Afprøv ren SVG** (anbefaling A) på den ældste telefon; fald tilbage til B,
   hvis den hakker ved zoom.
4. **Trykmål:** `.hot` som usynligt 44 px-mål i centroiden; polygon som sekundært.
5. **Felttest** med vejfindingsopgaver og KK som nullinje (afsnit 6), og vælg.
6. **Derefter** det, der allerede står i migrationsplanen: U's grænse, kreditering,
   header, README, `VERSION`, "Luftfoto"-knap for besøgende.

## Tal brugt i notatet

- Telefon: 390 CSS-px, beskæring til 1010 af 1400 px: 0,386 CSS-px pr. kortpixel;
  🔍 Forstør: 250 % af det.
- Webp-størrelse delt op (målt med Pillow, q 85, kirkegårdens bbox x 297–1274,
  y 41–1189 malet over med baggrundsfarve): tegnet plan 253 KB i alt, 150 KB
  kirkegård, 104 KB omgivelser; stille kort 113 KB, 84 KB kirkegård, 32 KB
  omgivelser. Uden OSM-laget var tegnet plan 83 KB og stille 46 KB, så
  teksturerne alene koster omkring 40 KB.
- OSM inden for muren (`data/osm_assistens.json`, 7. oktober): 208 sti-ways
  (152 footway, 51 path, 5 service), 14 bygninger (1 kapel, 1 government, 4
  skure, 7 `yes`, 1 service), 12 mure, 2 hegn, 8 låger, 59 hække, 287
  `natural=tree`, 47 bænke, 10 `historic=tomb` med navn, 1 memorial; 550
  bygninger uden for muren.
- `afdelinger.svg`: 129 KB, heraf 562 enkeltstående bygningspaths.
