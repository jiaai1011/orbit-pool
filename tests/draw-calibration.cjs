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
const slow=measure(110,.4);assert(slow.min>-.1,'slow distant draw can wear into stun/follow')
for(const power of [.1,.4,1]){const b=fresh(0,0,0);P.shoot(b,0,power,P.modes.draw);for(let i=0;i<10000&&P.moving([b]);i++){P.friction(b,.25);assert(b.vx>=-1e-8,'without impact draw should transition forward to natural roll')}}
console.log('PASS: launch-speed calibration; short/medium/long draw; monotonic power/depth; combined side spin; no pre-impact reversal; natural long-distance loss')
