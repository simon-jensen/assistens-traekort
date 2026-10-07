// Slanker et rå OSM-udtræk af Assistens Kirkegård og omegn til data/osm_assistens.json,
// i samme rækkeformat som data/kk_traeer.json (kilde, lag, hentet, licens, felter, rows).
//
// Kør:  node scripts/osm_slank.mjs data/raw/osm_assistens.json data/osm_assistens.json
// Kræver kun Node (22+), ingen npm-pakker.
//
// Den rå fil hentes fra en maskine med netadgang til OSM og lægges i data/raw/ (gitignored).
// Først Overpass (overpass-api.de; svarer den ikke, så overpass.kumi.systems). overpass-api.de
// svarer "406 Not Acceptable" på curls standard-User-Agent, derfor -A:
//
//   curl -sS -m 120 -A 'assistens-traekort (github.com/simon-jensen/assistens-traekort)' \
//     -o data/raw/osm_assistens.json https://overpass-api.de/api/interpreter \
//     --data-urlencode 'data=[out:json][timeout:90];
//   ( way(3099111);
//     nwr["highway"](55.687,12.543,55.695,12.556);
//     nwr["building"](55.687,12.543,55.695,12.556);
//     nwr["barrier"](55.687,12.543,55.695,12.556);
//     nwr["entrance"](55.687,12.543,55.695,12.556);
//     nwr["natural"](55.687,12.543,55.695,12.556);
//     nwr["landuse"](55.687,12.543,55.695,12.556);
//     nwr["leisure"](55.687,12.543,55.695,12.556);
//     nwr["amenity"](55.687,12.543,55.695,12.556);
//     nwr["waterway"](55.687,12.543,55.695,12.556);
//     nwr["historic"](55.687,12.543,55.695,12.556);
//     nwr["man_made"](55.687,12.543,55.695,12.556); );
//   out geom;'
//
// (samme kommando med https://overpass.kumi.systems/api/interpreter som anden reserve)
//
// Falder begge Overpass-servere, så OSM's eget API (kun bbox; way 3099111 kommer med, fordi
// den skærer bbox'en, men relationer kan mangle medlemmer uden for bbox'en):
//
//   curl -sS -m 120 -o data/raw/osm_assistens.json \
//     'https://api.openstreetmap.org/api/0.6/map.json?bbox=12.543,55.687,12.556,55.695'
//
// Begge formater læses: Overpass "out geom" (geometry inline på ways og relationsmedlemmer)
// og almindelig OSM-JSON (ways med node-id'er, som opløses her).
//
// Udgang: én række pr. element, [type, id, tags, geom], med koordinater som [lon, lat] med
// 6 decimaler. node = [[lon,lat]]; way = [[lon,lat], …]; relation = liste af ydre ringe
// (role "outer" eller tom rolle), hvor way-stykker sammenføjes til ringe ved fælles endepunkter.
// Indre ringe (role "inner", huller) droppes bevidst: de tegnes ikke. Kun tag-nøglerne i KEEP
// beholdes, og elementer uden tags efter filtreringen (fx rene vertex-noder) kommer ikke med.
// `hentet` er dato-delen af osm3s.timestamp_osm_base, ellers den rå fils mtime, ellers i dag.
import fs from 'fs';

const BBOX = { s: 55.687, w: 12.543, n: 55.695, e: 12.556 };
const KEEP = new Set(['highway', 'footway', 'building', 'barrier', 'entrance', 'natural', 'landuse',
  'leisure', 'amenity', 'waterway', 'water', 'historic', 'man_made', 'name', 'surface', 'area',
  'access', 'service', 'wall', 'height', 'levels']);
const COUNT = ['highway', 'building', 'barrier', 'entrance', 'natural', 'landuse', 'leisure',
  'amenity', 'waterway', 'historic', 'man_made'];
const CURL = "curl -sS -m 120 -A 'assistens-traekort (github.com/simon-jensen/assistens-traekort)' -o data/raw/osm_assistens.json https://overpass-api.de/api/interpreter --data-urlencode 'data=…'  (hele forespørgslen står øverst i scripts/osm_slank.mjs)";

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) { console.error('brug: node scripts/osm_slank.mjs <rå.json> <ud.json>'); process.exit(2); }
if (!fs.existsSync(inFile)) {
  console.error(`Fandt ikke den rå fil ${inFile}.\nHent den først fra en maskine med adgang til OSM, fx:\n  ${CURL}\n` +
    'eller som reserve:\n  curl -sS -m 120 -o data/raw/osm_assistens.json ' +
    "'https://api.openstreetmap.org/api/0.6/map.json?bbox=12.543,55.687,12.556,55.695'");
  process.exit(1);
}
const rawSize = fs.statSync(inFile).size;
let raw;
try { raw = JSON.parse(fs.readFileSync(inFile, 'utf8')); }
catch (e) { console.error(`${inFile} er ikke gyldig JSON (${e.message}). Er det en fejlside fra serveren?`); process.exit(1); }
if (!Array.isArray(raw.elements)) { console.error(`${inFile} har ingen "elements"-liste; det ligner ikke et OSM-JSON-svar.`); process.exit(1); }
if (raw.remark) console.warn(`advarsel: serveren skrev remark: ${raw.remark}`);

const overpass = !!raw.osm3s;
let hentet = raw.osm3s?.timestamp_osm_base?.slice(0, 10);
if (!hentet) { try { hentet = fs.statSync(inFile).mtime.toISOString().slice(0, 10); } catch { hentet = new Date().toISOString().slice(0, 10); } }

const r6 = x => Math.round(x * 1e6) / 1e6;
const pt = o => [r6(o.lon), r6(o.lat)];

// node-opslag til almindelig OSM-JSON (og til Overpass-noder, hvis de findes)
const nodes = new Map(), ways = new Map();
for (const el of raw.elements) {
  if (el.type === 'node' && el.lat != null) nodes.set(el.id, el);
  if (el.type === 'way') ways.set(el.id, el);
}
let missing = 0;
function wayCoords(w) {
  if (Array.isArray(w.geometry)) return w.geometry.filter(g => g && g.lat != null).map(pt);
  const out = [];
  for (const id of w.nodes || []) { const n = nodes.get(id); if (n) out.push(pt(n)); else missing++; }
  return out;
}
function memberCoords(m) {
  if (Array.isArray(m.geometry)) return m.geometry.filter(g => g && g.lat != null).map(pt);
  const w = ways.get(m.ref);
  if (!w) { missing++; return []; }
  return wayCoords(w);
}
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
function joinRings(parts) { // sammenføj way-stykker til ringe ved fælles endepunkter
  parts = parts.filter(p => p.length >= 2).map(p => p.slice());
  const rings = [];
  while (parts.length) {
    let ring = parts.shift(), grown = true;
    while (!same(ring[0], ring[ring.length - 1]) && grown) {
      grown = false;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i], end = ring[ring.length - 1];
        if (same(end, p[0])) ring = ring.concat(p.slice(1));
        else if (same(end, p[p.length - 1])) ring = ring.concat(p.slice(0, -1).reverse());
        else continue;
        parts.splice(i, 1); grown = true; break;
      }
    }
    rings.push(ring);
  }
  return rings;
}

const rows = [], seen = new Set();
let dropTags = 0, dropGeom = 0;
for (const el of raw.elements) {
  const key = el.type + '/' + el.id;
  if (seen.has(key)) continue;
  seen.add(key);
  const tags = {};
  for (const [k, v] of Object.entries(el.tags || {})) if (KEEP.has(k)) tags[k] = v;
  if (!Object.keys(tags).length) { dropTags++; continue; }
  let geom;
  if (el.type === 'node') geom = el.lat != null ? [pt(el)] : [];
  else if (el.type === 'way') geom = wayCoords(el);
  else if (el.type === 'relation') geom = joinRings((el.members || [])
    .filter(m => m.type === 'way' && (m.role === 'outer' || m.role === '')).map(memberCoords));
  else continue;
  if (!geom.length) { dropGeom++; continue; }
  rows.push([el.type, el.id, tags, geom]);
}

const daekning = {};
for (const [, , tags] of rows) for (const k of COUNT) if (k in tags) { const kv = `${k}=${tags[k]}`; daekning[kv] = (daekning[kv] || 0) + 1; }
const daekSorted = Object.fromEntries(Object.keys(daekning).sort().map(k => [k, daekning[k]]));

const head = {
  kilde: overpass ? 'OpenStreetMap-bidragydere via Overpass API' : 'OpenStreetMap-bidragydere via OSM API 0.6',
  lag: overpass ? 'overpass: bbox 55.687,12.543,55.695,12.556 + way 3099111' : 'api 0.6 map: bbox 12.543,55.687,12.556,55.695',
  hentet,
  licens: 'ODbL 1.0 · © OpenStreetMap-bidragydere · https://www.openstreetmap.org/copyright',
  daekning: daekSorted,
  felter: ['type', 'id', 'tags', 'geom'],
};
const txt = JSON.stringify(head).slice(0, -1) + ',"rows":[\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n]}\n';
fs.writeFileSync(outFile, txt);

// rapport: dækning, bbox for udgangens koordinater og filstørrelser
let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity, inside = 0;
const flat = g => typeof g[0] === 'number' ? [g] : g.flatMap(flat);
for (const r of rows) {
  const cs = flat(r[3]);
  let any = false;
  for (const [lon, lat] of cs) {
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon); minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    if (lat >= BBOX.s && lat <= BBOX.n && lon >= BBOX.w && lon <= BBOX.e) any = true;
  }
  if (any) inside++;
}
const byType = rows.reduce((a, r) => (a[r[0]] = (a[r[0]] || 0) + 1, a), {});
console.log(`format: ${overpass ? 'Overpass' : 'OSM API 0.6'} · hentet ${hentet}`);
console.log(`elementer i rå fil: ${raw.elements.length} · rows: ${rows.length} (${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(', ')})`);
console.log(`droppet: ${dropTags} uden relevante tags, ${dropGeom} uden geometri · manglende node-/way-referencer: ${missing}`);
console.log('dækning:');
for (const [k, v] of Object.entries(daekSorted)) console.log(`  ${k}: ${v}`);
if (rows.length) console.log(`koordinat-bbox: lat ${minLat}–${maxLat}, lon ${minLon}–${maxLon} · rows med punkt i forespurgt bbox: ${inside}/${rows.length}`);
console.log(`rå fil: ${rawSize} B · slanket: ${Buffer.byteLength(txt)} B → ${outFile}`);
