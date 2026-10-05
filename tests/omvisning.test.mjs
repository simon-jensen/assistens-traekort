// Headless-tjek af omvisningstilstanden (PR #9 og reviewets B1/R1–R7). Kør fra repo-roden:
//   python3 -m http.server 8000 &   # siden skal serveres (service workeren blokeres af testen)
//   npm i playwright && node tests/omvisning.test.mjs
// Sæt CHROME=/sti/til/chrome, hvis Playwright ikke selv finder en browser.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch(e){pw=createRequire('/opt/node-tools/node_modules/')('playwright');}
const { chromium } = pw;
const URL=process.env.URL||'http://localhost:8000/';
const A={latitude:55.6907,longitude:12.5502}, B={latitude:55.6915,longitude:12.5502}; // B ≈ 89 m nord for A
let fails=0,n=0;
function ok(c,msg,extra){n++;if(!c){fails++;console.log('✗',msg,extra!==undefined?JSON.stringify(extra):'');}else console.log('✓',msg);}
const browser=await chromium.launch(process.env.CHROME?{executablePath:process.env.CHROME}:{});
async function open({hash='#kal=1&tur=1',geo=true,clock=true,positions=null}={}){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    permissions:geo?['geolocation']:[],geolocation:geo?{...A,accuracy:20}:undefined});
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/sw.js',r=>r.abort());
  await page.route('**/positions.json*',r=>positions?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(positions)}):r.fulfill({status:404,body:''}));
  if(clock)await page.clock.install({time:new Date('2026-10-08T10:00:00Z')});
  await page.goto(URL+hash);
  await page.waitForFunction(()=>typeof turCapture==='function');
  return {ctx,page,errors,
    store:()=>page.evaluate(()=>JSON.parse(JSON.stringify(STORE))),
    info:()=>page.evaluate(()=>document.getElementById('turinfo').textContent),
    toast:()=>page.evaluate(()=>document.getElementById('toast').textContent),
    pend:()=>page.evaluate(()=>turPend.length),
    geo:async(p,acc)=>{await ctx.setGeolocation({...p,accuracy:acc});await page.waitForTimeout(150);},
    arm:async(term)=>{await page.fill('#q',term);await page.clock.runFor(200);await page.click('#list .tree .spbtn');},
  };
}
// ---------- B1: skærmlås / ur ----------
{
  const t=await open();await t.geo(A,20);
  await t.page.click('#turStop');await t.page.clock.runFor(100);
  let s=await t.store();ok(s.stops.length===1&&s.stops[0].acc===20,'B1 stop gemt med ±20',s.stops);
  await t.page.clock.setSystemTime(new Date('2026-10-08T10:01:00Z')); // 60 s uden at affyre timere (skærmlås)
  await t.geo(B,8);
  s=await t.store();ok(s.stops[0].lat===55.6907&&s.stops[0].acc===20,'B1 aflæsning efter forfaldent vindue flytter ikke stoppet',s.stops[0]);
  ok((await t.pend())===0,'B1 fangsten er afsluttet');
  // visibilitychange skjult afslutter ventende fangster
  await t.page.clock.runFor(3000);await t.geo(B,20);
  await t.page.click('#turStop');ok((await t.pend())===1,'B1 ny fangst venter');
  await t.page.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  ok((await t.pend())===0,'B1 skærmlås afslutter fangsten');
  await t.page.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>false,configurable:true});});
  await t.geo(A,5);
  s=await t.store();ok(s.stops[1].lat===55.6915,'B1 aflæsning efter oplåsning rører ikke stop 2',s.stops[1]);
  // træfangst: samme regel
  await t.page.clock.runFor(3000);await t.geo(A,20);await t.arm('ginkgo');
  await t.page.click('#turTree');await t.page.clock.runFor(100);
  s=await t.store();const id='A|A-160|Ginkgo biloba';ok(s.trees[id]&&s.trees[id].acc===5,'B1 træ gemt med den mest præcise friske aflæsning',s.trees[id]);
  await t.page.clock.setSystemTime(new Date('2026-10-08T10:03:00Z'));await t.geo(B,8);
  s=await t.store();ok(s.trees[id].lat===55.6907,'B1 træet flytter ikke efter forfaldent vindue',s.trees[id]);
  ok(t.errors.length===0,'B1 ingen JS-fejl',t.errors);await t.ctx.close();
}
// ---------- R4: kun én fangst ad gangen, nyeste vinder ved uafgjort ----------
{
  const t=await open();await t.geo(A,20);
  await t.page.click('#turStop');await t.page.clock.runFor(3000);
  await t.geo(B,20);await t.page.click('#turStop');
  let s=await t.store();ok(s.stops.length===2&&s.stops[1].lat===55.6915,'R4 stop 2 får den nyeste aflæsning ved lige nøjagtighed',s.stops);
  ok((await t.pend())===1,'R4 kun én ventende fangst');
  await t.geo(B,9);s=await t.store();
  ok(s.stops[0].acc===20&&s.stops[1].acc===9,'R4 kun stop 2 forbedres',s.stops);
  await t.ctx.close();
}
// ---------- R1: ingen parring i omvisning ----------
{
  const t=await open();await t.geo(A,10);
  await t.page.click('#turStop');await t.page.clock.runFor(100);
  await t.page.click('.stopdot');
  const txt=await t.page.evaluate(()=>document.getElementById('stopsel').textContent);
  ok(/computeren/.test(txt)&&!/tryk nu/.test(txt),'R1 stop-boksen beder ikke om parring i omvisning',txt);
  await t.arm('ginkgo');
  const s=await t.store();ok(s.stops.length===1&&Object.keys(s.trees).length===0,'R1 træ-tryk parrer ikke',s);
  ok((await t.page.evaluate(()=>armed))!==null,'R1 træet er i stedet valgt');
  await t.ctx.close();
}
// ---------- R2: ✓ Gem bevarer obs og rå aflæsning ----------
{
  const t=await open({hash:'#kal=1'});
  const id='A|A-160|Ginkgo biloba';
  await t.page.evaluate(()=>{STORE.stops.push({ts:'2026-10-08T09:00:00.000Z',lat:55.6907,lon:12.5502,acc:9,note:'ved kapellet'});saveStore();buildDots();stopList();});
  await t.page.evaluate(()=>{pairStop(0,TREES.findIndex(x=>treeId(x)==='A|A-160|Ginkgo biloba'));});
  let s=await t.store();ok(s.trees[id].obs==='2026-10-08T09:00:00.000Z','R2 parring sætter obs');
  await t.page.evaluate(()=>armTree(TREES.findIndex(x=>treeId(x)==='A|A-160|Ginkgo biloba')));
  await t.page.click('.nudge button[data-n="1,0"]');await t.page.click('#calSave');
  s=await t.store();ok(s.trees[id].obs==='2026-10-08T09:00:00.000Z'&&s.trees[id].lat===55.6907&&s.trees[id].src==='gps'&&s.trees[id].note==='ved kapellet','R2 pile + Gem bevarer obs/lat/note',s.trees[id]);
  await t.page.evaluate(()=>armTree(TREES.findIndex(x=>treeId(x)==='A|A-160|Ginkgo biloba')));
  const r=await t.page.evaluate(()=>document.getElementById('mapimg').getBoundingClientRect().toJSON());
  await t.page.mouse.click(r.x+r.width*0.5,r.y+r.height*0.5);await t.page.click('#calSave');
  s=await t.store();ok(s.trees[id].src==='kort'&&s.trees[id].obs==='2026-10-08T09:00:00.000Z'&&s.trees[id].lat===55.6907&&Math.abs(s.trees[id].fx-0.5)<0.01,'R2 kort-tryk + Gem: src kort, obs og lat bevaret',s.trees[id]);
  await t.ctx.close();
}
// ---------- R3: genimport efter parring; slettede stop; dublet-fortryd ----------
{
  const t=await open({hash:'#kal=1'});
  const F=(stops)=>({name:'positions.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,trees:{},stops}))});
  const S1={ts:'2026-10-08T09:10:11.111Z',lat:55.6907,lon:12.5502,acc:8},S2={ts:'2026-10-08T09:12:13.222Z',lat:55.6908,lon:12.5503,acc:8},S3={ts:'2026-10-08T09:20:00.000Z',lat:55.6909,lon:12.5504,acc:8};
  await t.page.setInputFiles('#calFile',F([S1,S2,{ts:'ugyldig',lat:1},{ts:'2026-10-08T09:30:00.000Z',lat:'55.69',lon:null}]));await t.page.waitForTimeout(200);
  let s=await t.store();ok(s.stops.length===3&&s.stops[2].lat===undefined,'R3 import: ugyldig ts afvist, lat som streng bliver "uden GPS"',s.stops);
  await t.page.evaluate(()=>{pairStop(0,0);pairStop(0,1);});
  s=await t.store();ok(s.stops.length===1,'R3 to stop parret');
  await t.page.setInputFiles('#calFile',F([S1,S2,S3]));await t.page.waitForTimeout(200);
  s=await t.store();ok(s.stops.length===2&&s.stops.some(x=>x.ts===S3.ts)&&!s.stops.some(x=>x.ts===S1.ts),'R3 genimport springer parrede stop over',s.stops.map(x=>x.ts));
  // fortryd parring efter genimport med samme ts giver ikke dublet
  await t.page.setInputFiles('#calFile',F([S2]));await t.page.waitForTimeout(200);
  await t.page.evaluate(()=>{turLast=null;}); // ryd; parr S3 og fortryd mens S3 også genimporteres
  await t.page.evaluate(()=>{pairStop(STORE.stops.findIndex(x=>x.ts==='2026-10-08T09:20:00.000Z'),5);});
  await t.page.setInputFiles('#calFile',F([S3]));await t.page.waitForTimeout(200); // S3 er nu parret lokalt (obs) → springes over
  s=await t.store();ok(!s.stops.some(x=>x.ts===S3.ts),'R3 parret stop kommer ikke tilbage ved import');
  await t.page.evaluate(()=>turUndo());
  s=await t.store();ok(s.stops.filter(x=>x.ts===S3.ts).length===1,'R3 fortrudt parring: præcis ét stop med S3',s.stops.map(x=>x.ts));
  // slet stop huskes
  t.page.on('dialog',d=>d.accept());
  await t.page.evaluate(()=>delStop(STORE.stops.findIndex(x=>x.ts==='2026-10-08T09:20:00.000Z')));
  await t.page.setInputFiles('#calFile',F([S3]));await t.page.waitForTimeout(200);
  s=await t.store();ok(!s.stops.some(x=>x.ts===S3.ts)&&s.delStops.includes(S3.ts),'R3 slettet stop vender ikke tilbage fra en gammel eksport',s.delStops);
  ok(t.errors.length===0,'R3 ingen JS-fejl',t.errors);await t.ctx.close();
}
// ---------- R5: træfangst uden aflæsning ----------
{
  const t=await open({geo:false});
  await t.arm('ginkgo');await t.page.click('#turTree');
  ok((await t.pend())===1,'R5 fangst venter');
  await t.page.click('#turUndo');
  ok(/Afbrudt/.test(await t.toast())&&(await t.pend())===0,'R5 fortryd afbryder ventende fangst',await t.toast());
  await t.arm('ginkgo');await t.page.click('#turTree');await t.page.clock.runFor(20500);
  const s=await t.store();ok(s.stops.length===1&&/A-160/.test(s.stops[0].note)&&s.stops[0].lat===undefined,'R5 uden GPS i 20 s: stop med træets navn som note',s.stops);
  ok(/gemt som stop/.test(await t.toast()),'R5 toast siger gemt som stop');
  ok(/GPS-fejl|venter/.test(await t.info()),'R5 infolinjen viser GPS-status',await t.info());
  await t.ctx.close();
}
// ---------- R6/R7: berøringsflader, bekræftelse, søg ----------
{
  const t=await open();
  const m=await t.page.evaluate(()=>{const g=i=>document.getElementById(i).getBoundingClientRect();const u=g('turUndo'),o=g('turOff'),s=g('turStop'),f=g('turFind');return {uh:u.height,oh:o.height,ow:o.width,gap:s.top-o.bottom,fh:f.height,infoW:g('turinfo').width};});
  ok(m.uh>=44&&m.oh>=44&&m.fh>=44&&m.ow>=44,'R6 små knapper mindst 44 px',m);
  ok(m.gap>=14,'R6 mindst 14 px luft til Stop-knappen',m);
  ok(m.infoW>300,'R6 infolinjen har sin egen linje',m);
  t.page.once('dialog',d=>d.dismiss());await t.page.click('#turOff');
  ok(await t.page.evaluate(()=>document.body.classList.contains('tur')),'R6 ✕ afslut uden bekræftelse slukker ikke');
  await t.page.click('#turFind');await t.page.waitForTimeout(1500);
  const q=await t.page.evaluate(()=>({top:document.getElementById('q').getBoundingClientRect().top,active:document.activeElement.id}));
  ok(q.active==='q'&&Math.abs(q.top)<40,'R7 søg ruller feltet til toppen',q);
  // dobbelttryk 📡
  await t.geo(A,10);await t.arm('ginkgo');
  const idx=await t.page.evaluate(()=>armed);
  await t.page.evaluate(i=>{turCapture('tree',i);turCapture('tree',i);},idx);
  ok((await t.pend())===1&&/allerede/.test(await t.toast()),'småting: dobbelttryk på 📡 afvises',await t.toast());
  ok(t.errors.length===0,'R6/R7 ingen JS-fejl',t.errors);await t.ctx.close();
}
// ---------- uden for kortet: træ gemmes ikke, stop eksporteres ikke ----------
{
  const t=await open();const H={latitude:55.70,longitude:12.60};
  await t.page.clock.runFor(5000);await t.geo(H,10); // startaflæsningen fra testopsætningen er nu ældre end 4 s
  await t.arm('ginkgo');await t.page.click('#turTree');
  ok((await t.pend())===1&&/Henter GPS/.test(await t.info()),'udenfor: træfangst venter (ingen aflæsning inden for kortet)',await t.info());
  await t.geo(H,6);
  ok(/uden for kortet/.test(await t.info()),'udenfor: info siger uden for kortet',await t.info());
  await t.page.click('#turStop');
  const ex=await t.page.evaluate(()=>mergedData());
  ok(!(ex.stops||[]).some(x=>Number.isFinite(x.lat)),'udenfor: stop med koordinater hjemme eksporteres ikke (kun note-stoppet)',ex.stops);
  await t.page.clock.runFor(21000);
  const s=await t.store();ok(Object.keys(s.trees).length===0&&s.stops.length===2,'udenfor: træet blev et stop med note i stedet',s);
  await t.ctx.close();
}
await browser.close();
console.log(`\n${n-fails}/${n} grønne`);process.exit(fails?1:0);
