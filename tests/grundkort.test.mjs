// Headless-tjek af det egne grundkort i kalibreringstilstand (issue #12, NOTAT-grundkort.md). Kør fra repo-roden:
//   python3 -m http.server 8000 &   # siden skal serveres (service workeren blokeres af testen)
//   npm i playwright && node tests/grundkort.test.mjs
// Sæt CHROME=/sti/til/chrome, hvis Playwright ikke selv finder en browser.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch(e){pw=createRequire('/opt/node-tools/node_modules/')('playwright');}
const { chromium } = pw;
const fs=require('fs');
const BASE=process.env.URL||'http://localhost:8000/';
let fails=0,n=0;const errors=[];
function ok(c,msg,extra){n++;if(!c){fails++;console.log('✗',msg,extra!==undefined?JSON.stringify(extra):'');}else console.log('✓',msg);}
const browser=await chromium.launch(process.env.CHROME?{executablePath:process.env.CHROME}:{});
const FILE=JSON.parse(fs.readFileSync(new URL('../positions.json',import.meta.url),'utf8'));
const TREES=JSON.parse(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/const TREES=(\[.*?\]);\n/s)[1]);
async function open({hash='#kal=1',positions=FILE,colorScheme='light',local={},ctx=null}={}){
  ctx=ctx||await browser.newContext({viewport:{width:1200,height:900},colorScheme});
  const page=await ctx.newPage();const reqs=[];page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>reqs.push(r.url()));
  await page.route('**/sw.js',r=>r.abort());
  await page.route('**/positions.json*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(positions)}));
  await page.addInitScript(l=>{for(const k in l)localStorage.setItem(k,l[k]);},local);
  await page.goto(BASE+hash);await page.waitForFunction(()=>typeof grundkortImg==='function');await page.waitForTimeout(300);
  return {ctx,page,reqs,gk:()=>page.evaluate(()=>{const g=document.getElementById('grundkort');
    return {src:g.getAttribute('src')||'',srcset:g.getAttribute('srcset')||'',disp:getComputedStyle(g).display,btn:document.getElementById('calBaseBtn').textContent};})};
}
// (a) 🗺 skifter grundlag og husker valget
{
  const t=await open();
  await t.page.click('#calBaseBtn');let g=await t.gk();
  ok(g.disp==='block'&&g.src.includes('kort_tegnet')&&g.srcset.includes('kort_tegnet@2x.webp 2x')&&g.btn.includes('tegnet'),'🗺 ét tryk → tegnet plan vises',g);
  await t.page.click('#calBaseBtn');g=await t.gk();ok(g.src.includes('kort_stille')&&g.btn.includes('stille'),'🗺 to tryk → stille kort',g);
  const t2=await open({ctx:t.ctx});g=await t2.gk();ok(g.disp==='block'&&g.src.includes('kort_stille'),'🗺 valget huskes efter genindlæsning',g);
  await t.ctx.close();
}
// (b) mørk tilstand vælger _moerk-varianten
{
  const t=await open({colorScheme:'dark',local:{assistens_grundkort_v1:'orto'}});const g=await t.gk();
  ok(g.src.includes('kort_orto_moerk.webp'),'mørk tilstand → _moerk-grundlag',g);await t.ctx.close();
}
// (c) 🔲 Afdelinger: polygonerne er trykflader og vælger afdelingen
{
  const t=await open();
  await t.page.click('#calAfdBtn');await t.page.waitForSelector('#afdlag',{timeout:10000});
  const s=await t.page.evaluate(()=>({n:document.querySelectorAll('#afdlag [id^=afd-]').length,hot:getComputedStyle(document.querySelector('.hot')).display}));
  ok(s.n===19&&s.hot==='none','🔲 19 trykflader, .hot skjult',s);
  const pt=await t.page.evaluate(()=>{const b=document.getElementById('afd-F').getBoundingClientRect(); // et punkt, hvor fladen selv tager imod trykket (prikkerne ligger ovenpå)
    for(let y=b.top+4;y<b.bottom;y+=6)for(let x=b.left+4;x<b.right;x+=6)if(document.elementFromPoint(x,y)?.id==='afd-F')return {x,y};return null;});
  await t.page.mouse.click(pt.x,pt.y);
  const c=await t.page.evaluate(()=>({cur:curSec,p:document.getElementById('afd-F').classList.contains('active'),l:document.querySelector('#afdlag .gk-lbl[data-afd=F]').classList.contains('active')}));
  ok(c.cur==='F'&&c.p&&c.l,'🔲 tryk på #afd-F vælger afdeling F (active på flade og bogstav)',c);await t.ctx.close();
}
// (d) ✓ på polygonlaget, når alle træer i en afdeling er placeret
{
  const trees={};TREES.filter(x=>x.sec==='G').forEach(x=>{trees[x.sec+'|'+x.plot+'|'+x.sp]={fx:0.75,fy:0.1,src:'kort',ts:'2026-10-01T00:00:00.000Z'};});
  const t=await open({positions:{version:1,anchors:[],trees},local:{assistens_afdlag_v1:'1'}});await t.page.waitForSelector('#afdlag',{timeout:10000});
  const d=await t.page.evaluate(()=>{const v=s=>getComputedStyle(document.querySelector('#afdlag .gk-done[data-afd='+s+']')).display;
    return {G:v('G'),A:v('A'),path:document.getElementById('afd-G').classList.contains('done'),hot:document.querySelector('.hot[data-s=G]').classList.contains('done')};});
  ok(d.G!=='none'&&d.A==='none'&&d.path&&d.hot,'✓ vises for fuldført afd. G og ikke for A',d);await t.ctx.close();
}
// (e) luppen tegner det valgte grundlag
{
  const t=await open({local:{assistens_grundkort_v1:'tegnet'}});
  await t.page.waitForFunction(()=>{const g=document.getElementById('grundkort');return g.complete&&g.naturalWidth>0;});
  await t.page.evaluate(()=>armTree(TREES.findIndex(x=>x.sec==='F')));
  const r=await t.page.evaluate(()=>document.getElementById('mapimg').getBoundingClientRect().toJSON());
  await t.page.mouse.click(r.x+r.width*0.74,r.y+r.height*0.25);
  const l=await t.page.evaluate(()=>{const d=loupe.getContext('2d').getImageData(0,0,120,120).data;let a=0;for(let i=3;i<d.length;i+=4)a+=d[i];
    return {alpha:a,img:grundkortImg().id,cand:!!cand};});
  ok(l.cand&&l.alpha>0&&l.img==='grundkort','luppen tegner fra #grundkort, og lærredet er ikke tomt',l);await t.ctx.close();
}
// (f) FRACS og ankrene er uændrede
{
  const t=await open();
  const f=await t.page.evaluate(()=>({n:Object.keys(FRACS).length,A:FRACS.A,U:FRACS.U,a:SEED_ANCHORS[0],na:SEED_ANCHORS.length}));
  ok(f.n===38&&JSON.stringify(f.A)==='[0.5821,0.8793]'&&JSON.stringify(f.U)==='[0.2583,0.3517]'&&f.na===4&&
     f.a.lat===55.690688&&f.a.lon===12.544873&&f.a.fx===336/1400&&f.a.fy===48/1216,'FRACS og SEED_ANCHORS uændrede',f);await t.ctx.close();
}
// (g) besøgende (uden #kal=1) ser og henter intet nyt — heller ikke med valg gemt fra en tidligere kalibrering
{
  const t=await open({hash:'',local:{assistens_grundkort_v1:'tegnet',assistens_afdlag_v1:'1'}});await t.page.waitForTimeout(500);
  const v=await t.page.evaluate(()=>{const g=document.getElementById('grundkort');
    return {src:g.hasAttribute('src')||g.hasAttribute('srcset'),afd:!!document.getElementById('afdlag'),btn:document.getElementById('calBaseBtn').offsetParent!==null||document.getElementById('calAfdBtn').offsetParent!==null,hot:document.querySelectorAll('.hot').length};});
  const net=t.reqs.filter(u=>u.includes('data/')||u.includes('afdelinger.svg'));
  ok(!v.src&&!v.afd&&!v.btn&&v.hot===19&&net.length===0,'besøgende: intet grundlag, intet polygonlag, ingen knapper, ingen data/-kald',{v,net});await t.ctx.close();
}
ok(errors.length===0,'ingen JS-fejl i nogen kørsel',errors);
await browser.close();console.log(`\n${n-fails}/${n} grønne`);process.exit(fails?1:0);
