// Tegner projektets eget grundkort i kort.png's pixelnet (1400 × 1216) i tre retninger, hver i lys
// og mørk udgave, plus vektorlaget data/afdelinger.svg (trykflader for de 19 afdelinger). Se data/README.md.
//
// Kør fra repo-roden:
//   node scripts/kort_render.mjs                      # alle retninger
//   node scripts/kort_render.mjs --kun tegnet,stille  # kun nogle (tegnet, stille, orto)
// Kræver Node og Playwright med Chromium (tegningen er inline SVG i headless Chromium) og
// python3 med Pillow (webp/avif). cwebp/avifenc bruges ikke: PNG fra Chromium konverteres med
// Pillow, webp quality 85 method 6, avif quality 62 speed 4.
//
// Miljøvariabler:
//   UD=<mappe>   hvor tabsfri PNG, AVIF og kompositbilleder (bitmap + afdelinger.svg) skrives til måling;
//                standard <tmpdir>/kort_render. Kun webp og afdelinger.svg skrives i data/.
//   OSM=<fil>    læs OSM-laget fra en anden fil end data/osm_assistens.json (fx et testfixture).
//                Så skrives ALT til UD/osm_test, og hverken data/ eller data/README.md røres.
//
// Kilder: data/kk_afdelinger.json (afdelingspolygoner), data/kk_gravsteder.json (Q's flade og
// fin tekstur), data/kk_detekterede.json (kronetekstur), data/orto_kort_2025.jpg og, hvis den findes,
// data/osm_assistens.json (fra scripts/osm_slank.mjs). Farver og skrifter er sidens egne (:root i
// index.html); intet er aflæst fra kort.png, og kommunens kortstil er ikke kopieret.
//
// Afbildningen er den samme som sidens GPS-omregning og scripts/orto_warp.mjs: en affin
// mindste-kvadraters tilpasning fra (lon, lat) til kortbrøk (fx, fy) ud fra de fire hjørneankre.
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = createRequire('/opt/node-tools/node_modules/')('playwright'); }
const { chromium } = pw;

const T0 = Date.now();
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const P = (...a) => path.join(ROOT, ...a);
const rel = f => (f.startsWith(ROOT + path.sep) ? path.relative(ROOT, f) : f);
const args = process.argv.slice(2);
const kunIdx = args.indexOf('--kun');
const ALLE = ['tegnet', 'stille', 'orto', 'plan'];
const KUN = kunIdx >= 0 ? (args[kunIdx + 1] || '').split(',').filter(Boolean) : ALLE;
if (KUN.some(k => !ALLE.includes(k))) { console.error('brug: node scripts/kort_render.mjs [--kun tegnet,stille,orto,plan]'); process.exit(2); }

const OSM_STD = P('data', 'osm_assistens.json');
const OSM_FIL = process.env.OSM ? path.resolve(process.env.OSM) : OSM_STD;
const TEST = !!process.env.OSM && OSM_FIL !== OSM_STD;      // fixture-kørsel: aldrig skrive i data/
const UD0 = path.resolve(process.env.UD || path.join(os.tmpdir(), 'kort_render'));
const UD = TEST ? path.join(UD0, 'osm_test') : UD0;
const DATA_UD = TEST ? UD : P('data');
fs.mkdirSync(UD, { recursive: true });

// ---------- afbildning (uændret fra scripts/orto_warp.mjs) ----------
const IMGW = 1400, IMGH = 1216, LON0 = 12.55, LAT0 = 55.69;
const src = fs.readFileSync(P('index.html'), 'utf8');
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
const proj = ([lon, lat]) => { const u = lon - LON0, v = lat - LAT0;
  return [(TX[0] * u + TX[1] * v + TX[2]) * IMGW, (TY[0] * u + TY[1] * v + TY[2]) * IMGH]; };
// meter pr. pixel: kvadratroden af determinanten (m² pr. px²) for den lokale afbildning
const MLON = 111320 * Math.cos(LAT0 * Math.PI / 180), MLAT = 111132;
const det = Math.abs((TX[0] * IMGW / MLON) * (TY[1] * IMGH / MLAT) - (TX[1] * IMGW / MLAT) * (TY[0] * IMGH / MLON));
const MPP = 1 / Math.sqrt(det);

// ---------- geometri ----------
const r1 = x => Math.round(x * 10) / 10;
const fmt = p => `${r1(p[0])} ${r1(p[1])}`;
const area = r => { let a = 0; for (let i = 0, n = r.length; i < n; i++) { const p = r[i], q = r[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
function centroid(r) { let a = 0, cx = 0, cy = 0;
  for (let i = 0, n = r.length; i < n; i++) { const p = r[i], q = r[(i + 1) % n], f = p[0] * q[1] - q[0] * p[1]; a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f; }
  return [cx / (3 * a), cy / (3 * a)]; }
function inRing(pt, r) { let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
  return c; }
function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
function dp(pts, tol) { // Douglas-Peucker
  if (pts.length < 3) return pts;
  let mx = 0, mi = 0; const a = pts[0], b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i], a, b); if (d > mx) { mx = d; mi = i; } }
  if (mx <= tol) return [a, b];
  return dp(pts.slice(0, mi + 1), tol).slice(0, -1).concat(dp(pts.slice(mi), tol));
}
function ringPx(ll, tol = 0.4) { // lon/lat-ring -> forenklet pixelring uden gentaget slutpunkt
  let r = ll.map(proj);
  const closed = r.length > 2 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1];
  if (!closed) r.push(r[0]);
  r = dp(r, tol); r.pop();
  return r;
}
const orient = (r, cw) => ((area(r) > 0) === cw ? r : r.slice().reverse()); // skærm-y nedad: area>0 = med uret
const ringD = r => 'M' + r.map(fmt).join('L') + 'Z';
const lineD = r => 'M' + r.map(fmt).join('L');
function hull(pts) { // monotone chain
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const circle = (c, r, n = 32) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos(2 * Math.PI * i / n), c[1] + r * Math.sin(2 * Math.PI * i / n)]);
const plen = r => r.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - r[i][0], p[1] - r[i][1]), 0);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- afdelinger ----------
const LBL_FS = 40, SUB_FS = 13; // skriftstørrelse i px ved 1×; versalhøjden måles og skrives ud nedenfor
const TREESECS = JSON.parse(src.match(/const TREESECS=(\[.*?\]);/)[1]);
const MAP = { A: ['A'], B: ['B'], C: ['C'], D: ['D', 'D1', 'D2', 'D4'], E: ['E'], F: ['F'], G: ['G'], H: ['H'], J: ['J'],
  K: ['K', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'KA', 'KB', 'KC'], L: ['L', 'MALUS'], M: ['M'], O: ['O'], P: ['P'],
  R: ['R'], S: ['S'], T: ['T'] };
const SUBNAVN = { IRIS: 'Iris', 'GL.RUS': 'Gl. Russisk', 'GL FÆLLESGRAV': 'Gl. fællesgrav', 'Ny Russisk': 'Ny Russisk', GADEN: 'Gaden' };
// afd -> [x, y] i px, hvis centroiden af den største ring falder uden for fladen eller kolliderer:
// L's centroide rammer underafdelingen UL; T er kun ca. 37 px høj og deler hjørne med U's skøn.
const LBL_MANUEL = { L: [775, 478], T: [406, 392] };
const afdOf = {}; for (const [k, v] of Object.entries(MAP)) for (const a of v) afdOf[a] = k;
const AFD = JSON.parse(fs.readFileSync(P('data', 'kk_afdelinger.json'), 'utf8'));
const groups = {}; TREESECS.forEach(s => groups[s] = { polys: [], kilde: 'afdelinger' });
const subs = {}; // nøgle afd|navn
for (const f of AFD.features) {
  const g = f.geometry, polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
  const px = polys.map(p => p.map((ring, i) => orient(ringPx(ring), i === 0)).filter(r => r.length >= 3)).filter(p => p.length);
  const a = f.properties.afd, top = afdOf[a];
  if (top) groups[top].polys.push(...px);
  else { const k = a + '|' + f.properties.navn; (subs[k] = subs[k] || { afd: a, navn: f.properties.navn, polys: [] }).polys.push(...px); }
}
// Q: konveks hylster af gravstedernes midtpunkter, bufret ca. 3 m udad
const GRAV = JSON.parse(fs.readFileSync(P('data', 'kk_gravsteder.json'), 'utf8'));
const gi = Object.fromEntries(GRAV.felter.map((k, i) => [k, i]));
const qPts = GRAV.rows.filter(r => r[gi.afd] === 'Q').map(r => proj([r[gi.lon], r[gi.lat]]));
const QBUF = 3 / MPP;
groups.Q = { polys: [[orient(hull(qPts.flatMap(p => circle(p, QBUF, 16))), true)]], kilde: 'gravsteder', n: qPts.length };
// U: skøn ud fra skoens FRACS i index.html (kun denne ene værdi læses)
const FR = JSON.parse(src.match(/const FRACS=(\{.*?\});\n/s)[1]).U;
const UC = [FR[0] * IMGW, FR[1] * IMGH];
groups.U = { polys: [[orient(circle(UC, 14, 24), true)]], kilde: 'skoen' };
for (const s of TREESECS) if (!groups[s].polys.length) { console.error('afdeling uden flade: ' + s); process.exit(1); }

const inPolys = (c, polys) => polys.some(p => inRing(c, p[0]) && !p.slice(1).some(h => inRing(c, h)));
function labelPos(polys, manual) { // centroide af den største ring; skal ligge i fladen
  if (manual) return { p: manual, manual: true, inside: inPolys(manual, polys) };
  const big = polys.reduce((b, p) => (Math.abs(area(p[0])) > Math.abs(area(b[0])) ? p : b));
  const c = centroid(big[0]);
  return { p: c, inside: inPolys(c, [big]), area: Math.abs(area(big[0])) };
}
const LBL = {};
for (const s of TREESECS) { LBL[s] = labelPos(groups[s].polys, LBL_MANUEL[s]);
  if (!LBL[s].inside) console.warn(`ADVARSEL: etiketten for ${s} ligger uden for fladen; tilføj den til LBL_MANUEL`); }
const SUBL = Object.values(subs).map(sb => ({ ...sb, l: labelPos(sb.polys), txt: SUBNAVN[sb.navn] || SUBNAVN[sb.afd] || sb.navn }));
// underetiketter må ikke ramme de 19 bogstaver eller hinanden: største flade først, resten udelades
{ const boxes = TREESECS.map(s => [LBL[s].p[0] - 17, LBL[s].p[1] - 19, LBL[s].p[0] + 17, LBL[s].p[1] + 19]);
  const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  for (const sb of SUBL.slice().sort((a, b) => b.l.area - a.l.area)) {
    const w = sb.txt.length * SUB_FS * 0.3 + 2, h = SUB_FS * 0.55, [x, y] = sb.l.p, bx = [x - w, y - h, x + w, y + h];
    sb.vis = !boxes.some(b => hit(b, bx)); if (sb.vis) boxes.push(bx); } }
const SUBV = SUBL.filter(sb => sb.vis);
const polysD = polys => polys.map(p => p.map(ringD).join('')).join('');

// ---------- kronetekstur og gravstedstekstur ----------
const DET = JSON.parse(fs.readFileSync(P('data', 'kk_detekterede.json'), 'utf8'));
const di = Object.fromEntries(DET.felter.map((k, i) => [k, i]));
const KRONER = DET.rows.map(r => { const [x, y] = proj([r[di.lon], r[di.lat]]); return [x, y, Math.sqrt(r[di.kroneareal_m2] / Math.PI) / MPP]; })
  .filter(([x, y, r]) => x > -r && y > -r && x < IMGW + r && y < IMGH + r && r > 0.3);
const kronerSvg = KRONER.map(([x, y, r]) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}"/>`).join('');
const gravD = GRAV.rows.map(r => { const p = proj([r[gi.lon], r[gi.lat]]); return `M${fmt(p)}h0`; }).join('');

// ---------- OSM ----------
const OSM = fs.existsSync(OSM_FIL) ? JSON.parse(fs.readFileSync(OSM_FIL, 'utf8')) : null;
if (!OSM) console.log('OSM-lag mangler: data/osm_assistens.json findes ikke; kør scripts/osm_slank.mjs');
const O = { cem: [], fill: { gron: [], vand: [] }, vandlinje: [], vej: [], sti: [], trappe: [], navne: [], bygn: [], kapel: [], mur: [], hegn: [], haek: [], laager: [], traeer: [] };
// Uden OSM: konvekst hylster af de fire GPS-ankre (hjørnerne af OSM way 3099111) og alle afdelingspolygoner.
// Firkanten mellem ankrene alene skærer G, N og O over langs nordsiden, så den bruges ikke alene.
let OUTLINE = orient(hull(anchors.map(a => [a.fx * IMGW, a.fy * IMGH])
  .concat(Object.values(groups).concat(Object.values(subs)).flatMap(g => g.polys.flatMap(p => p[0])))), true);
let OUTLINE_KILDE = 'det konvekse hylster af de fire GPS-ankre og afdelingspolygonerne';
const VEJ = { primary: 16, secondary: 15, tertiary: 13, residential: 11, unclassified: 10, living_street: 9, pedestrian: 8, service: 6 };
const STI = { footway: 2.2, path: 1.8, cycleway: 2.2, bridleway: 1.8, track: 2.2, steps: 2.2, corridor: 1.4 };
if (OSM) {
  const fi = Object.fromEntries(OSM.felter.map((k, i) => [k, i]));
  const rows = OSM.rows.map(r => ({ type: r[fi.type], id: r[fi.id], t: r[fi.tags] || {}, g: r[fi.geom] }));
  const isClosed = g => g.length > 3 && g[0][0] === g[g.length - 1][0] && g[0][1] === g[g.length - 1][1];
  const areas = o => (o.type === 'relation' ? o.g.filter(r => r.length >= 3) : o.type === 'way' && isClosed(o.g) ? [o.g] : [])
    .map(r => orient(ringPx(r, 0.3), true));
  const line = o => o.g.map(proj).map(p => [r1(p[0]), r1(p[1])]);
  for (const o of rows) {
    const t = o.t;
    if (o.type === 'node') {
      const p = proj(o.g[0]);
      if (t.barrier === 'gate' || t.barrier === 'lift_gate' || t.entrance) O.laager.push(p);
      else if (t.natural === 'tree') O.traeer.push(p);
      continue;
    }
    if ((o.type === 'way' && o.id === 3099111) || t.landuse === 'cemetery' || t.amenity === 'grave_yard') {
      const a = areas(o); O.cem.push(...a);
      if (o.id === 3099111 && a.length) { OUTLINE = a[0]; OUTLINE_KILDE = 'OSM way 3099111'; }
      continue;
    }
    if (t.building) { (t.building === 'chapel' || t.building === 'church' || t.amenity === 'place_of_worship' ? O.kapel : O.bygn).push(...areas(o)); continue; }
    if (t.highway) {
      const area = t.area === 'yes' && o.type === 'way' && isClosed(o.g);
      if (area || o.type === 'relation') { O.fill.vej = (O.fill.vej || []).concat(areas(o)); continue; }
      const L = line(o);
      if (VEJ[t.highway]) { O.vej.push({ L, w: VEJ[t.highway] }); if (t.name && t.highway !== 'service') O.navne.push({ L, navn: t.name }); }
      else if (t.highway === 'steps') O.trappe.push(L);
      else if (STI[t.highway]) O.sti.push({ L, w: STI[t.highway] });
      continue;
    }
    if (t.barrier === 'wall' || t.barrier === 'retaining_wall' || t.barrier === 'city_wall') { O.mur.push(line(o)); continue; }
    if (t.barrier === 'fence') { O.hegn.push(line(o)); continue; }
    if (t.barrier === 'hedge') { O.haek.push(line(o)); continue; }
    if (t.barrier === 'gate') { O.laager.push(proj(o.g[0])); continue; }
    if (t.natural === 'water' || t.water || t.waterway === 'riverbank') { O.fill.vand.push(...areas(o)); continue; }
    if (t.waterway) { O.vandlinje.push(line(o)); continue; }
    if (t.natural === 'wood' || t.natural === 'scrub' || t.landuse === 'grass' || t.landuse === 'forest' || t.leisure === 'park' || t.leisure === 'garden') O.fill.gron.push(...areas(o));
  }
  // gadenavne: strækninger med samme navn sammenføjes ved fælles endepunkter, klippes til rammen (10 px inde),
  // og kun den længste del inden for rammen pr. navn beholdes; vendes, så teksten læses fra venstre.
  // (Uden klipningen vandt Nørrebrogades og Kapelvejs længste strækninger uden for billedet, og navnene udeblev.)
  const perNavn = {};
  for (const n of O.navne) (perNavn[n.navn] = perNavn[n.navn] || []).push(n.L);
  const best = {};
  for (const [navn, dele] of Object.entries(perNavn)) for (const kaede of joinLines(dele)) for (const L of clipFrame(kaede, 10)) {
    const l = plen(L); if (l > 0 && (!best[navn] || l > best[navn].l)) best[navn] = { navn, L, l };
  }
  O.navne = Object.values(best).map(n => ({ ...n, L: n.L[0][0] > n.L[n.L.length - 1][0] ? n.L.slice().reverse() : n.L }));
}
// sammenføjer polylinjer ved fælles endepunkter (som joinRings i osm_slank.mjs, men åbne kæder)
function joinLines(parts) {
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  parts = parts.filter(p => p.length >= 2).map(p => p.slice());
  const out = [];
  while (parts.length) {
    let L = parts.shift(), grown = true;
    while (grown) {
      grown = false;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i], a = L[0], b = L[L.length - 1];
        if (same(b, p[0])) L = L.concat(p.slice(1));
        else if (same(b, p[p.length - 1])) L = L.concat(p.slice(0, -1).reverse());
        else if (same(a, p[p.length - 1])) L = p.slice(0, -1).concat(L);
        else if (same(a, p[0])) L = p.slice(1).reverse().concat(L);
        else continue;
        parts.splice(i, 1); grown = true; break;
      }
    }
    out.push(L);
  }
  return out;
}
// klipper en polylinje til rammen (indrykket m px) med Liang–Barsky pr. segment; giver de dele, der ligger inde
function clipFrame(L, m) {
  const x0 = m, y0 = m, x1 = IMGW - m, y1 = IMGH - m, pieces = [];
  let cur = null;
  for (let i = 1; i < L.length; i++) {
    const [ax, ay] = L[i - 1], [bx, by] = L[i], dx = bx - ax, dy = by - ay;
    let t0 = 0, t1 = 1, ok = true;
    for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]]) {
      if (p === 0) { if (q < 0) { ok = false; break; } continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; }
      else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; }
    }
    if (!ok) { cur = null; continue; }
    const a = [r1(ax + t0 * dx), r1(ay + t0 * dy)], b = [r1(ax + t1 * dx), r1(ay + t1 * dy)];
    if (t0 > 0 || !cur) { cur = [a]; pieces.push(cur); }
    cur.push(b);
    if (t1 < 1) cur = null;
  }
  return pieces;
}
// låger: som åbning i den nærmeste mur (inden for 8 px), ellers en lille ring
const murSeg = O.mur.concat(O.hegn).flatMap(L => L.slice(1).map((p, i) => [L[i], p]));
const LAAGER = O.laager.map(p => {
  let bd = 8, bs = null; for (const s of murSeg) { const d = segDist(p, s[0], s[1]); if (d < bd) { bd = d; bs = s; } }
  if (!bs) return { p };
  const dx = bs[1][0] - bs[0][0], dy = bs[1][1] - bs[0][1], L = Math.hypot(dx, dy);
  return { p, u: [dx / L, dy / L] };
});
function laageSvg(l, cls) {
  const [x, y] = l.p;
  if (!l.u) return `<circle class="${cls}-ring" cx="${r1(x)}" cy="${r1(y)}" r="3.2"/>`;
  const [ux, uy] = l.u, h = 5, k = 3.5; // halv åbning og halv tværstreg i px
  const a = [x - ux * h, y - uy * h], b = [x + ux * h, y + uy * h];
  return `<path class="${cls}-gab" d="M${fmt(a)}L${fmt(b)}"/>` +
    `<path class="${cls}-kant" d="M${fmt([a[0] - uy * k, a[1] + ux * k])}L${fmt([a[0] + uy * k, a[1] - ux * k])}M${fmt([b[0] - uy * k, b[1] + ux * k])}L${fmt([b[0] + uy * k, b[1] - ux * k])}"/>`;
}
const osmStatus = OSM ? `OSM-lag fra ${rel(OSM_FIL)}, hentet ${OSM.hentet || '?'} (${OSM.rows.length} elementer)` : 'OSM-lag mangler';

// ---------- data/afdelinger.svg ----------
const afdPaths = TREESECS.map(s => `<path id="afd-${s}" data-afd="${s}" class="gk-afd"${groups[s].kilde !== 'afdelinger' ? ` data-kilde="${groups[s].kilde}"` : ''} d="${polysD(groups[s].polys)}"/>`).join('\n');
const subPaths = SUBL.map(sb => `<path class="gk-afd gk-sub" data-sub="${esc(sb.afd)}" d="${polysD(sb.polys)}"/>`).join('\n');
const afdLbls = TREESECS.map(s => `<text class="gk-lbl" data-afd="${s}" x="${r1(LBL[s].p[0])}" y="${r1(LBL[s].p[1])}">${s}</text>`).join('\n');
const subLbls = SUBV.map(sb => `<text class="gk-lbl gk-lbl-sub" data-sub="${esc(sb.afd)}" x="${r1(sb.l.p[0])}" y="${r1(sb.l.p[1])}">${esc(sb.txt)}</text>`).join('\n');
const MANGLER = '<!-- OSM-lag mangler: data/osm_assistens.json findes ikke; kør scripts/osm_slank.mjs -->';
const murSvg = O.mur.map(L => `<path class="gk-mur" d="${lineD(L)}"/>`).concat(O.hegn.map(L => `<path class="gk-mur gk-hegn" d="${lineD(L)}"/>`)).join('');
const bygnSvg = O.bygn.map(r => `<path class="gk-bygn" d="${ringD(r)}"/>`).concat(O.kapel.map(r => `<path class="gk-bygn gk-kapel" d="${ringD(r)}"/>`)).join('');
const laagerSvg = LAAGER.map(l => laageSvg(l, 'gk-laage')).join('');
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${IMGW} ${IMGH}">
<!-- Afdelinger på Assistens Kirkegård i kort.png's pixelnet, genereret af scripts/kort_render.mjs.
     Afdelingsgrænser: Københavns Kommune (CC BY 4.0), bearbejdet. Q er tegnet ud fra gravstedernes midtpunkter,
     U er et skøn (cirkel om skoens markør). ${OSM ? 'Mure, bygninger og låger: © OpenStreetMap-bidragydere (ODbL).' : 'OSM-lag mangler.'}
     Farver via sidens CSS-variabler (ink, paper, moss, moss-d, bark, faint med to bindestreger foran), så laget følger lys/mørk tilstand. -->
<style>
.gk-afd{fill:var(--gk-afd-fill,var(--moss,#5a7a4f));fill-opacity:var(--gk-afd-op,.08);stroke:var(--gk-afd-stroke,var(--moss-d,#3f5a37));stroke-width:1.2;stroke-linejoin:round;fill-rule:nonzero}
.gk-sub{fill-opacity:var(--gk-sub-op,.04);stroke:var(--gk-sub-stroke,var(--moss,#5a7a4f));stroke-width:.6;stroke-opacity:.8;pointer-events:none}
.gk-lbl{font-family:'Fraunces',serif;font-weight:600;font-size:${LBL_FS}px;text-anchor:middle;dominant-baseline:central;fill:var(--gk-lbl-fill,var(--moss-d,#3f5a37));stroke:var(--paper,#f4f1e6);stroke-width:6px;stroke-linejoin:round;paint-order:stroke;pointer-events:none;opacity:var(--gk-lbl-op,1)}
.gk-lbl-sub{font-weight:400;font-size:${SUB_FS}px;fill:var(--faint,#6f6a5c);stroke-width:3px}
.gk-mur{fill:none;stroke:var(--ink,#23271f);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.gk-hegn{stroke-width:1}
.gk-bygn{fill:var(--bark,#7a5c3e);fill-opacity:.3;stroke:var(--bark,#7a5c3e);stroke-width:.8;pointer-events:none}
.gk-kapel{fill-opacity:.6;stroke:var(--ink,#23271f)}
.gk-laage-gab{fill:none;stroke:var(--paper,#f4f1e6);stroke-width:5;pointer-events:none}
.gk-laage-kant{fill:none;stroke:var(--ink,#23271f);stroke-width:1.4;stroke-linecap:round;pointer-events:none}
.gk-laage-ring{fill:var(--paper,#f4f1e6);stroke:var(--ink,#23271f);stroke-width:1.2;pointer-events:none}
</style>
<g id="gk-afd">
${subPaths}
${afdPaths}
</g>
<g id="gk-mure">${murSvg || MANGLER}</g>
<g id="gk-bygninger">${bygnSvg || MANGLER}</g>
<g id="gk-laager">${laagerSvg || MANGLER}</g>
<g id="gk-lbl">
${subLbls}
${afdLbls}
</g>
</svg>
`;
const SVG_FIL = path.join(DATA_UD, 'afdelinger.svg');
fs.writeFileSync(SVG_FIL, SVG);

// ---------- paletter og skrifter (fra :root i index.html) ----------
const PAL = {
  lys: { ink: '#23271f', paper: '#f4f1e6', moss: '#5a7a4f', 'moss-d': '#3f5a37', bark: '#7a5c3e', rare: '#a04724', line: '#c8c0a8', gold: '#c8a24a', mute: '#555', faint: '#6f6a5c' },
  moerk: { ink: '#e8e4d6', paper: '#1c1f1a', moss: '#7a9b6d', 'moss-d': '#9bbb8c', bark: '#c89a6a', rare: '#e08a5c', line: '#3a3f36', gold: '#d4b25e', mute: '#a8a496', faint: '#9c9684' },
};
const VAND = '#2b6cd9'; // sidens GPS-blå, kun som svag iblanding til vand
const rootVars = m => Object.entries(PAL[m]).map(([k, v]) => `--${k}:${v}`).join(';');
const font = (fam, style, w, file) => `@font-face{font-family:'${fam}';font-style:${style};font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(P('fonts', file)).toString('base64')}) format('woff2')}`;
// skrifterne indlejres som data-URL'er (samme filer og vægte som index.html), så file://-oprindelse ikke spiller ind
const FONTS = [font('Fraunces', 'normal', 400, 'Fraunces-normal-400-latin-3.woff2'), font('Fraunces', 'normal', 600, 'Fraunces-normal-400-latin-3.woff2'),
  font('Fraunces', 'italic', 400, 'Fraunces-italic-400-latin-1.woff2'), font('Outfit', 'normal', 300, 'Outfit-normal-300-latin-5.woff2'),
  font('Outfit', 'normal', 400, 'Outfit-normal-300-latin-5.woff2')].join('\n');

// ---------- bitmap-lag ----------
const D = {
  outline: ringD(OUTLINE),
  afd: TREESECS.map(s => polysD(groups[s].polys)).join(''),
  sub: SUBL.map(sb => polysD(sb.polys)).join(''),
  cem: O.cem.length ? O.cem.map(ringD).join('') : ringD(OUTLINE),
};
const fillD = rs => rs.map(ringD).join('');
const gadenavne = (cls) => O.navne.map((n, i) => `<path id="gn${i}" d="${lineD(n.L)}" fill="none"/><text class="${cls}" dy="0.35em"><textPath href="#gn${i}" startOffset="50%">${esc(n.navn)}</textPath></text>`)
  .filter((_, i) => O.navne[i].l > O.navne[i].navn.length * 9 + 40).join('');
const vejSvg = (cls, ekstra = 0) => O.vej.map(v => `<path class="${cls}" stroke-width="${v.w + ekstra}" d="${lineD(v.L)}"/>`).join('');
const stiSvg = (cls) => O.sti.map(v => `<path class="${cls}" stroke-width="${v.w}" d="${lineD(v.L)}"/>`).join('');
const linjer = (Ls, cls) => Ls.map(L => `<path class="${cls}" d="${lineD(L)}"/>`).join('');
const traeSvg = O.traeer.map(p => `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="1.6"/>`).join('');
const labels = (cls) => TREESECS.map(s => `<text class="${cls}" x="${r1(LBL[s].p[0])}" y="${r1(LBL[s].p[1])}">${s}</text>`).join('');
const sublabels = (cls) => SUBV.map(sb => `<text class="${cls}" x="${r1(sb.l.p[0])}" y="${r1(sb.l.p[1])}">${esc(sb.txt)}</text>`).join('');

// 1. tegnet plan: streg og flade som en klassisk kirkegårdsplan på sidens papirfarve
function tegnet() {
  return `<style>
  .bg{fill:var(--paper)} .gron{fill:var(--moss);fill-opacity:.10} .vand{fill:color-mix(in srgb,${VAND} 22%,var(--paper))}
  .vandl{fill:none;stroke:color-mix(in srgb,${VAND} 40%,var(--paper));stroke-width:2}
  .vejflade{fill:var(--paper);stroke:var(--ink);stroke-width:.8}
  .cem{fill:var(--paper)}
  .afd{fill:color-mix(in srgb,var(--bark) 11%,var(--paper))} .afdk{fill:none;stroke:var(--ink);stroke-width:1.35;stroke-linejoin:round}
  .subk{fill:none;stroke:var(--ink);stroke-opacity:.55;stroke-width:.7;stroke-linejoin:round}
  .grav{fill:none;stroke:var(--ink);stroke-opacity:.16;stroke-width:1.3;stroke-linecap:round}
  .kron circle{fill:var(--moss);fill-opacity:.06}
  .vejk{fill:none;stroke:var(--ink);stroke-linecap:butt;stroke-linejoin:round} .vejf{fill:none;stroke:var(--paper);stroke-linecap:round;stroke-linejoin:round}
  .sti{fill:none;stroke:var(--paper);stroke-linecap:round;stroke-linejoin:round} .trappe{fill:none;stroke:var(--bark);stroke-width:2.6}
  .bygn{fill:url(#skr);stroke:var(--ink);stroke-width:1} .kapel{fill:var(--ink);stroke:var(--ink);stroke-width:1}
  .mur{fill:none;stroke:var(--ink);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
  .hegn{fill:none;stroke:var(--ink);stroke-width:1;stroke-opacity:.8} .haek{fill:none;stroke:var(--moss);stroke-width:2.6;stroke-linecap:round}
  .l-gab{fill:none;stroke:var(--paper);stroke-width:5.5} .l-kant{fill:none;stroke:var(--ink);stroke-width:1.5;stroke-linecap:round}
  .l-ring{fill:var(--paper);stroke:var(--ink);stroke-width:1.3}
  .trae circle{fill:var(--moss);fill-opacity:.6}
  .omrids{fill:none;stroke:var(--ink);stroke-width:3.2;stroke-linejoin:round}
  .lbl{font-family:'Fraunces',serif;font-weight:600;font-size:${LBL_FS}px;fill:var(--ink);text-anchor:middle;dominant-baseline:central;stroke:var(--paper);stroke-width:6px;stroke-linejoin:round;paint-order:stroke}
  .slbl{font-family:'Fraunces',serif;font-weight:400;font-size:${SUB_FS}px;fill:var(--faint);text-anchor:middle;dominant-baseline:central;stroke:color-mix(in srgb,var(--bark) 11%,var(--paper));stroke-width:3px;paint-order:stroke}
  .gade{font-family:'Fraunces',serif;font-style:italic;font-size:16px;fill:var(--ink);text-anchor:middle;stroke:var(--paper);stroke-width:4px;paint-order:stroke;letter-spacing:.04em}
  </style>
  <defs><pattern id="skr" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="var(--paper)"/><path d="M0 0V4" stroke="var(--ink)" stroke-width="1.3"/></pattern>
  <clipPath id="cl"><path d="${D.cem}"/></clipPath></defs>
  <rect class="bg" width="${IMGW}" height="${IMGH}"/>
  <path class="vejflade" d="${fillD(O.fill.vej || [])}"/><path class="cem" d="${D.cem}"/>
  <path class="afd" d="${D.afd}${D.sub}"/>
  <path class="gron" d="${fillD(O.fill.gron)}"/><path class="vand" d="${fillD(O.fill.vand)}"/>${linjer(O.vandlinje, 'vandl')}
  <g clip-path="url(#cl)"><path class="grav" d="${gravD}"/><g class="kron">${kronerSvg}</g></g>
  <path class="subk" d="${D.sub}"/><path class="afdk" d="${D.afd}"/>
  ${vejSvg('vejk', 2.4)}${vejSvg('vejf')}${stiSvg('sti')}${linjer(O.trappe, 'trappe')}
  ${fillD(O.bygn) ? `<path class="bygn" d="${fillD(O.bygn)}"/>` : ''}${fillD(O.kapel) ? `<path class="kapel" d="${fillD(O.kapel)}"/>` : ''}
  ${linjer(O.hegn, 'hegn')}${linjer(O.haek, 'haek')}${linjer(O.mur, 'mur')}<g class="trae">${traeSvg}</g>
  <path class="omrids" d="${ringD(OUTLINE)}"/>${LAAGER.map(l => laageSvg(l, 'l')).join('')}
  ${sublabels('slbl')}${labels('lbl')}${gadenavne('gade')}`;
}
// 2. stille kort: flade, dæmpede farver, tynde stier, Outfit
function stille() {
  return `<style>
  .bg{fill:color-mix(in srgb,var(--moss) 15%,var(--paper))} .gron{fill:var(--moss);fill-opacity:.16}
  .vand{fill:color-mix(in srgb,${VAND} 20%,var(--paper))} .vandl{fill:none;stroke:color-mix(in srgb,${VAND} 30%,var(--paper));stroke-width:2}
  .vejflade{fill:var(--sti)} .cem{fill:var(--sti)}
  .afd{fill:var(--flade)} .kron circle{fill:var(--moss);fill-opacity:.05}
  .afdk{fill:none;stroke:var(--sti);stroke-width:2.4;stroke-linejoin:round} .subk{fill:none;stroke:var(--sti);stroke-width:1.1;stroke-linejoin:round}
  .vej{fill:none;stroke:var(--vej);stroke-linecap:round;stroke-linejoin:round} .sti{fill:none;stroke:var(--sti);stroke-linecap:round;stroke-linejoin:round}
  .trappe{fill:none;stroke:var(--sti);stroke-width:2.2}
  .bygn{fill:var(--bark);fill-opacity:.32} .kapel{fill:var(--bark);fill-opacity:.62}
  .mur{fill:none;stroke:var(--faint);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round} .hegn{fill:none;stroke:var(--faint);stroke-width:.8;stroke-opacity:.7}
  .haek{fill:none;stroke:var(--moss);stroke-width:2;stroke-opacity:.6}
  .l-gab{fill:none;stroke:var(--sti);stroke-width:5} .l-kant{fill:none;stroke:var(--faint);stroke-width:1.3;stroke-linecap:round} .l-ring{fill:var(--sti);stroke:var(--faint);stroke-width:1.1}
  .trae circle{fill:var(--moss);fill-opacity:.5}
  .omrids{fill:none;stroke:var(--line);stroke-width:1.6}
  .lbl{font-family:'Outfit',sans-serif;font-weight:400;font-size:${LBL_FS}px;fill:var(--moss-d);text-anchor:middle;dominant-baseline:central;stroke:var(--flade);stroke-width:5px;stroke-linejoin:round;paint-order:stroke}
  .slbl{font-family:'Outfit',sans-serif;font-weight:400;font-size:${SUB_FS}px;fill:var(--faint);text-anchor:middle;dominant-baseline:central}
  .gade{font-family:'Outfit',sans-serif;font-weight:400;font-size:14px;fill:var(--faint);text-anchor:middle;letter-spacing:.06em}
  </style>
  <rect class="bg" width="${IMGW}" height="${IMGH}"/>
  <path class="cem" d="${D.cem}"/>
  <path class="afd" d="${D.afd}${D.sub}"/>
  <path class="gron" d="${fillD(O.fill.gron)}"/><path class="vand" d="${fillD(O.fill.vand)}"/>${linjer(O.vandlinje, 'vandl')}
  <g class="kron">${kronerSvg}</g><path class="subk" d="${D.sub}"/><path class="afdk" d="${D.afd}"/>
  <path class="vejflade" d="${fillD(O.fill.vej || [])}"/>${vejSvg('vej')}${stiSvg('sti')}${linjer(O.trappe, 'trappe')}
  ${fillD(O.bygn) ? `<path class="bygn" d="${fillD(O.bygn)}"/>` : ''}${fillD(O.kapel) ? `<path class="kapel" d="${fillD(O.kapel)}"/>` : ''}
  ${linjer(O.hegn, 'hegn')}${linjer(O.haek, 'haek')}${linjer(O.mur, 'mur')}<g class="trae">${traeSvg}</g>
  <path class="omrids" d="${ringD(OUTLINE)}"/>${LAAGER.map(l => laageSvg(l, 'l')).join('')}
  ${sublabels('slbl')}${labels('lbl')}${gadenavne('gade')}`;
}
const STILLE_VARS = { lys: '--vej:var(--line);--sti:color-mix(in srgb,var(--paper) 92%,#fff);--flade:color-mix(in srgb,var(--moss) 24%,var(--paper))',
  moerk: '--vej:color-mix(in srgb,var(--ink) 20%,var(--paper));--sti:color-mix(in srgb,var(--ink) 27%,var(--paper));--flade:color-mix(in srgb,var(--moss) 24%,var(--paper))' };
// 4. plan (skitse fra NOTAT-grundkort-design.md): KK-kortets opbygning i sidens farver. Afdelinger som flader i tre-fire
//    mos-toner, så ingen naboer deler tone; stier som brede, lyse mellemrum tegnet efter fladerne; omgivelser flade og
//    kontur-løse; ingen teksturer, ingen OSM-træer; Fraunces-bogstaver med halo; muren som den eneste skarpe linje.
const bbox = r => r.reduce((o, p) => [Math.min(o[0], p[0]), Math.min(o[1], p[1]), Math.max(o[2], p[0]), Math.max(o[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
function polysNear(a, b, tol) { // ligger to polygonsæt inden for tol px af hinanden (også tværs over en sti)?
  for (const pa of a) for (const pb of b) {
    const A = bbox(pa[0]), B = bbox(pb[0]);
    if (A[0] > B[2] + tol || B[0] > A[2] + tol || A[1] > B[3] + tol || B[1] > A[3] + tol) continue;
    const ra = pa[0], rb = pb[0];
    for (const p of ra) for (let i = 0; i < rb.length; i++) if (segDist(p, rb[i], rb[(i + 1) % rb.length]) < tol) return true;
    for (const p of rb) for (let i = 0; i < ra.length; i++) if (segDist(p, ra[i], ra[(i + 1) % ra.length]) < tol) return true;
  }
  return false;
}
const NODES = TREESECS.map(s => ({ id: s, polys: groups[s].polys })).concat(Object.values(subs).map((sb, i) => ({ id: 'sub' + i, polys: sb.polys })));
const ADJ = NODES.map(() => new Set());
for (let i = 0; i < NODES.length; i++) for (let j = i + 1; j < NODES.length; j++) if (polysNear(NODES[i].polys, NODES[j].polys, 24)) { ADJ[i].add(j); ADJ[j].add(i); }
const TONE = {}; // id -> 1..4, grådigt efter antal naboer
NODES.map((_, i) => i).sort((a, b) => ADJ[b].size - ADJ[a].size).forEach(i => {
  const used = new Set([...ADJ[i]].map(j => TONE[NODES[j].id]).filter(Boolean));
  let t = 1; while (used.has(t) && t < 4) t++;
  TONE[NODES[i].id] = t;
});
console.log('plan: toner ' + TREESECS.map(s => s + TONE[s]).join(' ') + ' · ' + Object.values(subs).length + ' underafdelinger · 4. tone brugt ' + Object.values(TONE).filter(t => t === 4).length + ' gange');
const bc = r => { const b = bbox(r); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; };
const bygnUde = O.bygn.filter(r => !inRing(bc(r), OUTLINE));
const MINB = 40 / (MPP * MPP); // 40 m² i px²: mindre "bygninger" inde på kirkegården er gravmæler
const bygnInde = O.bygn.filter(r => inRing(bc(r), OUTLINE) && Math.abs(area(r)) >= MINB);
const stiPlan = () => O.sti.map(v => `<path class="sti" stroke-width="${r1(v.w * 2.3)}" d="${lineD(v.L)}"/>`).join(''); // 2,2 → 5, 1,8 → 4
function plan() {
  return `<style>
  .bg{fill:var(--paper)}
  .karre{fill:color-mix(in srgb,var(--ink) 7%,var(--paper))}
  .park{fill:color-mix(in srgb,var(--moss) 8%,var(--paper))}
  .vand{fill:color-mix(in srgb,${VAND} 20%,var(--paper))}
  .vej{fill:none;stroke:var(--paper);stroke-linecap:round;stroke-linejoin:round}
  .cem{fill:color-mix(in srgb,var(--moss) 12%,var(--paper))}
  .afd{stroke:none} .t1{fill:var(--t1)} .t2{fill:var(--t2)} .t3{fill:var(--t3)} .t4{fill:var(--t4)}
  .afdk{fill:none;stroke:var(--ink);stroke-opacity:.3;stroke-width:.8;stroke-linejoin:round}
  .subk{fill:none;stroke:var(--paper);stroke-opacity:.6;stroke-width:.6}
  .sti{fill:none;stroke:var(--stic);stroke-linecap:round;stroke-linejoin:round}
  .trappe{fill:none;stroke:var(--stic);stroke-width:4} .trappek{fill:none;stroke:var(--ink);stroke-width:1;stroke-dasharray:1 2.5}
  .haek{fill:none;stroke:var(--moss-d);stroke-opacity:.5;stroke-width:1.2;stroke-linecap:round}
  .bygn{fill:var(--bark);fill-opacity:.35;stroke:var(--bark);stroke-width:.8} .kapel{fill:var(--ink);fill-opacity:.85;stroke:var(--ink);stroke-width:1}
  .mur{fill:none;stroke:var(--ink);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
  .hegn{fill:none;stroke:var(--ink);stroke-width:1;stroke-opacity:.7}
  .omrids{fill:none;stroke:var(--ink);stroke-width:1;stroke-opacity:.6}
  .l-gab{fill:none;stroke:var(--stic);stroke-width:6} .l-kant{fill:none;stroke:var(--ink);stroke-width:1.4;stroke-linecap:round} .l-ring{fill:var(--stic);stroke:var(--ink);stroke-width:1.3}
  .lbl{font-family:'Fraunces',serif;font-weight:600;font-size:46px;fill:var(--ink);text-anchor:middle;dominant-baseline:central;stroke:var(--paper);stroke-width:6px;stroke-linejoin:round;paint-order:stroke}
  .gade{font-family:'Fraunces',serif;font-style:italic;font-size:15px;fill:var(--faint);text-anchor:middle;stroke:var(--paper);stroke-width:3.5px;paint-order:stroke;letter-spacing:.04em}
  </style>
  <rect class="bg" width="${IMGW}" height="${IMGH}"/>
  <path class="park" d="${fillD(O.fill.gron)}"/><path class="karre" d="${fillD(bygnUde)}"/>
  <path class="vand" d="${fillD(O.fill.vand)}"/>${vejSvg('vej')}
  <path class="cem" d="${D.cem}"/>
  ${TREESECS.map(s => `<path class="afd t${TONE[s]}" d="${polysD(groups[s].polys)}"/>`).join('')}
  ${Object.values(subs).map((sb, i) => `<path class="afd t${TONE['sub' + i]}" d="${polysD(sb.polys)}"/>`).join('')}
  <path class="afdk" d="${D.afd}"/><path class="subk" d="${D.sub}"/>
  ${stiPlan()}${linjer(O.trappe, 'trappe')}${linjer(O.trappe, 'trappek')}
  ${linjer(O.haek, 'haek')}
  ${bygnInde.length ? `<path class="bygn" d="${fillD(bygnInde)}"/>` : ''}${fillD(O.kapel) ? `<path class="kapel" d="${fillD(O.kapel)}"/>` : ''}
  <path class="omrids" d="${ringD(OUTLINE)}"/>${linjer(O.hegn, 'hegn')}${linjer(O.mur, 'mur')}
  ${LAAGER.map(l => laageSvg(l, 'l')).join('')}
  ${labels('lbl')}${gadenavne('gade')}`;
}
const PLAN_VARS = {
  lys: '--t1:color-mix(in srgb,var(--moss) 16%,var(--paper));--t2:color-mix(in srgb,var(--moss) 24%,var(--paper));--t3:color-mix(in srgb,var(--moss) 32%,var(--paper));--t4:color-mix(in srgb,var(--moss) 40%,var(--paper));--stic:var(--paper)',
  moerk: '--t1:color-mix(in srgb,var(--moss) 18%,var(--paper));--t2:color-mix(in srgb,var(--moss) 26%,var(--paper));--t3:color-mix(in srgb,var(--moss) 34%,var(--paper));--t4:color-mix(in srgb,var(--moss) 42%,var(--paper));--stic:color-mix(in srgb,var(--ink) 30%,var(--paper))',
};
// 3. ortofoto med lag: kun fotoet dæmpet (og gadenavne, hvis OSM); afdelinger tegnes af vektorlaget
const ORTO_CSS = { lys: 'filter:saturate(.7)', moerk: 'filter:brightness(.5) saturate(.6)' };
const ORTO_SLOER = { lys: 'opacity:.45', moerk: 'opacity:.25' };
function orto(m) {
  return { under: `<img src="file://${P('data', 'orto_kort_2025.jpg')}" style="position:absolute;left:0;top:0;width:${IMGW}px;height:${IMGH}px;${ORTO_CSS[m]}">` +
    `<div style="position:absolute;inset:0;background:var(--paper);${ORTO_SLOER[m]}"></div>`,
  svg: `<style>.gade{font-family:'Outfit',sans-serif;font-weight:400;font-size:15px;fill:var(--ink);text-anchor:middle;stroke:var(--paper);stroke-width:4px;paint-order:stroke;letter-spacing:.06em}</style>${gadenavne('gade')}` };
}

function page(m, under, svgInner, ekstraVars = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
  :root{${rootVars(m)};${ekstraVars}} html,body{margin:0;background:var(--paper)}
  #k{position:relative;width:${IMGW}px;height:${IMGH}px;overflow:hidden}
  #k>svg{position:absolute;left:0;top:0;width:${IMGW}px;height:${IMGH}px}</style></head>
  <body><div id="k">${under}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${IMGW} ${IMGH}">${svgInner}</svg></div></body></html>`;
}

// ---------- rendering ----------
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
async function shot(html, scale, navn) {
  const ctx = await browser.newContext({ viewport: { width: IMGW, height: IMGH }, deviceScaleFactor: scale });
  const pg = await ctx.newPage();
  const tmp = path.join(UD, '_' + navn + '.html'); fs.writeFileSync(tmp, html);
  await pg.goto('file://' + tmp);
  await pg.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
  const ok = await pg.evaluate(async () => { const F = ['600 40px Fraunces', 'italic 400 16px Fraunces', '400 40px Outfit'];
    await Promise.all(F.map(f => document.fonts.load(f))); return F.map(f => document.fonts.check(f)); });
  if (ok.includes(false)) { console.error('skrifterne blev ikke indlæst', ok); process.exit(1); }
  const buf = await pg.screenshot({ clip: { x: 0, y: 0, width: IMGW, height: IMGH }, type: 'png' });
  await ctx.close(); fs.unlinkSync(tmp);
  return buf;
}
// versalhøjden af etiketterne, målt i Chromium med de indlæste skrifter
{
  const ctx = await browser.newContext(); const pg = await ctx.newPage();
  await pg.setContent(`<style>${FONTS}</style><span style="font-family:Fraunces;font-weight:600">A</span><span style="font-family:Outfit">A</span>`);
  const h = await pg.evaluate(async (fs_) => { await document.fonts.load(`600 ${fs_}px Fraunces`); await document.fonts.load(`400 ${fs_}px Outfit`);
    const c = document.createElement('canvas').getContext('2d'); const m = f => { c.font = f; const t = c.measureText('E'); return t.actualBoundingBoxAscent + t.actualBoundingBoxDescent; };
    return { fraunces: m(`600 ${fs_}px Fraunces`), outfit: m(`400 ${fs_}px Outfit`) }; }, LBL_FS);
  console.log(`etiketter: ${LBL_FS}px skrift, versalhøjde (E) ved 1×: Fraunces 600 ${h.fraunces.toFixed(1)} px, Outfit 400 ${h.outfit.toFixed(1)} px`);
  await ctx.close();
}

const PY = `
import sys
from PIL import Image
png, webp, avif = sys.argv[1:4]
im = Image.open(png).convert('RGB')
im.save(webp, 'WEBP', quality=85, method=6)
im.save(avif, 'AVIF', quality=62, speed=4)
`;
function konverter(png, webp, avif) {
  const r = spawnSync('python3', ['-c', PY, png, webp, avif], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
}
const navnFor = (v, m, s) => `kort_${v}${m === 'moerk' ? '_moerk' : ''}${s === 2 ? '@2x' : ''}`;
const svgInline = SVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
for (const v of KUN) for (const m of ['lys', 'moerk']) {
  let under = '', inner, vars = '';
  if (v === 'tegnet') inner = tegnet();
  if (v === 'stille') { inner = stille(); vars = STILLE_VARS[m]; }
  if (v === 'plan') { inner = plan(); vars = PLAN_VARS[m]; }
  if (v === 'orto') { const o = orto(m); under = o.under; inner = o.svg; }
  const html = page(m, under, inner, vars);
  for (const s of [1, 2]) {
    const n = navnFor(v, m, s), png = path.join(UD, n + '.png');
    fs.writeFileSync(png, await shot(html, s, n));
    konverter(png, path.join(DATA_UD, n + '.webp'), path.join(UD, n + '.avif'));
    console.log('skrev ' + rel(path.join(DATA_UD, n + '.webp')) + ` (${s === 1 ? '1400×1216' : '2800×2432'})`);
  }
  // komposit: 1×-bitmap med data/afdelinger.svg ovenpå, som siden vil vise det. I tegnet og stille bærer
  // bitmap'en selv bogstaverne på de samme pladser, så SVG'ens etiketter skjules dér (--gk-lbl-op:0).
  const png1 = path.join(UD, navnFor(v, m, 1) + '.png');
  const komp = page(m, `<img src="file://${png1}" style="position:absolute;left:0;top:0;width:${IMGW}px;height:${IMGH}px">`, svgInline,
    v === 'orto' ? '' : '--gk-lbl-op:0');
  fs.writeFileSync(path.join(UD, `komposit_${v}${m === 'moerk' ? '_moerk' : ''}.png`), await shot(komp, 1, 'komp'));
}
await browser.close();

// ---------- størrelsestabel og README ----------
const kb = f => (fs.existsSync(f) ? Math.round(fs.statSync(f).size / 1024) + '' : '–');
const tabel = ['| Fil | Pixel | PNG (KB) | WebP (KB) | AVIF (KB) |', '|---|---|--:|--:|--:|'];
for (const v of ALLE) for (const m of ['lys', 'moerk']) for (const s of [1, 2]) {
  const n = navnFor(v, m, s);
  tabel.push(`| \`${n}.webp\` | ${s === 1 ? '1400 × 1216' : '2800 × 2432'} | ${kb(path.join(UD, n + '.png'))} | ${kb(path.join(DATA_UD, n + '.webp'))} | ${kb(path.join(UD, n + '.avif'))} |`);
}
tabel.push(`| \`afdelinger.svg\` | viewBox 1400 × 1216 | | ${kb(SVG_FIL)} (svg) | |`);
console.log('\n' + tabel.join('\n'));
const dato = new Date().toISOString().slice(0, 10);
const afdStatus = `${TREESECS.length - 2} af ${TREESECS.length} afdelinger er kommunens polygoner (D, K og L samlet af flere); ` +
  `**Q** er det konvekse hylster af ${groups.Q.n} gravstedsmidtpunkter med afd="Q", bufret 3 m (\`data-kilde="gravsteder"\`); ` +
  `**U** er et skøn: en cirkel med radius 14 px (ca. ${(14 * MPP).toFixed(1).replace('.', ',')} m) om skoens markør (\`data-kilde="skoen"\`). ` +
  `*Mangel:* U skal tegnes af efter ortofotoet.`;
const afsnit = `<!-- kort_render:start -->
## Eget grundkort (\`scripts/kort_render.mjs\`)

Renderet ${dato} med \`node scripts/kort_render.mjs\` (Playwright/Chromium; webp og avif med Pillow, da
cwebp/avifenc ikke fandtes). Fire retninger, hver i lys og mørk udgave, i 1× (1400 × 1216) og 2× (2800 × 2432):
\`kort_tegnet*\` (tegnet plan), \`kort_stille*\` (stille kort), \`kort_orto*\` (dæmpet ortofoto; afdelinger
tegnes kun af vektorlaget) og \`kort_plan*\` (plan: skitse af syntesen i \`NOTAT-grundkort-design.md\`, uden teksturer,
med stier som lyse mellemrum og afdelinger i tre-fire toner). \`afdelinger.svg\` er vektorlaget med de 19 trykflader (\`#afd-A\` …) og følger
sidens CSS-variabler. Kun webp ligger i repoet; PNG og AVIF er målt lokalt.

- **OSM:** ${OSM ? `hentet ${OSM.hentet || '?'} (${OSM.rows.length} elementer, © OpenStreetMap-bidragydere, ODbL); omrids fra ${OUTLINE_KILDE}.` : `**OSM-lag mangler** – renderingen er uden OSM-lag (ingen stier, mure, bygninger, låger eller gadenavne); omridset er ${OUTLINE_KILDE}, fordi firkanten mellem ankrene alene skærer G, N og O over. Kør \`scripts/osm_slank.mjs\` og derefter dette script igen.`}
- **Afdelinger:** ${afdStatus}
- **Vegetation:** svag kronetekstur fra \`kk_detekterede.json\` (radius = √(kroneareal/π)) i tegnet plan og stille kort; gravstedernes midtpunkter som fin tekstur i tegnet plan.

KB = 1024 byte. 1×-målet fra issuet: \`kort.png\` 215 KB, \`kort.webp\` 102 KB, \`kort.avif\` 76 KB.

${tabel.join('\n')}
<!-- kort_render:end -->
`;
if (!TEST) {
  const RM = P('data', 'README.md');
  let rd = fs.readFileSync(RM, 'utf8');
  if (rd.includes('<!-- kort_render:start -->')) rd = rd.replace(/<!-- kort_render:start -->[\s\S]*?<!-- kort_render:end -->\n?/, afsnit);
  else if (rd.includes('\n## Format')) rd = rd.replace('\n## Format', '\n' + afsnit + '\n## Format');
  else { console.error('fandt hverken markører eller "## Format" i data/README.md'); process.exit(1); }
  fs.writeFileSync(RM, rd);
} else console.log(`\nTESTKØRSEL med OSM=${OSM_FIL}: alt skrevet til ${UD}; data/ og data/README.md er ikke rørt.`);
console.log(`\n${osmStatus} · meter pr. pixel ${MPP.toFixed(3)} · afdelinger.svg ${(fs.statSync(SVG_FIL).size / 1024).toFixed(1)} KB · kørselstid ${((Date.now() - T0) / 1000).toFixed(1)} s`);
