export const CAP=3, TYPES=['A','B','C'];
const layout=[
  ['Приёмка','ABCBAC','ABC','BAC'],
  ['Соседние полки','CABBCABA','ABCA','BCAB'],
  ['Двойной заказ','CCABACBBAC','ABCAC','BCA BC'.replace(' ','')],
  ['Узкий проход','BCACBACABCAA','ACABCA','BACABC'],
  ['Перед закрытием','CCBAABCABACABB','ABCCABA','ABCABCB'],
  ['Ночная накладная','BBACACABCBCAABCC','ABACBACC','CBC ABCAB'.replace(' ','')],
];
export const make=(name,feed,one,two)=>({name,feed:[...feed],orders:[[...one],[...two]]});
export const levels=layout.map(v=>make(...v));
export const training={...make('Учебная накладная','ABBCA','ABB','AC'),capacity:1};
export const capacity=level=>level.capacity??CAP;
export function newRun(level){return {index:0,counts:[0,0,0],heads:[0,0],parks:0,state:'play'}}
const wanted=(level,r,lane)=>level.orders[lane][r.heads[lane]];
export const waiting=(level,r)=>level.feed[r.index];
export const buffered=r=>r.counts.flatMap((n,i)=>Array(n).fill(TYPES[i]));
export function actions(level,r){
  if(r.state!=='play')return [];
  const result=[];
  const front=waiting(level,r);
  for(let lane=0;lane<2;lane++){
    const w=wanted(level,r,lane);
    if(!w)continue;
    if(w===front)result.push({kind:'send',from:'front',lane,type:w});
    if(r.counts[TYPES.indexOf(w)]>0)result.push({kind:'send',from:'buffer',lane,type:w});
  }
  if(front&&r.counts.reduce((a,b)=>a+b,0)<capacity(level))result.push({kind:'park',type:front});
  return result;
}
export function step(level,r,a){
  if(!actions(level,r).some(v=>v.kind===a.kind&&v.type===a.type&&v.lane===a.lane&&v.from===a.from))return r;
  const next={...r,counts:r.counts.slice(),heads:r.heads.slice()};
  const i=TYPES.indexOf(a.type);
  if(a.kind==='park'){next.counts[i]++;next.index++;next.parks++}
  else {
    next.heads[a.lane]++;
    if(a.from==='front')next.index++;else next.counts[i]--;
  }
  if(next.heads.every((head,l)=>head===level.orders[l].length))next.state='won';
  else if(!actions(level,next).length)next.state='stuck';
  return next;
}
export function solve(level,run=newRun(level),memo=new Map()){
  if(run.state==='won')return [];
  if(run.state==='stuck')return null;
  const key=[run.index,...run.counts,...run.heads].join(',');
  if(memo.has(key))return memo.get(key);
  let best=null,score=Infinity;
  for(const a of actions(level,run)){
    const tail=solve(level,step(level,run,a),memo);
    if(!tail)continue;
    const n=tail.reduce((sum,x)=>sum+Number(x.kind==='park'),Number(a.kind==='park'));
    if(n<score){best=[a,...tail];score=n}
  }
  memo.set(key,best);return best;
}
const randFactory=seed=>()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0};
export function dailyLevel(date){
  const day=date.toISOString().slice(0,10);
  const rand=randFactory(Math.imul(Date.parse(day)/864e5,1664525)>>>0||1);
  for(let i=0;i<40;i++){
    const a=Array.from({length:6},()=>TYPES[rand()%3]);
    const b=Array.from({length:6},()=>TYPES[rand()%3]);
    const feed=[...a,...b];
    for(let j=feed.length-1;j>0;j--){const k=rand()%(j+1);[feed[j],feed[k]]=[feed[k],feed[j]]}
    const l={...make('Дневная накладная',feed,a,b),day};
    const path=solve(l);
    if(path&&path.filter(x=>x.kind==='park').length>=2)return l;
  }
  return {...levels[5],name:'Дневная накладная',day};
}
