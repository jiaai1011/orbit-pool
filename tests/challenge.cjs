const assert=require('assert'),P=require('../src/physics'),C=require('../src/challenge'),solutions=require('./challenge-solutions.json')
assert.equal(C.levels.length,50);assert.equal(new Set(C.levels.map(l=>JSON.stringify(l.balls))).size,50)
let progress=C.sanitize(null)
for(const l of C.levels){
 assert.equal(l.id,C.levels.indexOf(l)+1);assert.equal(l.chapter,Math.floor((l.id-1)/10));assert(l.limit>=l.par)
 const bs=l.balls.map(C.fresh),state=C.create(l.id)
 for(const b of bs){assert(b.x>P.R&&b.x<P.W-P.R&&b.y>P.R&&b.y<P.H-P.R,'layout must stay on cloth: '+l.id);for(const q of bs)if(q!==b)assert(Math.hypot(q.x-b.x,q.y-b.y)>P.R*2,'no overlap')}
 let result=null,shots=0
 for(const shot of solutions[l.id-1].shots){
  C.start(state);P.shoot(bs[0],shot.angle,shot.power,{top:shot.top||0,side:shot.side||0});let ticks=0
  while(P.moving(bs)&&ticks++<9000)P.step(bs,.25,null,e=>C.record(state,e))
  assert(ticks<9000);shots++;result=C.finish(state,bs,shots)
  if(result)break
 }
 assert(result&&result.won,'level '+l.id+' must be physically solvable: '+JSON.stringify(result));assert.equal(result.stars,3)
 progress=C.save(progress,l.id,result,shots);assert.equal(C.unlocked(progress),Math.min(50,l.id+1))
}
assert.deepEqual(C.stats(progress),{cleared:50,stars:150,unlocked:50})
const roundtrip=C.sanitize(JSON.parse(JSON.stringify(progress)));assert.deepEqual(roundtrip,progress)
assert.deepEqual(C.sanitize({records:{1:{stars:8,shots:1},2:{stars:2,shots:-1}}}),{records:{}})
let state=C.create(31);C.start(state);C.record(state,{type:'contact',a:0,b:2});assert(!C.finish(state,state.level.balls.map(C.fresh),1).won)
state=C.create(1);C.start(state);C.record(state,{type:'pocket',n:1,pocket:0});C.record(state,{type:'pocket',n:0,pocket:1});assert(!C.finish(state,state.level.balls.map(C.fresh),1).won)
state=C.create(21);C.start(state);C.record(state,{type:'contact',a:0,b:1});C.record(state,{type:'pocket',n:1,pocket:state.level.pockets[1]});assert(!C.finish(state,state.level.balls.map(C.fresh),1).won)
state=C.create(26);C.start(state);C.record(state,{type:'contact',a:0,b:1});C.record(state,{type:'rail',n:0});C.record(state,{type:'pocket',n:1,pocket:state.level.pockets[1]});assert(!C.finish(state,state.level.balls.map(C.fresh),1).won)
state=C.create(7);C.start(state);C.record(state,{type:'contact',a:0,b:1});C.record(state,{type:'pocket',n:1,pocket:(state.level.pockets[1]+1)%6});assert(!C.finish(state,state.level.balls.map(C.fresh),1).won)
state=C.create(11);C.start(state);C.record(state,{type:'pocket',n:1,pocket:0});const bs=state.level.balls.map(C.fresh);bs[0].x=5;bs[0].y=5;assert(!C.finish(state,bs,1).won)
state=C.create(1);C.start(state);assert.equal(C.finish(state,state.level.balls.map(C.fresh),1),null);assert(!C.finish(state,state.level.balls.map(C.fresh),state.level.limit).won)
const unchanged=C.save(progress,1,{won:true,stars:1},3);assert.deepEqual(unchanged.records[1],progress.records[1]);assert.deepEqual(C.save(progress,1,{won:false},2),progress)
console.log('PASS: all 50 unique layouts physically cleared; 150 stars, unlock/save/restore, wrong first contact/order/pocket, scratch, bank/kick, position zone, shot limit, best record')
