// Headless-tjek af kommunens data i siden (PR #10 og reviewets B1–B3/R1). Kør fra repo-roden:
//   python3 -m http.server 8000 &   # siden skal serveres (service workeren blokeres af testen)
//   npm i playwright && node tests/kommunedata.test.mjs
// Sæt CHROME=/sti/til/chrome, hvis Playwright ikke selv finder en browser.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch(e){pw=createRequire('/opt/node-tools/node_modules/')('playwright');}
const { chromium } = pw;
const fs=require('fs');
const BASE=process.env.URL||'http://localhost:8000/'; // URL-klassen må ikke skygges: den bruges til positions.json
let fails=0,n=0;
function ok(c,msg,extra){n++;if(!c){fails++;console.log('✗',msg,extra!==undefined?JSON.stringify(extra):'');}else console.log('✓',msg);}
const browser=await chromium.launch(process.env.CHROME?{executablePath:process.env.CHROME}:{});
const FILE=JSON.parse(fs.readFileSync(new URL('../positions.json',import.meta.url),'utf8'));
const ID='A|A-135|Liriodendedron tulipifera'; // kk-post i filen
async function open({hash='#kal=1',positions=FILE,local=null}={}){
  const ctx=await browser.newContext({viewport:{width:1200,height:900},permissions:['geolocation'],geolocation:{latitude:55.6907,longitude:12.5502,accuracy:20}});
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/sw.js',r=>r.abort());
  await page.route('**/positions.json*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(positions)}));
  if(local)await page.addInitScript(l=>localStorage.setItem('assistens_pos_v1',JSON.stringify(l)),local);
  await page.goto(BASE+hash);await page.waitForFunction(()=>typeof kkDots==='function');await page.waitForTimeout(300);
  return {ctx,page,errors,store:()=>page.evaluate(()=>JSON.parse(JSON.stringify(STORE))),pos:(id)=>page.evaluate(i=>getPos(TREES.find(t=>treeId(t)===i)),id)};
}
// B1 (siden): lokal menneskelig post ældre end filens kk-post overlever og vinder
{
  const local={anchors:[],trees:{[ID]:{fx:0.4,fy:0.4,src:'kort',ts:'2026-09-01T10:00:00.000Z'},'A|A-160|Ginkgo biloba':{del:1,ts:'2026-09-01T10:00:00.000Z'}},stops:[]};
  const t=await open({local});
  const s=await t.store();ok(s.trees[ID]&&s.trees[ID].src==='kort','B1 lokal kort-post slettes ikke af filens kk-post');
  ok(s.trees['A|A-160|Ginkgo biloba']&&s.trees['A|A-160|Ginkgo biloba'].del===1,'B1 lokal sletning overlever filens kk-post');
  const p=await t.pos(ID);ok(p.src==='kort'&&p.fx===0.4,'B1 getPos: menneskets post vinder over kk uanset ts',p);
  ok((await t.pos('A|A-160|Ginkgo biloba'))===null,'B1 getPos: sletning vinder over kk');
  const m=await t.page.evaluate(()=>mergedData().trees);ok(m[ID].src==='kort'&&m['A|A-160|Ginkgo biloba'].del===1,'B1 mergedData: menneskets post og sletning eksporteres');
  // import af fil med kk-post ændrer ikke den lokale menneskelige post
  await t.page.setInputFiles('#calFile',{name:'p.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(FILE))});await t.page.waitForTimeout(300);
  ok((await t.store()).trees[ID].src==='kort','B1 import: kk-post overskriver ikke lokal kort-post');
  // men en nyere menneskelig post i filen publicerer den lokale
  const f2=JSON.parse(JSON.stringify(FILE));f2.trees[ID]={fx:0.41,fy:0.41,src:'kort',ts:'2026-09-02T10:00:00.000Z'};
  const t2=await open({local,positions:f2});const s2=await t2.store();
  ok(!s2.trees[ID],'B1 en nyere kort-post i filen rydder stadig den lokale');
  ok(t.errors.length===0&&t2.errors.length===0,'B1 ingen JS-fejl',t.errors);await t.ctx.close();await t2.ctx.close();
}
// B2: flyttet kk-post gemmes som kort; uflyttet forbliver kk
{
  const t=await open();
  await t.page.evaluate(i=>armTree(TREES.findIndex(x=>treeId(x)===i)),ID);
  await t.page.click('#calSave');let p=await t.pos(ID);
  ok(p.src==='kk'&&p.note.startsWith('KK ')&&p.lat,'B2 uflyttet ✓ Gem forbliver forslag',p);
  await t.page.evaluate(i=>armTree(TREES.findIndex(x=>treeId(x)===i)),ID);
  await t.page.click('.nudge button[data-n="1,0"]');await t.page.click('#calSave');p=await t.pos(ID);
  ok(p.src==='kort'&&!p.lat&&!p.note,'B2 pile + Gem → kort uden lat/note',p);
  const r=await t.page.evaluate(()=>document.getElementById('mapimg').getBoundingClientRect().toJSON());
  const ID2='A|A-160|Ginkgo biloba';
  await t.page.evaluate(i=>armTree(TREES.findIndex(x=>treeId(x)===i)),ID2);
  await t.page.mouse.click(r.x+r.width*0.5,r.y+r.height*0.5);await t.page.click('#calSave');p=await t.pos(ID2);
  ok(p.src==='kort'&&!p.lat&&!p.note,'B2 kort-tryk + Gem → kort uden lat/note',p);
  await t.ctx.close();
}
// B3 + R1 + småting: KK-punkt → kort; notearv; ortofoto/KK slukkes med kalibreringen; kkDots kun når laget er tændt
{
  const t=await open();
  await t.page.click('#calKKBtn');await t.page.waitForFunction(()=>KK&&document.querySelectorAll('.kkdot').length>0,null,{timeout:20000});
  const nd=await t.page.evaluate(()=>document.querySelectorAll('.kkdot').length);ok(nd>3000,'KK-laget tegner punkter',nd);
  await t.page.evaluate(i=>armTree(TREES.findIndex(x=>treeId(x)===i)),'B|B-129|Amelancier laevis');
  await t.page.evaluate(()=>document.querySelector('.kkdot.reg:not(.anon)').click());
  await t.page.click('#calSave');let p=await t.pos('B|B-129|Amelancier laevis');
  ok(p.src==='kort'&&p.lat&&p.acc===1&&/registertræ #\d+ valgt/.test(p.note),'B3 KK-punkt gemmes som kort med lat/lon og note',p);
  // notearv: omvisningsfangst og parring på en kk-post tager ikke scriptets note med
  await t.page.evaluate(()=>{STORE.stops.push({ts:'2026-10-08T09:00:00.000Z',lat:55.690005,lon:12.552354,acc:9});pairStop(0,TREES.findIndex(x=>treeId(x)==='A|A-135|Liriodendedron tulipifera'));});
  p=await t.pos(ID);ok(p.src==='gps'&&!p.note&&p.obs,'R1 parring arver ikke "KK …"-noten',p);
  await t.page.evaluate(()=>{const i=TREES.findIndex(x=>treeId(x)==='A|A-400|Mespilus germanica');const p={kind:'tree',idx:i,ts:nowTs(),fix:{lat:55.6907,lon:12.5502,acc:9,t:Date.now()},saved:false,buzzed:false,deadline:Date.now()+8000};turPend.push(p);turApply(p);turFinish(p);});
  p=await t.pos('A|A-400|Mespilus germanica');ok(p.src==='gps'&&!p.note,'R1 omvisningsfangst arver ikke "KK …"-noten',p);
  // ortofoto og KK-lag slukkes med kalibreringen
  await t.page.click('#calOrtoBtn');ok(await t.page.evaluate(()=>document.body.classList.contains('orto')),'ortofoto tændt');
  await t.page.click('#calBtn');
  const st=await t.page.evaluate(()=>({orto:document.body.classList.contains('orto'),kkl:document.body.classList.contains('kkl'),dots:document.querySelectorAll('.kkdot').length,ortoDisp:getComputedStyle(document.getElementById('orto')).display}));
  ok(!st.orto&&!st.kkl&&st.dots===0&&st.ortoDisp==='none','ortofoto/KK-lag slukkes med kalibreringen, punkterne fjernes',st);
  ok(t.errors.length===0,'B3/R1 ingen JS-fejl',t.errors);await t.ctx.close();
}
// besøgende: kk-poster vises som prikker
{
  const t=await open({hash:''});
  const d=await t.page.evaluate(()=>document.querySelectorAll('#mapwrap .dot').length);ok(d>=300,'besøgende ser kk-prikkerne',d);
  ok(t.errors.length===0,'besøgende: ingen JS-fejl',t.errors);await t.ctx.close();
}
await browser.close();console.log(`\n${n-fails}/${n} grønne`);process.exit(fails?1:0);
