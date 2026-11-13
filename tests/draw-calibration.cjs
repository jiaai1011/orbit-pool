const assert=require('assert'),P=require('../src/physics')
const fresh=(n,x,y=92)=>({n,x,y,vx:0,vy:0,z:0,vz:0,rx:0,ry:0,wz:0,side:0,dead:false})
function measure(distance,power,top=-1,side=0){const bs=[fresh(0,30),fresh(1,30+distance)],shot={top,side};P.shoot(bs[0],0,power,shot);const launch=bs[0].vx;let contact=null,min=0,spinAtHit=null
 for(let i=0;i<1600&&P.moving(bs);i++){P.step(bs,.25,null,e=>{if(e.type==='contact'&&contact===null){contact=bs[0].x;spinAtHit=bs[0].rx}});if(contact===null)assert(bs[0].vx>=-1e-8,'ordinary draw must not reverse before contact');else min=Math.min(min,bs[0].vx)}
 return {launch,hit:contact!==null,min,spinAtHit}
}
for(const power of [.1,.4,.7,1]){const b=fresh(0,0);P.shoot(b,0,power,P.modes.draw);assert(b.vx>=P.powerSpeed(power)*.919,'draw must retain launch pace')}
const near=measure(60,.4),medium=measure(110,.7),long=measure(160,1)
assert(near.hit&&near.min<-1);assert(medium.hit&&medium.min<-1);assert(long.hit&&long.min<-1)
assert(measure(60,1).min<measure(60,.7).min);assert(measure(60,.7).min<near.min)
assert(measure(60,.7,-1).min<measure(60,.7,-.3).min)
assert(measure(60,.7,-.85,-.4).min<-.8);assert(measure(60,.7,-.85,.4).min<-.8)
const slow=measure(160,.04);assert(!slow.hit,'a very weak draw still cannot travel indefinitely')
for(const power of [.1,.4,1]){const b=fresh(0,0,0);P.shoot(b,0,power,P.modes.draw);for(let i=0;i<10000&&P.moving([b]);i++){P.friction(b,.25);assert(b.vx>=-1e-8,'without impact draw should transition forward to natural roll')}}
console.log('PASS: launch-speed calibration; short/medium/long draw; monotonic power/depth; combined side spin; no pre-impact reversal; natural long-distance loss')

// The approach should retain pace; real contact ends the assist in both solvers.
{
 const bs=[fresh(0,30),fresh(1,140)];P.shoot(bs[0],0,.7,P.modes.draw);const initial=bs[0].vx;let contact=false
 while(bs[0].x<80){P.step(bs,.25);assert(bs[0].vx>0);assert(bs[0].drawApproach)}
 assert(bs[0].vx>initial*.94,'draw approach should not visibly brake in the first 50 units')
 while(!contact)P.step(bs,.25,null,e=>{if(e.type==='contact')contact=true})
 assert.equal(bs[0].drawApproach,false,'full cloth coupling starts at object contact')
}
{
 const bs=P.rack(false);P.shoot(bs[0],0,.7,P.modes.draw);let touched=false
 for(let i=0;i<1500&&!touched;i++)P.step(bs,.25,null,e=>{if(e.type==='contact'&&(e.a===0||e.b===0))touched=true})
 assert(touched);assert.equal(bs[0].drawApproach,false,'dense rack contact must also end approach assist')
}
{
 const bs=[fresh(0,348,70)];P.shoot(bs[0],0,.7,P.modes.draw);for(let i=0;i<20;i++)P.step(bs,.25);assert.equal(bs[0].drawApproach,false,'cushion contact ends approach assist')
}
// A thin cut retains its tangential motion instead of being forced backwards.
{
 const bs=[fresh(0,90,80),fresh(1,140,89.5)];P.shoot(bs[0],0,.7,P.modes.draw);let hit=false,v=null
 for(let i=0;i<800&&!hit;i++)P.step(bs,.25,null,e=>{if(e.type==='contact'){hit=true;v={x:bs[0].vx,y:bs[0].vy}}})
 assert(hit&&v.x>1&&Math.abs(v.y)>1)
}
console.log('PASS: approach pace, contact-triggered friction, dense solver and cushion flags, natural thin-cut direction')
