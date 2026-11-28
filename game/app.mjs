import {capacity,training,levels,newRun,waiting,buffered,actions,step,dailyLevel} from './model.mjs';
const q=id=>document.getElementById(id), symbols={A:'■',B:'●',C:'▲'}, names={A:'Квадрат',B:'Круг',C:'Треугольник'};
let index=0,modeName='campaign',level=levels[0],run=newRun(level),selected={from:'front'},note='';
const stageKey='buffer-sort.stage.v1', recordKey='buffer-sort.daily.v1';
try{const n=Number(localStorage.getItem(stageKey));if(Number.isInteger(n)&&n>=0&&n<levels.length)index=n}catch{}
level=levels[index];run=newRun(level);
function chip(type){
  const span=document.createElement('span');span.className='crate '+type;
  span.textContent=symbols[type];span.title=names[type];
  return span;
}
function choose(from,type){selected={from,type};render()}
function currentRecord(){
  try{const r=JSON.parse(localStorage.getItem(recordKey));if(r?.date===level.day&&Number.isInteger(r.parks)&&r.parks>=0&&r.parks<=level.feed.length)return r.parks}catch{}
  return null;
}
function remember(){
  if(modeName!=='daily')return;
  const best=currentRecord();
  if(best===null||run.parks<best){try{localStorage.setItem(recordKey,JSON.stringify({date:level.day,parks:run.parks}))}catch{}}
}
function render(){
  const isDaily=modeName==='daily',limit=capacity(level);
  q('stage').textContent=isDaily?level.day+' UTC':modeName==='training'?'ОБУЧЕНИЕ':String(index+1).padStart(2,'0')+' / 06';
  for(const mode of ['campaign','daily','training'])q(mode).setAttribute('aria-pressed',String(modeName===mode));
  const best=isDaily?currentRecord():null;
  q('record').hidden=!isDaily;q('record').textContent=best===null?'Лучший результат: пока нет':'Лучший результат: '+best+' в буфер';
  const valid=actions(level,run), front=waiting(level,run);
  q('front').replaceChildren(...(front?[chip(front)]:['Лента пуста']));q('front').setAttribute('aria-label',front?'На ленте: '+names[front]:'Лента пуста');
  q('front').disabled=!front||run.state!=='play';q('front').setAttribute('aria-pressed',String(selected.from==='front'&&!!front));
  q('feed').replaceChildren(...level.feed.slice(run.index+1,run.index+6).map(chip));
  const buffer=buffered(run);
  const items=buffer.map(type=>{
    const button=document.createElement('button');
    button.type='button';button.dataset.pick=type;button.setAttribute('aria-label','Из буфера: '+names[type]);
    button.setAttribute('aria-pressed',String(selected.from==='buffer'&&selected.type===type));
    button.disabled=run.state!=='play';button.append(chip(type));
    button.onclick=()=>{choose('buffer',type);q('buffer').querySelector('button[data-pick="'+type+'"]')?.focus()};return button;
  });
  while(items.length<limit){const p=document.createElement('div');p.className='empty';p.setAttribute('aria-hidden','true');items.push(p)}
  q('buffer').replaceChildren(...items);q('slots').textContent=buffer.length+' / '+limit;
  q('park').disabled=!valid.some(a=>a.kind==='park');
  level.orders.forEach((order,lane)=>{
    q('queue'+lane).replaceChildren(...order.map((type,i)=>{
      const li=document.createElement('li');li.append(chip(type));
      if(i<run.heads[lane])li.className='done';else if(i===run.heads[lane])li.setAttribute('aria-current','step');
      return li;
    }));
    q('send'+lane).disabled=!valid.some(a=>a.kind==='send'&&a.lane===lane&&a.from===selected.from&&(selected.from==='front'||a.type===selected.type));
  });
  q('next').hidden=run.state!=='won';
  q('next').textContent=modeName!=='campaign'?'Ещё раз':index===levels.length-1?'К первому уровню':'Следующий уровень';
  const demand=lane=>names[level.orders[lane][run.heads[lane]]]?.toLowerCase()??'заказ уже собран';
  const blockedText=modeName==='training'&&run.state==='stuck'
    ? 'Буфер полон. На ленте: '+(names[front]?.toLowerCase()??'нет груза')+'. Убрать коробку некуда, а заказы ждут другое. Заказ А: '+demand(0)+'. Заказ Б: '+demand(1)+'.'
    : 'Буфер полон, ни одна коробка не подходит. Начни накладную заново.';
  q('status').textContent=run.state==='stuck'?blockedText:run.state==='won'?'Оба заказа собраны. Отложено в буфер: '+run.parks+'.':note||level.name+' · Выбери коробку и заказ. В буфер можно убрать только первую с ленты.';
}
function apply(kind,lane){
  const a=actions(level,run).find(v=>v.kind===kind&&(kind==='park'||v.lane===lane&&v.from===selected.from&&(selected.from==='front'||v.type===selected.type)));
  if(!a)return;
  run=step(level,run,a);
  note=kind==='park'?names[a.type]+' в буфере.':names[a.type]+' в заказе '+(lane===0?'А.':'Б.');
  selected={from:'front'};
  if(run.state==='won')remember();
  render();
}
function restart(){run=newRun(level);selected={from:'front'};note='';render()}
function mode(name){if(modeName===name)return;modeName=name;level=name==='training'?training:name==='daily'?dailyLevel(new Date()):levels[index];restart()}
q('front').onclick=()=>choose('front');
q('park').onclick=()=>apply('park');
q('send0').onclick=()=>apply('send',0);
q('send1').onclick=()=>apply('send',1);
for(const name of ['campaign','daily','training'])q(name).onclick=()=>mode(name);
q('reset').onclick=restart;
q('next').onclick=()=>{if(modeName==='campaign'){index=(index+1)%levels.length;level=levels[index];try{localStorage.setItem(stageKey,String(index))}catch{}}restart()};
render();
