import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const files={'/':'index.html','/app.mjs':'app.mjs','/model.mjs':'model.mjs','/style.css':'style.css'};
const http=createServer(async(req,res)=>{
  const name=files[req.url];
  if(!name){res.writeHead(404).end();return}
  try{
    res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
    res.end(await readFile('packed/'+name));
  }catch{res.writeHead(500).end()}
});
await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+http.address().port+'/';
const day=new Date('2026-11-27T12:00:00Z');
let browser;
const errors=[], external=[];
async function pageFor(mobile){
  const page=await browser.newPage({viewport:mobile?{width:360,height:740}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
  await page.route('**/*',route=>{
    if(route.request().url().startsWith(url))return route.continue();
    external.push(route.request().url());return route.abort();
  });
  await page.clock.install({time:day});
  const response=await page.goto(url);
  assert.equal(response.status(),200);
  assert.equal(await page.title(),'Сортировочная');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#status').waitFor();
  return page;
}
async function screenshot(page,file){
  if(process.env.QA_SCREENSHOTS){
    await mkdir(process.env.QA_SCREENSHOTS,{recursive:true});
    await page.screenshot({path:process.env.QA_SCREENSHOTS+'/'+file+'.png',animations:'disabled'});
  }
}

async function checkSort(desktop,mobile){
  const {levels,newRun,solve,dailyLevel,actions,step}=await import('../game/model.mjs');
  const execute=async (page,path)=>{
    for(const a of path){
      if(a.kind==='park'){await page.locator('#park').click();continue}
      if(a.from==='buffer')await page.locator('#buffer button[data-pick="'+a.type+'"]').first().click();
      await page.locator('#send'+a.lane).click();
    }
  }
  await screenshot(desktop,'sort-desktop');
  await execute(desktop,solve(levels[0]));
  assert.match(await desktop.locator('#status').textContent(),/Оба заказа собраны/);
  await desktop.locator('#next').click();
  await desktop.reload();
  assert.match(await desktop.locator('#stage').textContent(),/02/);
  for(const l of levels.slice(1)){
    await execute(desktop,solve(l));
    assert.match(await desktop.locator('#status').textContent(),/Оба заказа собраны/);
    await desktop.locator('#next').click();
  }
  assert.match(await desktop.locator('#stage').textContent(),/01/);
  await desktop.getByRole('button',{name:'Дневная накладная'}).click();
  const daily=dailyLevel(day), path=solve(daily);
  await execute(desktop,path);
  const best='Лучший результат: '+path.filter(a=>a.kind==='park').length+' в буфер';
  assert.equal(await desktop.locator('#record').textContent(),best);
  await desktop.reload();
  await desktop.getByRole('button',{name:'Дневная накладная'}).click();
  assert.equal(await desktop.locator('#record').textContent(),best);
  const target=await mobile.getByRole('button',{name:'Отправить в А'}).isEnabled()?0:1;
  await mobile.locator('#send'+target).tap();
  assert.match(await mobile.locator('#status').textContent(),/в заказе/);
  await mobile.locator('#park').tap();
  assert.equal(await mobile.locator('#slots').textContent(),'1 / 3');
  await screenshot(mobile,'sort-mobile');
  const l=levels[4], visited=new Set();let loss=null;
  function find(s,p){
    const key=[s.index,...s.counts,...s.heads].join(',');
    if(loss||visited.has(key))return;
    visited.add(key);
    if(s.state==='stuck'){loss=p;return}
    for(const a of actions(l,s)) find(step(l,s,a),[...p,a]);
  }
  find(newRun(l),[]);
  assert.ok(loss);
  await desktop.evaluate(()=>localStorage.setItem('buffer-sort.stage.v1','4'));
  await desktop.reload();
  await execute(desktop,loss);
  assert.match(await desktop.locator('#status').textContent(),/Буфер полон/);
  await desktop.locator('#reset').click();
  assert.equal(await desktop.locator('#slots').textContent(),'0 / 3');
}
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined});
  const desktop=await pageFor(false), mobile=await pageFor(true);
  await checkSort(desktop,mobile);
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  console.log('DESKTOP_MOBILE_STORAGE_AND_NO_EXTERNAL_REQUESTS_PASS');
}finally{await browser?.close();http.close()}
