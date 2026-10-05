// Forvrænger et ortofoto (WMS GetMap i EPSG:3857 med kendt bbox) ind i kort.png's pixelnet,
// så det kan lægges 1:1 oven på kortet som data/orto_kort_2025.jpg. Se data/README.md.
//
// Kør:  node scripts/orto_warp.mjs orto_assistens_2025.jpg data/orto_kort_2025.jpg
// Kræver Node og Playwright med Chromium (tegningen sker i et canvas i headless Chromium).
//
// Afbildningen er den samme som sidens GPS-omregning: en affin mindste-kvadraters tilpasning
// fra (lon, lat) til kortbrøk (fx, fy) ud fra de fire indbyggede hjørneankre i index.html.
// Mercator er ikke perfekt affin, men over 1,6 km er restfejlen under en centimeter.
import { chromium } from 'playwright';
import fs from 'fs';

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) { console.error('brug: node scripts/orto_warp.mjs <orto.jpg> <ud.jpg>'); process.exit(2); }

// bbox (minx, miny, maxx, maxy) og størrelse fra WMS-kaldet, se data/README.md
const X0 = 1396280, Y0 = 7496357, X1 = 1397728, Y1 = 7497937, W = 4000, H = 4365;
const SCALE = 2;                                   // udgang: 2 × kort.png = 2800 × 2432
const IMGW = 1400, IMGH = 1216, LON0 = 12.55, LAT0 = 55.69, R = 6378137;

// de fire ankre læses fra index.html, så de ikke kan komme ud af trit med siden
const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const anchors = [...src.matchAll(/\{lat:([\d.]+),lon:([\d.]+),fx:(\d+)\/IMGW,fy:(\d+)\/IMGH/g)]
  .map(m => ({ lat: +m[1], lon: +m[2], fx: +m[3] / IMGW, fy: +m[4] / IMGH }));
if (anchors.length < 3) { console.error('fandt ikke SEED_ANCHORS i index.html'); process.exit(1); }

function lsq(get) { // samme 3×3-løsning som fitAffine() i index.html
  const S = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  anchors.forEach(p => { const r = [p.lon - LON0, p.lat - LAT0, 1], v = get(p);
    for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) S[i][j] += r[i] * r[j]; S[i][3] += r[i] * v; } });
  for (let i = 0; i < 3; i++) { let m = i; for (let k = i + 1; k < 3; k++) if (Math.abs(S[k][i]) > Math.abs(S[m][i])) m = k;
    const t = S[i]; S[i] = S[m]; S[m] = t;
    for (let k = i + 1; k < 3; k++) { const f = S[k][i] / S[i][i]; for (let j = i; j < 4; j++) S[k][j] -= f * S[i][j]; } }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) { x[i] = S[i][3]; for (let j = i + 1; j < 3; j++) x[i] -= S[i][j] * x[j]; x[i] /= S[i][i]; }
  return x;
}
const TX = lsq(p => p.fx), TY = lsq(p => p.fy);
const OW = IMGW * SCALE, OH = IMGH * SCALE;
function out(px, py) { // ortofoto-pixel -> udgangs-pixel
  const x = X0 + px / W * (X1 - X0), y = Y1 - py / H * (Y1 - Y0);
  const lon = x / R * 180 / Math.PI, lat = Math.atan(Math.sinh(y / R)) * 180 / Math.PI;
  const u = lon - LON0, v = lat - LAT0;
  return [(TX[0] * u + TX[1] * v + TX[2]) * OW, (TY[0] * u + TY[1] * v + TY[2]) * OH];
}
const [x00, y00] = out(0, 0), [x10, y10] = out(W, 0), [x01, y01] = out(0, H);
const M = { a: (x10 - x00) / W, b: (y10 - y00) / W, c: (x01 - x00) / H, d: (y01 - y00) / H, e: x00, f: y00, OW, OH };

const img = fs.readFileSync(inFile).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
const data = await page.evaluate(async ({ M, img }) => {
  const im = new Image(); im.src = 'data:image/jpeg;base64,' + img; await im.decode();
  const c = document.createElement('canvas'); c.width = M.OW; c.height = M.OH;
  const x = c.getContext('2d');
  x.fillStyle = '#777'; x.fillRect(0, 0, M.OW, M.OH);
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.setTransform(M.a, M.b, M.c, M.d, M.e, M.f); x.drawImage(im, 0, 0);
  return c.toDataURL('image/jpeg', 0.82);
}, { M, img });
await browser.close();
fs.writeFileSync(outFile, Buffer.from(data.split(',')[1], 'base64'));
console.log(`skrev ${outFile} (${OW}×${OH}, ${(fs.statSync(outFile).size / 1e6).toFixed(1)} MB)`);
