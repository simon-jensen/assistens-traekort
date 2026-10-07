// Skærmbilleder af det egne grundkort til docs/grundkort/ (PR'ens sammenligningstavle og NOTAT-grundkort.md).
// Kør fra repo-roden, mens siden serveres (service workeren blokeres):
//   python3 -m http.server 8000 &
//   node scripts/grundkort_skaermbilleder.mjs
// Kræver Playwright (npm i playwright) og python3 med Pillow. Sæt CHROME=/sti/til/chrome, hvis Playwright
// ikke selv finder en browser, og URL=http://…/ hvis siden ikke kører på http://localhost:8000/.
//
// Telefon 390 × 844 CSS-px, DPR 3, kalibrering tændt (#kal=1). For hvert grundlag (kk, tegnet, stille, orto)
// i lys og mørk tilstand, med og uden 🔲 Afdelinger, tages et skærmbillede af #mapwrap, halveres (1,5×) og
// gemmes som <grundlag>_<lys|moerk>_<lag|uden>.webp. sol_<grundlag>.webp er lys+lag med kontrast 0,45 og
// lysstyrke 1,25 (sol-simuleringen i notatet). lup_<grundlag>.webp er luppen (4×) om et punkt i afdeling F.
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = createRequire('/opt/node-tools/node_modules/')('playwright'); }
const { chromium } = pw;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const UD = path.join(ROOT, 'docs', 'grundkort');
const BASE = process.env.URL || 'http://localhost:8000/';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'grundkort_sb_'));
const GK_KEY = 'assistens_grundkort_v1', AFD_KEY = 'assistens_afdlag_v1';
const RET = ['kk', 'tegnet', 'stille', 'orto'];
fs.mkdirSync(UD, { recursive: true });

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
async function open({ ret, dark, lag }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.route('**/sw.js', r => r.abort());
  await page.addInitScript(([k, v, ak, lag]) => { localStorage.setItem(k, v); if (lag) localStorage.setItem(ak, '1'); else localStorage.removeItem(ak); }, [GK_KEY, ret, AFD_KEY, lag]);
  await page.goto(BASE + '#kal=1');
  await page.waitForFunction(() => typeof grundkortImg === 'function');
  await page.evaluate(() => document.fonts.ready);
  if (ret !== 'kk') await page.waitForFunction(() => { const g = document.getElementById('grundkort'); return g.complete && g.naturalWidth > 0; }, null, { timeout: 20000 });
  if (lag) await page.waitForSelector('#afdlag', { timeout: 10000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}

const jobs = []; // [png, webp, behandling]
for (const ret of RET) for (const dark of [false, true]) for (const lag of [false, true]) {
  const { ctx, page } = await open({ ret, dark, lag });
  const navn = `${ret}_${dark ? 'moerk' : 'lys'}_${lag ? 'lag' : 'uden'}`;
  const png = path.join(TMP, navn + '.png');
  await page.locator('#mapwrap').screenshot({ path: png });
  jobs.push([png, path.join(UD, navn + '.webp'), 'halv']);
  if (!dark && lag) jobs.push([png, path.join(UD, `sol_${ret}.webp`), 'sol']);
  await ctx.close();
  console.log('skærmbillede', navn);
}
for (const ret of ['tegnet', 'stille', 'orto']) { // luppen: som tests/grundkort.test.mjs (e)
  const { ctx, page } = await open({ ret, dark: false, lag: false });
  await page.evaluate(() => armTree(TREES.findIndex(x => x.sec === 'F')));
  const r = await page.evaluate(() => document.getElementById('mapimg').getBoundingClientRect().toJSON());
  await page.mouse.click(r.x + r.width * 0.74, r.y + r.height * 0.25);
  await page.waitForTimeout(300);
  const png = path.join(TMP, `lup_${ret}.png`);
  await page.locator('#loupe').screenshot({ path: png });
  jobs.push([png, path.join(UD, `lup_${ret}.webp`), 'lup']);
  await ctx.close();
  console.log('lup', ret);
}
await browser.close();

const py = `
import sys, json
from PIL import Image, ImageEnhance
for png, webp, mode in json.load(open(sys.argv[1])):
    im = Image.open(png).convert('RGB')
    if mode in ('halv', 'sol'):
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    if mode == 'sol':
        im = ImageEnhance.Contrast(im).enhance(0.45)
        im = ImageEnhance.Brightness(im).enhance(1.25)
    im.save(webp, 'WEBP', quality=80, method=6)
    print(webp.split('/')[-1], im.size, 'KB', (len(open(webp, 'rb').read()) + 512) // 1024)
`;
const liste = path.join(TMP, 'jobs.json');
fs.writeFileSync(liste, JSON.stringify(jobs));
const r = spawnSync(process.env.PYTHON || 'python3', ['-I', '-c', py, liste], { encoding: 'utf8' });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
if (r.status !== 0) { console.error('Pillow-konverteringen fejlede'); process.exit(1); }
console.log(`${jobs.length} filer skrevet til docs/grundkort/`);
