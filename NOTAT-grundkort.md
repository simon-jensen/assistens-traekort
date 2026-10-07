# Notat: Sådan skiftes kortet

*7. oktober 2026. Svar på issue #12 og præciseringen af 7. oktober: grundkortet
skal skiftes fra Københavns Kirkegårdes (KK) oversigtskort til projektets eget
kort af åbne data. Notatet beskriver den tekniske plan, de tre designretninger,
rettighederne, hvad en pitch skal kunne vise, og en felttest-protokol. Alt
bygget i denne omgang ligger bag kalibreringsknapperne; besøgende ser stadig
`kort.png`. Netadgangen fra sessionen var begrænset til GitHub og websøgning,
så OSM-udtrækket kunne ikke hentes; hvad det betyder, står under “Ikke gjort”.*

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

Udsnittet er ikke ideelt: kortet har 280 px park/signatur til venstre, som
mobilbeskæringen i dag skærer væk med ren CSS (x 280–1290). Et tættere
udsnit eller en højere opløsning ville give ca. 25 % mere kort på telefonen,
men koster: et omregningsscript, der skalerer `fx`/`fy` i `positions.json`
(302 poster), `FRACS` (38 markører), de fire `SEED_ANCHORS`, ankrene i
`positions.json`, `orto_warp.mjs`'s konstanter og ortofotoet, kørt i ét
commit, plus ny `kort.*`, nyt `VERSION` og nye tests. Det er en dags arbejde
og en risiko for stille forskydninger, mod en gevinst, som 2-finger-zoom
allerede giver. Anbefaling: behold nettet nu; tag udsnittet op igen, når
grundkortet er skiftet og kalibreringen er færdig, hvor en omregning kan
testes mod feltplaceringer.

### SVG eller bitmap, lag for lag

| Lag | Form | Hvorfor |
|---|---|---|
| Grundlag (OSM-rendering eller ortofoto) | bitmap, webp + avif, 1× og 2× | luppen (`drawImage` af `#mapimg`) og mobilbeskæringen regner med et billede i 1400 × 1216; `<picture>` vælger format, `srcset` 2× til skarpe skærme |
| Det særlige (afdelinger, mure, bygninger, låger) | SVG inline i `#mapinner`, `viewBox 0 0 1400 1216`, klasser med præfiks `gk-`, farver som CSS-variabler | skarp ved zoom, følger lys/mørk uden ny fil, polygonerne er trykflader med `pointer-events`, ~19 + 96 paths |
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
viser grundlaget, og krydset er det, der skal rammes).

### Mobilbeskæringen

Uændret: `.mapinner{width:calc(100% * 1400/1010); margin-left:calc(-100% *
280/1010)}` beskærer til x 280–1290. Alle nye grundlag er renderet i samme
net, så beskæringen rammer det samme. Alt væsentligt (afdelingspolygonernes
bbox er x 297–1274, y 41–1189) ligger inden for udsnittet.

### FRACS-erstatning

Når vektorlaget er tændt, skjules `.hot`-knapperne, og `#afd-X`-polygonerne
får samme adfærd (`selectSec`, peek, `done`). Afstanden fra hver
`FRACS`-markør til polygonens arealvægtede centroide (0,46 m/px) står i
afsnit “Tal”: medianen er omkring 23 m og den største omkring 37 m (C), fordi
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

1. **OSM-udtræk** (Simon, fra en maskine med netadgang): kør curl-kommandoen
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

*(Skærmbilleder: PR'ens sammenligningstavle; filerne ligger i `data/kort_*.webp`.)*

TBD-ÆSTETIK

## 3. Rettigheder

TBD-RETTIGHEDER

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

TBD-TAL

## Ikke gjort herfra, og hvorfor

TBD-IKKE-GJORT
