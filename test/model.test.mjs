import assert from 'node:assert/strict';
import test from 'node:test';
import {CAP,capacity,training,levels,newRun,actions,step,solve,dailyLevel} from '../game/model.mjs';
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

test('training has one slot and the first order choice changes the outcome',()=>{
  const start=newRun(training),send=(r,lane)=>actions(training,r).find(a=>a.kind==='send'&&a.from==='front'&&a.lane===lane);
  assert.equal(capacity(training),1);
  assert.ok(levels.every(l=>capacity(l)===3));
  assert.equal(capacity(dailyLevel(new Date('2026-11-27T12:00:00Z'))),3);
  const left=step(training,start,send(start,0));
  const tail=solve(training,left);assert.ok(tail);
  assert.equal(tail.reduce((r,a)=>step(training,r,a),left).state,'won');
  const right=step(training,start,send(start,1));
  const park=actions(training,right).find(a=>a.kind==='park');assert.ok(park);
  const stuck=step(training,right,park);
  assert.equal(stuck.state,'stuck');
  assert.deepEqual(actions(training,stuck),[]);
  assert.equal(training.feed[stuck.index],'B');
});
