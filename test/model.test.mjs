import assert from 'node:assert/strict';
import test from 'node:test';
import {CAP,levels,newRun,actions,step,solve,dailyLevel} from '../game/model.mjs';
function complete(level){
  const result=solve(level);assert.ok(result);
  assert.deepEqual(level.feed.slice().sort(),level.orders.flat().sort());
  let r=newRun(level);
  for(const a of result){r=step(level,r,a);assert.ok(r.counts.reduce((a,b)=>a+b,0)<=CAP)}
  assert.equal(r.state,'won');
  assert.deepEqual(r.counts,[0,0,0]);
  assert.equal(r.index,level.feed.length);
  return r.parks;
}
test('all six orders are solvable and later orders require the buffer',()=>{
  assert.deepEqual(levels.map(complete),[0,1,3,2,3,2]);
});
test('wrong sends cannot mutate a run; choices can reach a real dead end',()=>{
  const l=levels[4],r=newRun(l);
  assert.equal(step(l,r,{kind:'send',lane:0,type:'C',from:'front'}),r);
  const stack=[r],seen=new Set();let stuck=false;
  while(stack.length){
    const s=stack.pop(),key=[s.index,...s.counts,...s.heads].join(',');
    if(seen.has(key))continue;seen.add(key);
    if(s.state==='stuck'){assert.deepEqual(actions(l,s),[]);stuck=true;break}
    for(const a of actions(l,s))stack.push(step(l,s,a));
  }
  assert.ok(stuck);
});
test('365 deterministic daily orders are valid, varied and require strategy',()=>{
  const seen=new Set(),start=Date.UTC(2026,0,1);
  for(let i=0;i<365;i++){
    const ms=start+i*864e5, l=dailyLevel(new Date(ms));
    assert.deepEqual(l,dailyLevel(new Date(ms+86399999)));
    assert.ok(complete(l)>=2);
    seen.add(l.feed.join('')+'/'+l.orders.map(x=>x.join('')).join('/'));
  }
  assert.ok(seen.size>280);
});
