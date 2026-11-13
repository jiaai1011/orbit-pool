(()=>{
'use strict';
const factories={},cache={};
factories['physics']=function(module,exports,require){
const W=360,H=184,R=5.5,HEAD_LINE=W/4
const pockets=[[0,0],[W/2,-2],[W,0],[0,H],[W/2,H+2],[W,H]]
// Shared geometry: the renderer and both solvers use the same open mouths.
const POCKET_R=12.5,CORNER_OPEN=18,SIDE_OPEN=17
const cushions=[]
for(const y of [0,H])for(const [a,b] of [[CORNER_OPEN,W/2-SIDE_OPEN],[W/2+SIDE_OPEN,W-CORNER_OPEN]])cushions.push({x1:a,y1:y,x2:b,y2:y,nx:0,ny:y?-1:1})
for(const x of [0,W])cushions.push({x1:x,y1:CORNER_OPEN,x2:x,y2:H-CORNER_OPEN,nx:x?-1:1,ny:0})
const jaws=cushions.flatMap(s=>[[s.x1,s.y1],[s.x2,s.y2]])
function pocketAt(b){
  if(b.z>=2)return -1
  for(let k=0;k<pockets.length;k++){const dx=b.x-pockets[k][0],dy=b.y-pockets[k][1];if(dx*dx+dy*dy<=POCKET_R*POCKET_R)return k}
  return -1
}
function sink(b,k,pots,onEvent){b.dead=true;b.vx=b.vy=b.rx=b.ry=b.wz=b.z=b.vz=0;pots.push(b.n);if(onEvent)onEvent({type:'pocket',n:b.n,pocket:k})}
function nearEdge(b,travel=0){return b.x<R+travel||b.x>W-R-travel||b.y<R+travel||b.y>H-R-travel}
function cushionEvents(b,limit,consider){
  const travel=(Math.abs(b.vx)+Math.abs(b.vy))*limit
  if(!nearEdge(b,travel))return
  // Airborne balls still meet the raised pocket housing; a jump must not escape
  // the playfield through a ground-level opening and become unplayable.
  if(b.z>0||b.vz){
    const airRail=(distance,v,nx,ny)=>{
      if(v>=-1e-8)return
      const t=Math.max(0,(R-distance)/v)
      if(t<=limit&&b.z+(b.vz||0)*t-.07*t*t>=2)consider(t,{type:'rail',b,nx,ny})
    }
    airRail(b.x,b.vx,1,0);airRail(W-b.x,-b.vx,-1,0)
    airRail(b.y,b.vy,0,1);airRail(H-b.y,-b.vy,0,-1)
  }
  for(const s of cushions){
    const vn=b.vx*s.nx+b.vy*s.ny;if(vn>=-1e-8)continue
    const dist=(b.x-s.x1)*s.nx+(b.y-s.y1)*s.ny
    const t=Math.max(0,(R-dist)/vn);if(t>limit)continue
    const x=b.x+b.vx*t,y=b.y+b.vy*t
    if((s.nx?y>=s.y1&&y<=s.y2:x>=s.x1&&x<=s.x2))consider(t,{type:'rail',b,nx:s.nx,ny:s.ny})
  }
  for(const [x,y] of jaws){
    const t=entryTime(b.x-x,b.y-y,b.vx,b.vy,R,limit)
    if(t<=limit){const dx=b.x+b.vx*t-x,dy=b.y+b.vy*t-y,d=Math.hypot(dx,dy);consider(t,{type:'rail',b,nx:dx/d,ny:dy/d})}
  }
}
function edgeOverlap(b,onContact,onEvent){
  // Tiny compliant-solver steps use the same finite segments with round ends.
  if(!nearEdge(b))return
  if(b.z>=2){
    const nx=b.x<R?1:b.x>W-R?-1:0,ny=b.y<R?1:b.y>H-R?-1:0
    for(const [x,y] of [[nx,0],[0,ny]])if(x||y){
      const speed=rail(b,x,y)
      if(speed>1e-7&&onEvent)onEvent({type:'rail',n:b.n,x:b.x,y:b.y,speed})
      if(speed>.3&&onContact)onContact(b.x,b.y,speed*.5)
    }
    b.x=Math.max(R,Math.min(W-R,b.x));b.y=Math.max(R,Math.min(H-R,b.y));return
  }
  for(const s of cushions){
    const x=Math.max(s.x1,Math.min(s.x2,b.x)),y=Math.max(s.y1,Math.min(s.y2,b.y)),dx=b.x-x,dy=b.y-y,d2=dx*dx+dy*dy
    if(d2>=R*R||d2<1e-12)continue
    const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,speed=rail(b,nx,ny)
    b.x+=nx*(R-d+1e-7);b.y+=ny*(R-d+1e-7)
    if(speed>1e-7&&onEvent)onEvent({type:'rail',n:b.n,x:b.x,y:b.y,speed})
    if(speed>.3&&onContact)onContact(b.x,b.y,speed*.5)
  }
}
const modes={
  normal:{name:'中杆',top:0,side:0,lift:0,bend:0},
  follow:{name:'高杆',top:1,side:0,lift:0,bend:0},
  draw:{name:'低杆',top:-1,side:0,lift:0,bend:0},
  left:{name:'左塞',top:0,side:-1,lift:0,bend:0},
  right:{name:'右塞',top:0,side:1,lift:0,bend:0},
  masse:{name:'扎杆',top:0,side:0,lift:0,bend:1},
  jump:{name:'跳杆',top:0,side:0,lift:1,bend:0}
}
function ball(n,x,y){return {n,x,y,vx:0,vy:0,z:0,vz:0,dead:false,side:0,rx:0,ry:0,top:0,bend:0,age:0}}
function rack(practice){
  const balls=[ball(0,87,H/2)]
  if(practice)return balls.concat([ball(1,242,44),ball(3,255,92),ball(8,224,137),ball(11,301,118)])
  const order=[1,10,2,12,8,3,4,14,5,13,9,6,15,7,11]
  let i=0
  for(let c=0;c<5;c++)for(let j=0;j<=c;j++)balls.push(ball(order[i++],239+c*9.56,H/2+(j-c/2)*11.04))
  return balls
}
// World units per 1/60 second. Constant cloth friction separates sliding/rolling.
const SLIDE=.14,ROLL=.022,BALL_RESTITUTION=.96,RAIL_RESTITUTION=.82
const FREE_RUN_MAX=1050
// Centre-ball free-run distance is K*v²: slide to 5v/7, then roll to rest.
const RUN_FACTOR=12/(49*SLIDE)+25/(98*ROLL)
function powerSpeed(p){return Math.sqrt(FREE_RUN_MAX*Math.max(0,Math.min(1,p))/RUN_FACTOR)}
function shoot(b,a,p,m,flip=1){
  const power=Math.max(0,Math.min(1,p)),top=Math.max(-1,Math.min(1,m.top||0))*1.8,side=Math.max(-1,Math.min(1,m.side||0))*1.2
  // Off-centre strikes divide a fixed energy budget into translation and rotation.
  const v=powerSpeed(power)*(m.breakShot?1+.8*power*power:1)/Math.sqrt(1+.4*(top*top+side*side))*(m.lift?.85:1)
  b.vx=Math.cos(a)*v;b.vy=Math.sin(a)*v;b.ax=Math.cos(a);b.ay=Math.sin(a)
  b.rx=b.ax*v*top;b.ry=b.ay*v*top;b.wz=side*v
  b.side=m.side||0;b.bend=(m.bend||0)*flip;b.age=0;b.z=0
  b.vz=m.lift&&power>0?1.8+power*.3:0
}
function friction(b,dt){
  if(b.dead||b.z>0)return
  b.rx=b.rx||0;b.ry=b.ry||0;b.wz=b.wz||0
  const dx=b.vx-b.rx,dy=b.vy-b.ry,slip=Math.hypot(dx,dy)
  let left=dt
  if(slip>1e-8){
    const sliding=Math.min(dt,slip/(3.5*SLIDE)),j=SLIDE*sliding,x=dx/slip*j,y=dy/slip*j
    b.vx-=x;b.vy-=y;b.rx+=2.5*x;b.ry+=2.5*y;left-=sliding
  }
  if(left>1e-9){
    const v=Math.hypot(b.vx,b.vy),next=Math.max(0,v-ROLL*left),f=v?next/v:0
    b.vx*=f;b.vy*=f;b.rx=b.vx;b.ry=b.vy
  }
  b.wz*=Math.exp(-.006*dt)
  if(Math.hypot(b.vx,b.vy)<.006&&Math.hypot(b.rx,b.ry)<.006)b.vx=b.vy=b.rx=b.ry=0
}
function advance(bs,t){
  for(const b of bs){
    if(b.dead)continue
    b.x+=b.vx*t;b.y+=b.vy*t
    if(b.z>0||b.vz){b.z+=b.vz*t-.07*t*t;b.vz-=.14*t;if(b.z<=0){b.z=b.vz=0}}
  }
}
// Earliest entry into a circle along a relative-velocity ray.
function entryTime(x,y,vx,vy,r,limit){
  const c=x*x+y*y-r*r,dot=x*vx+y*vy,speed=vx*vx+vy*vy
  if(c<=1e-7)return dot< -1e-8?0:Infinity
  if(dot>=0||speed<1e-12)return Infinity
  const disc=dot*dot-speed*c;if(disc<0)return Infinity
  const t=(-dot-Math.sqrt(disc))/speed
  return t>=-1e-9&&t<=limit+1e-9?Math.max(0,t):Infinity
}
function rail(b,nx,ny){
  const vn=b.vx*nx+b.vy*ny;if(vn>=0)return 0
  const speed=-vn,tx=ny,ty=-nx,jn=-(1+RAIL_RESTITUTION)*vn
  b.vx+=jn*nx;b.vy+=jn*ny
  // Effective rolling-spin reflection: preserves the slip ratio, cannot add energy.
  const rn=(b.rx||0)*nx+(b.ry||0)*ny
  b.rx=(b.rx||0)-(1+RAIL_RESTITUTION)*rn*nx
  b.ry=(b.ry||0)-(1+RAIL_RESTITUTION)*rn*ny
  const slip=b.vx*tx+b.vy*ty-(b.wz||0),j=Math.max(-.14*jn,Math.min(.14*jn,-slip/3.5))
  b.vx+=j*tx;b.vy+=j*ty;b.wz=(b.wz||0)-2.5*j
  b.side*=.65
  return speed
}
function collideBatch(bs,onContact,onEvent){
  const contacts=[]
  for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){
    const a=bs[i],b=bs[j];if(a.dead||b.dead||Math.abs(a.z-b.z)>=9)continue
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)
    if(d>2*R+1e-5)continue
    const nx=d?dx/d:1,ny=d?dy/d:0,v=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny
    if(v< -1e-8)continue
    contacts.push({a,b,nx,ny,v,impulse:0,d})
  }
  // Coupled simultaneous contacts (e.g. the two faces of a tight rack).
  // Solving from the same pre-impact velocities avoids array-order bias.
  const A=contacts.map(x=>contacts.map(y=>{
    let sign=0;if(x.a===y.a)sign++;if(x.a===y.b)sign--;if(x.b===y.a)sign--;if(x.b===y.b)sign++
    return sign*(x.nx*y.nx+x.ny*y.ny)
  }))
  for(let pass=0;pass<48;pass++){
    let error=0
    for(let i=0;i<contacts.length;i++){
      const q=contacts[i];let response=0
      for(let j=0;j<contacts.length;j++)response+=A[i][j]*contacts[j].impulse
      const next=Math.max(0,q.impulse+((1+BALL_RESTITUTION)*q.v-response)/2)
      error=Math.max(error,Math.abs(next-q.impulse));q.impulse=next
    }
    if(error<1e-10)break
  }
  for(const q of contacts){
    const {a,b,nx,ny,impulse:j,v}=q
    a.vx-=j*nx;a.vy-=j*ny;b.vx+=j*nx;b.vy+=j*ny
    const sep=(Math.max(0,2*R-q.d)+1e-7)*.5
    a.x-=nx*sep;a.y-=ny*sep;b.x+=nx*sep;b.y+=ny*sep
    if(j>1e-8){
      if(onEvent)onEvent({type:'contact',a:a.n,b:b.n,x:(a.x+b.x)/2,y:(a.y+b.y)/2,speed:v})
      if(onContact)onContact((a.x+b.x)/2,(a.y+b.y)/2,v)
    }
  }
}
function denseContact(bs){
  for(const a of bs){
    if(a.dead||a.vx*a.vx+a.vy*a.vy<.0009)continue
    let neighbours=0
    for(const b of bs){if(a===b||b.dead||Math.abs(a.z-b.z)>=9)continue;const dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy;if(d2<(2*R-1e-5)**2)return true;if(d2<(2*R+.25)**2&&++neighbours>=2)return true}
  }
  return false
}
function softContacts(bs,dt,onContact,onEvent,pots){
  // Stable finite-contact integration. Reuse typed buffers and reject distant
  // pairs by squared distance; no per-substep arrays, strings or square roots.
  const count=Math.max(1,Math.ceil(dt/.004)),h=dt/count,n=bs.length
  const dxs=new Float64Array(n),dys=new Float64Array(n),reported=new Uint8Array(n*n)
  for(let tick=0;tick<count;tick++){
    advance(bs,h);dxs.fill(0);dys.fill(0)
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      const a=bs[i],b=bs[j];if(a.dead||b.dead||Math.abs(a.z-b.z)>=9)continue
      const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;if(d2>=4*R*R)continue
      const d=Math.sqrt(d2),nx=d?dx/d:1,ny=d?dy/d:0,v=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny
      const impulse=Math.max(0,3000*(2*R-d)+v)*h
      dxs[i]-=impulse*nx;dys[i]-=impulse*ny;dxs[j]+=impulse*nx;dys[j]+=impulse*ny
      const key=i*n+j
      if(v>1e-5&&!reported[key]){
        reported[key]=1
        if(onEvent)onEvent({type:'contact',a:a.n,b:b.n,x:(a.x+b.x)/2,y:(a.y+b.y)/2,speed:v})
        if(onContact)onContact((a.x+b.x)/2,(a.y+b.y)/2,v)
      }
    }
    for(let i=0;i<n;i++){
      const b=bs[i];if(b.dead)continue
      b.vx+=dxs[i];b.vy+=dys[i]
      if(!nearEdge(b,POCKET_R))continue
      const pocket=pocketAt(b)
      if(pocket>=0){sink(b,pocket,pots,onEvent);continue}
      edgeOverlap(b,onContact,onEvent)
    }
  }
}
function step(balls,dt,onContact,onEvent){
  const pots=[],bs=balls.filter(b=>!b.dead).sort((a,b)=>a.n-b.n)
  for(const b of bs){
    b.age=(b.age||0)+dt
    if(b.bend&&b.age<68){const a=b.bend*.023*dt*(1-b.age/68),cos=Math.cos(a),sin=Math.sin(a),x=b.vx,rx=b.rx||0;b.vx=x*cos-b.vy*sin;b.vy=x*sin+b.vy*cos;b.rx=rx*cos-(b.ry||0)*sin;b.ry=rx*sin+(b.ry||0)*cos}
    friction(b,dt/2)
  }
  let left=dt,iterations=0
  while(left>1e-9&&iterations++<96){
    if(denseContact(bs)){softContacts(bs,left,onContact,onEvent,pots);left=0;break}
    let soon=left,event=null
    const consider=(t,e)=>{if(Number.isFinite(t)&&t<=soon+1e-10){if(!event||t<soon-1e-10){soon=t;event=e}}}
    for(let i=0;i<bs.length;i++){
      const b=bs[i];if(b.dead)continue
      for(let k=0;k<pockets.length;k++){
        const p=pockets[k],t=entryTime(b.x-p[0],b.y-p[1],b.vx,b.vy,POCKET_R,left)
        const z=b.z+(b.vz||0)*t-.07*t*t
        if(b.z<2&&(b.x-p[0])**2+(b.y-p[1])**2<=POCKET_R*POCKET_R)consider(0,{type:'pocket',b,pocket:k})
        else if(t<=left&&z<2)consider(t,{type:'pocket',b,pocket:k})
      }
      cushionEvents(b,left,consider)
      for(let j=i+1;j<bs.length;j++){
        const q=bs[j];if(q.dead)continue
        const t=entryTime(q.x-b.x,q.y-b.y,q.vx-b.vx,q.vy-b.vy,2*R,left)
        // Elevated jump shots clear the collision plane; height remains a game approximation.
        if(t<=left&&Math.abs((b.z+(b.vz||0)*t)-(q.z+(q.vz||0)*t))<9)consider(t,{type:'contact',a:b,b:q})
      }
    }
    advance(bs,soon);left-=soon
    if(!event)break
    if(event.type==='pocket'){
      sink(event.b,event.pocket,pots,onEvent)
    }else if(event.type==='rail'){
      const b=event.b,speed=rail(b,event.nx,event.ny)
      b.x+=event.nx*1e-7;b.y+=event.ny*1e-7
      if(onEvent&&speed>1e-7)onEvent({type:'rail',n:b.n,x:b.x,y:b.y,speed})
      if(onContact&&speed>.3)onContact(b.x,b.y,speed*.5)
    }else{
      const clustered=bs.some(q=>q!==event.a&&q!==event.b&&!q.dead&&(Math.hypot(q.x-event.a.x,q.y-event.a.y)<2*R+.25||Math.hypot(q.x-event.b.x,q.y-event.b.y)<2*R+.25))
      if(clustered&&left>1e-9){softContacts(bs,left,onContact,onEvent,pots);left=0}
      else collideBatch(bs,onContact,onEvent)
    }
  }
  // Cap is only a degeneracy safeguard; never discard elapsed simulation time.
  if(left>1e-9)advance(bs,left)
  for(const b of bs)friction(b,dt/2)
  return pots
}
function moving(bs){return bs.some(b=>!b.dead&&(Math.hypot(b.vx,b.vy)>.001||b.z||b.vz||Math.hypot(b.rx||0,b.ry||0)>.1))}
function replace(bs){
  for(let x=87;x<W-15;x+=12)for(let y of [H/2,48,135,72,112]){
    if(bs.slice(1).every(b=>b.dead||Math.hypot(b.x-x,b.y-y)>2*R+1)){
      bs[0]=ball(0,x,y);return
    }
  }
}
function spot(bs,n){
  const b=bs.find(t=>t.n===n)
  for(let i=0;i<720;i++){
    const x=239+(i%2===0?1:-1)*Math.ceil(i/2)*.5,y=H/2
    if(x<R+8||x>W-R-8)continue
    if(bs.every(t=>t===b||t.dead||Math.hypot(t.x-x,t.y-y)>2*R+.2)){Object.assign(b,ball(n,x,y));return true}
  }
  for(let x=20;x<W-15;x+=12)for(let y=20;y<H-15;y+=12)if(bs.every(t=>t===b||t.dead||Math.hypot(t.x-x,t.y-y)>2*R+.2)){Object.assign(b,ball(n,x,y));return true}
  return false
}
function guide(bs,a){
  const b=bs[0],dx=Math.cos(a),dy=Math.sin(a)
  let t=Math.min(dx>0?(W-R-b.x)/dx:dx<0?(R-b.x)/dx:Infinity,dy>0?(H-R-b.y)/dy:dy<0?(R-b.y)/dy:Infinity),hit
  for(const q of bs.slice(1)){
    if(q.dead)continue
    const x=q.x-b.x,y=q.y-b.y,s=x*dx+y*dy,h=x*dy-y*dx
    if(s<=0||Math.abs(h)>=2*R)continue
    const n=s-Math.sqrt(4*R*R-h*h)
    if(n>=0&&n<t){t=n;hit=q}
  }
  return {x:b.x+dx*t,y:b.y+dy*t,hit}
}
function predict(balls,angle,power,mode){
  const first=guide(balls,angle),target=first.hit
  // A compact first-collision preview. Dense racks only show their contact guide.
  if(mode.breakShot)return null
  const original=[balls[0],...(target?[target]:[])],bs=original.map(b=>({...b})),cuePath=[],objectPath=[]
  shoot(bs[0],angle,power,mode)
  let hit=false,after=0,blockedCue=false,blockedObject=false
  const obstacle=b=>balls.some(q=>!q.dead&&!original.includes(q)&&Math.hypot(q.x-b.x,q.y-b.y)<2*R+.1)
  for(let i=0;i<900;i++){
    step(bs,.25,null,e=>{if(e.type==='contact'&&!hit){hit=true;cuePath.push({x:bs[0].x,y:bs[0].y,z:bs[0].z,after:true})}})
    if(i%3===0){
      const b=bs[0];if(obstacle(b))blockedCue=true
      if(!blockedCue&&!b.dead)cuePath.push({x:b.x,y:b.y,z:b.z,after:hit})
      if(hit&&bs[1]){const q=bs[1];if(obstacle(q))blockedObject=true;if(!blockedObject&&!q.dead)objectPath.push({x:q.x,y:q.y,z:q.z})}
    }
    if(hit&&++after>=144||!moving(bs)||bs[0].dead)break
  }
  return {cuePath,objectPath,hit,power:Math.round(power*100),special:!!(mode.lift||mode.bend)}
}
module.exports={W,H,R,HEAD_LINE,POCKET_R,CORNER_OPEN,SIDE_OPEN,cushions,pockets,modes,rack,powerSpeed,friction,shoot,step,moving,replace,spot,guide,predict}

};
factories['rules']=function(module,exports,require){
// Local casual eight-ball: no call-shot on colours, called pocket on the eight.
const group=n=>n>=1&&n<=7?'solid':n>=9&&n<=15?'stripe':null
const label=g=>g==='solid'?'全色':g==='stripe'?'双色':'未分组'
const remaining=(balls,g)=>balls.filter(b=>!b.dead&&group(b.n)===g).map(b=>b.n)
function create(){return {turn:0,groups:[null,null],breaking:true,winner:null,reason:'',history:[],fouls:[0,0]}}
function start(state,balls,pocket){return {player:state.turn,breaking:state.breaking,eligible:!!state.groups[state.turn]&&!remaining(balls,state.groups[state.turn]).length,first:null,railAfter:false,rails:[],pots:[],calledPocket:pocket}}
function record(shot,e){
 if(e.type==='contact'&&(e.a===0||e.b===0)&&shot.first===null)shot.first=e.a===0?e.b:e.a
 if(e.type==='rail'&&shot.first!==null){shot.railAfter=true;if(e.n!==0&&!shot.rails.includes(e.n))shot.rails.push(e.n)}
 if(e.type==='pocket')shot.pots.push({n:e.n,pocket:e.pocket})
}
function resolve(s,shot){
 const player=shot.player,other=1-player,nums=shot.pots.map(p=>p.n),black=shot.pots.find(p=>p.n===8),own=s.groups[player]
 let foul=nums.includes(0)?'白球落袋':shot.first===null?'未碰到目标球':''
 if(!foul&&!shot.breaking){
  if(shot.eligible?shot.first!==8:own?group(shot.first)!==own:shot.first===8)foul=shot.eligible?'首碰不是黑八':own?'先碰到非本组球':'开放球台先碰黑八'
  else if(!nums.some(n=>n!==0)&&!shot.railAfter)foul='碰球后无进球、无球碰库'
 }
 if(!foul&&shot.breaking&&!nums.some(n=>n!==0)&&shot.rails.length<4)foul='开球不足四颗目标球碰库'
 s.breaking=false
 let result={foul,ballInHand:!!foul,respotEight:!!black&&shot.breaking,retain:false}
 if(black&&!shot.breaking){
  const reason=!shot.eligible?'本组未清完，提前打进黑八':foul?'黑八进袋同时犯规：'+foul:shot.calledPocket!==black.pocket?'黑八未进指定袋口':''
  s.winner=reason?other:player;s.reason=reason||'合法打进指定袋口的黑八';result.ballInHand=false
 }else if(foul){s.turn=other;s.fouls[player]++}
 else{
  if(!shot.breaking&&!own){const first=nums.find(n=>group(n));if(first){s.groups[player]=group(first);s.groups[other]=group(first)==='solid'?'stripe':'solid'}}
  result.retain=nums.some(n=>n!==0&&(shot.breaking||group(n)===s.groups[player]))
  if(!result.retain)s.turn=other
 }
 result.message=s.winner!==null?'玩家 '+(s.winner+1)+' 获胜 · '+s.reason:foul?'玩家 '+(player+1)+' 犯规：'+foul+' · 对手自由球':result.retain?'合法进球 · 玩家 '+(player+1)+' 继续':'交换球权 · 玩家 '+(s.turn+1)+' 击球'
 s.history.unshift(result.message);s.history=s.history.slice(0,5)
 return result
}
module.exports={group,label,remaining,create,start,record,resolve}

};
factories['audio']=function(module,exports,require){
// A small preloaded voice pool prevents one impact from cutting off another.
const banks={cue:['cue','cue'],hit:['hit1','hit2','hit3'],rail:['rail','rail'],pocket:['pocket','pocket']}
const gap={cue:0,hit:22,rail:42,pocket:60}
function create(makeContext,clock=()=>Date.now()){
 const channels={},next={},last={};let destroyed=false
 for(const kind of Object.keys(banks)){
  channels[kind]=[];next[kind]=0;last[kind]=-Infinity
  for(const file of banks[kind]){
   try{const voice=makeContext();voice.src='/assets/'+file+'.wav';voice.obeyMuteSwitch=false;voice.loop=false;channels[kind].push({voice,busyUntil:0})}catch(e){}
  }
 }
 return {
  play(kind,strength=1){
   if(destroyed||!channels[kind]||!channels[kind].length)return
   const now=clock(),pool=channels[kind]
   if(now-last[kind]<gap[kind]||strength<.018)return
   let slot=-1
   for(let i=0;i<pool.length;i++){const n=(next[kind]+i)%pool.length;if(pool[n].busyUntil<=now){slot=n;break}}
   // Never restart an active voice; dense break impacts are naturally bounded.
   if(slot<0)return
   const item=pool[slot];next[kind]=(slot+1)%pool.length;last[kind]=now
   item.busyUntil=now+(kind==='pocket'?440:kind==='hit'?200:180)
   try{item.voice.volume=Math.min(.85,Math.pow(Math.min(1,strength),.65)*.80);item.voice.seek(0);item.voice.play()}catch(e){item.busyUntil=0}
  },
  stop(){for(const pool of Object.values(channels))for(const item of pool){try{item.voice.stop()}catch(e){}item.busyUntil=0}for(const kind of Object.keys(last))last[kind]=-Infinity},
  destroy(){if(destroyed)return;this.stop();destroyed=true;for(const pool of Object.values(channels))for(const item of pool)try{item.voice.destroy()}catch(e){}}
 }
}
module.exports={create}

};
factories['render']=function(module,exports,require){
const P=require('physics')
const renderCaches=new WeakMap()
const Rules=require('rules')
const cueColors=['#55edff','#bd8aff','#ffbe58']
const cueNames=['极光 · 磁轨 MK–I','幻影 · 双翼 MK–II','曜金 · 重装 MK–III']
const colors=['#fff9df','#ffc52f','#347cf0','#ec4f4b','#9953d7','#ef8b27','#2ba687','#9b364a','#141822']
function rr(c,x,y,w,h,r,fill,stroke){
 r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()
 if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.stroke()}
}
function poly(c,points,fill,stroke){
 c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath()
 if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.stroke()}
}
function panel(c,x,y,w,h,cut,fill,stroke){poly(c,[[x+cut,y],[x+w-cut,y],[x+w,y+cut],[x+w,y+h-cut],[x+w-cut,y+h],[x+cut,y+h],[x,y+h-cut],[x,y+cut]],fill,stroke)}
function glowLine(c,x,y,X,Y,color,width=1){c.save();c.shadowColor=color;c.shadowBlur=6;line(c,x,y,X,Y,color,width);c.restore()}
function circle(c,x,y,r,fill,stroke){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.stroke()}}
function text(c,t,x,y,size=12,col='#e9f2f3',align='left',weight=400){c.font=weight+' '+size+'px sans-serif';c.textAlign=align;c.textBaseline='middle';c.fillStyle=col;c.fillText(t,x,y)}
function line(c,x,y,X,Y,col,w=1){c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.strokeStyle=col;c.lineWidth=w;c.stroke();c.lineWidth=1}
function ball(c,b,r=P.R){
 const cache=renderCaches.get(c)
 if(cache&&cache.atlas&&r===P.R&&!b.z){
  const size=cache.spriteSize,pad=9
  c.drawImage(cache.atlas,b.n*size,0,size,size,b.x-pad,b.y-pad,pad*2,pad*2);return
 }
 ballRaw(c,b,r)
}
function ballRaw(c,b,r=P.R){
 const x=b.x,y=b.y-(b.z||0)*.5,n=b.n
 c.save()
 c.shadowColor='#001e26aa';c.shadowBlur=2;c.shadowOffsetY=1.5+(b.z||0)*.12
 circle(c,x,y,r,n>8?'#f8f3de':colors[n]);c.shadowColor='transparent';c.shadowOffsetY=0;c.shadowBlur=0
 c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.clip()
 if(n>8){c.fillStyle=colors[n-8];c.fillRect(x-r,y-r*.51,r*2,r*1.02)}
 const g=c.createRadialGradient(x-r*.35,y-r*.45,r*.05,x,y,r*1.15)
 g.addColorStop(0,'#ffffff70');g.addColorStop(.4,'#ffffff00');g.addColorStop(.8,'#0000001a');g.addColorStop(1,'#00000099')
 circle(c,x,y,r,g)
 if(n){circle(c,x,y,r*.43,'#fff7e3');text(c,String(n),x,y+.2,r*.59,'#20242a','center',700)}
 circle(c,x-r*.32,y-r*.48,r*.15,'#ffffffb0')
 c.restore()
}
function layout(w,h,insets={}){
 const safeL=insets.left||0,safeR=insets.right||0
 const left=62+safeL,right=62+safeR,top=57,bottom=56
 const s=Math.min((w-left-right)/400,(h-top-bottom)/224)
 const tx=(w-(P.W+40)*s)/2+20*s+(safeL-safeR)/2,ty=top+(h-top-bottom-224*s)/2+20*s
 return {w,h,s,tx,ty,left:tx-20*s,right:tx+380*s,top:ty-20*s,bottom:ty+204*s,
 power:{x:Math.max(12,safeL+6),y:top+14,w:42,h:h-top-bottom-28},
 fine:{x:w-safeR-49,y:top+14,w:36,h:h-top-bottom-28}}
}
function button(c,g,id,label,x,y,w,h,active=false){
 rr(c,x,y,w,h,8,active?'#bdebcf':'#172634',active?'#c8ffdf':'#2b4050')
 text(c,label,x+w/2,y+h/2,11,active?'#133e36':'#cfdee4','center',600)
 g.hits.push({id,x,y,w,h})
}
function tableBase(c,g,L){
 const {tx,ty,s}=L
 c.save();c.translate(tx,ty);c.scale(s,s)
 const accent=g.match&&g.match.turn===1?'#bc8aff':'#5ae5ff',charge=g.power/100
 // A layered, cut-corner chassis, with visibly separated armour and light channels.
 c.save();c.shadowColor='#26beff55';c.shadowBlur=22+charge*10;c.shadowOffsetY=7
 panel(c,-23,-22,406,228,22,'#050b16',accent+'90');c.restore()
 panel(c,-21,-18,402,226,20,'#030916','#22445a')
 const metal=c.createLinearGradient(0,-22,0,207)
 metal.addColorStop(0,'#547084');metal.addColorStop(.09,'#263e52');metal.addColorStop(.2,'#101d2c');metal.addColorStop(.83,'#15263a');metal.addColorStop(1,'#3a536b')
 panel(c,-21,-21,402,226,20,metal,'#7399b2')
 panel(c,-17,-17,394,218,17,'#081422','#33546b')
 // Cantilevered side pods and cooling fins form a new silhouette.
 for(const side of [0,1]){
  c.save();if(side){c.translate(360,0);c.scale(-1,1)}
  poly(c,[[-24,30],[-17,22],[-12,34],[-12,150],[-17,162],[-24,154]],'#182b40','#4b6b82')
  glowLine(c,-22,43,-22,141,accent,1.7)
  for(let i=0;i<9;i++)line(c,-19,57+i*8,-14,53+i*8,'#030b16',2)
  panel(c,-23,82,8,20,3,'#06101c',accent+'80');circle(c,-19,92,1.5,accent)
  c.restore()
 }
 for(const yy of [-21,190])for(const [a,b] of [[17,167],[193,343]]){
  panel(c,a,yy,b-a,15,5,'#172c40','#527389')
  for(let x=a+9;x<b-8;x+=8)line(c,x,yy+3,x+5,yy+8,'#6b91a525',.5)
  glowLine(c,a+8,yy+(yy<0?2:13),b-8,yy+(yy<0?2:13),accent,1.5)

 }
 for(const x of [0,360])for(const y of [0,184]){
  c.save();c.translate(x,y);if(x)c.scale(-1,1);if(y)c.scale(1,-1)
  poly(c,[[-21,0],[0,-21],[15,-21],[15,-15],[-15,15],[-21,15]],'#314b61','#7193a6')
  glowLine(c,-17,-1,-1,-17,accent,2)
  for(let k=0;k<3;k++)line(c,-14+k*4,5-k*4,-10+k*4,9-k*4,'#050c18',1.4)
  c.restore()
 }
 panel(c,-9,-9,378,202,8,'#0a3649','#3c7b94')
 const felt=c.createRadialGradient(180,55,10,180,92,220)
 felt.addColorStop(0,'#15516c');felt.addColorStop(.6,'#0b3a54');felt.addColorStop(1,'#06283f')
 c.fillStyle=felt;c.fillRect(0,0,P.W,P.H)
 c.save();c.beginPath();c.rect(0,0,P.W,P.H);c.clip()
 for(let y=1;y<P.H;y+=4)line(c,0,y,P.W,y,'#b3e7ff06',.35)
 for(let x=1;x<P.W;x+=4)line(c,x,0,x,P.H,'#00132815',.4)
 // Quiet holographic markings; ball paths stay unobstructed.
 circle(c,180,92,52,null,'#79d4ff0c');circle(c,180,92,57,null,'#79d4ff09')
 for(let k=0;k<12;k++){const a=k*Math.PI/6;line(c,180+Math.cos(a)*53,92+Math.sin(a)*53,180+Math.cos(a)*56,92+Math.sin(a)*56,'#9deaff18',.5)}
 text(c,'O R B I T',180,85,18,'#c2edff13','center',700)
 text(c,'一 杆 入 袋   /   0 8',180,102,5.8,'#c4f2ff27','center',600)
 line(c,P.HEAD_LINE,13,P.HEAD_LINE,171,'#c2e9ff18',.6)
 for(const x of [87,239]){line(c,x-3,92,x+3,92,'#a8e9ff60',.5);line(c,x,89,x,95,'#a8e9ff60',.5)}
 c.restore()
 for(const [a,b] of [[P.CORNER_OPEN,180-P.SIDE_OPEN],[180+P.SIDE_OPEN,360-P.CORNER_OPEN]]){
  poly(c,[[a-3,-8],[b+3,-8],[b,0],[a,0]],'#18445b')
  poly(c,[[a,184],[b,184],[b+3,192],[a-3,192]],'#0a263a')
  line(c,a,.4,b,.4,'#70d7e775',.65);line(c,a,183.5,b,183.5,'#335e76',.8)
 }
 c.fillStyle='#10364a';c.fillRect(-8,P.CORNER_OPEN,8,P.H-2*P.CORNER_OPEN);c.fillRect(360,P.CORNER_OPEN,8,P.H-2*P.CORNER_OPEN)
 for(let i=1;i<8;i++)if(i!==4){const x=i*45;for(const y of [-13,197]){poly(c,[[x-2.4,y],[x,y-1.7],[x+2.4,y],[x,y+1.7]],'#92d8ec');circle(c,x,y,.6,'#efffff')}}
 for(const x of [-12,372])for(const y of [46,92,138])circle(c,x,y,1.2,'#b1edff')
 // Mechanical pocket housings: octagonal shell, broken iris ring, dark leather well.
 for(const [x,y] of P.pockets){
  const points=[];for(let k=0;k<8;k++){const a=Math.PI/8+k*Math.PI/4;points.push([x+Math.cos(a)*(P.POCKET_R+3),y+Math.sin(a)*(P.POCKET_R+3)])}
  poly(c,points,'#1a3044','#6d97ac');circle(c,x,y,P.POCKET_R+1.5,'#030a13','#0b1f31')
  c.save();c.lineWidth=1.4
  for(let k=0;k<4;k++){const a=k*Math.PI/2+.15;c.beginPath();c.arc(x,y,P.POCKET_R+1.8,a,a+.95);c.strokeStyle=accent+'b0';c.stroke()}
  c.restore()
  const pocket=c.createRadialGradient(x,y-2,1,x,y,P.POCKET_R);pocket.addColorStop(0,'#000105');pocket.addColorStop(1,'#091728')
  circle(c,x,y,P.POCKET_R,pocket)
  line(c,x-3,y+7,x+3,y+7,'#264357',.6)
 }
 c.restore()
}
function table(c,g,L){
 const {tx,ty,s}=L
 c.save();c.translate(tx,ty);c.scale(s,s)
 const accent=g.match&&g.match.turn===1?'#bc8aff':'#5ae5ff'
 for(const yy of [-21,190])for(const [a,b] of [[17,167],[193,343]]){
  const pulse=(g.now*.035)%(b-a-25)
  line(c,a+8+pulse,yy+(yy<0?2:13),a+15+pulse,yy+(yy<0?2:13),'#e0ffff',1.4)
 }
 for(const e of g.impacts||[]){const t=(g.now-e.at)/360;if(t<0||t>1)continue;c.save();c.globalAlpha=(1-t)*e.strength;c.beginPath();c.rect(0,0,360,184);c.clip();circle(c,e.x,e.y,4+t*18,null,accent);c.restore()}
 if(g.ready&&!g.complete&&((g.match&&g.match.breaking)||(!g.match&&g.scenario==='practice'&&g.shots===0))){
  c.save();c.fillStyle=g.placing?'#73f7cf16':'#73f7cf08';c.fillRect(P.R+1,P.R+1,P.HEAD_LINE-P.R-1,P.H-2*(P.R+1))
  c.setLineDash([3,2]);line(c,P.HEAD_LINE,6,P.HEAD_LINE,P.H-6,'#8fffd2',.9);c.setLineDash([])
  text(c,'开球区',P.HEAD_LINE/2,24,8,'#b5fce2','center',600)
  text(c,'开球线',P.HEAD_LINE+4,14,6,'#b5fce2');c.restore()
 }
 if(g.ready&&!g.placing&&!g.complete)guides(c,g)
 if(g.match&&!g.match.breaking&&g.match.groups[g.match.turn]&&!Rules.remaining(g.balls,g.match.groups[g.match.turn]).length&&!g.complete){
  P.pockets.forEach(([x,y],i)=>{const active=g.calledPocket===i;c.lineWidth=active?2:1;circle(c,x,y,P.POCKET_R+4,null,active?'#ffda76':'#66d9f0');text(c,String(i+1),x,y,7,active?'#ffda76':'#b5e9f6','center',700)});c.lineWidth=1
 }
 for(const p of g.falls){
   const t=(g.now-p.at)/320
   if(t<1){c.save();c.globalAlpha=1-t;ball(c,{n:p.n,x:p.x,y:p.y},P.R*(1-t*.85));c.restore()}
 }
 for(const b of g.balls)if(!b.dead)ball(c,b)
 contactMarker(c,g)
 if(g.placing){
   const b=g.balls[0];c.setLineDash([2,2]);circle(c,b.x,b.y,10,null,g.placeValid?'#b3ffcd':'#ff9f87');c.setLineDash([])
 }
 if(g.ready&&!g.placing&&!g.complete||g.strikeUntil>g.now)cue(c,g)
 for(const e of g.effects){
   const t=(g.now-e.at)/650;if(t>1)continue
   c.save();c.globalAlpha=1-t;circle(c,e.x,e.y,7+t*15,null,'#c5ffe7');text(c,'+'+1,e.x,e.y-10-t*15,8,'#e7ffe7','center',700);c.restore()
 }
 c.restore()
}
function arrow(c,x,y,a,len,col){
 const X=x+Math.cos(a)*len,Y=y+Math.sin(a)*len
 line(c,x,y,X,Y,col,.9)
 line(c,X,Y,X-Math.cos(a-.5)*4,Y-Math.sin(a-.5)*4,col,.9)
 line(c,X,Y,X-Math.cos(a+.5)*4,Y-Math.sin(a+.5)*4,col,.9)
}
function traceLine(c,points,color,maxLength){
 if(points.length<2)return
 c.beginPath();let distance=0;c.moveTo(points[0].x,points[0].y-(points[0].z||0)*.5)
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],segment=Math.hypot(b.x-a.x,b.y-a.y),f=Math.min(1,(maxLength-distance)/(segment||1))
  c.lineTo(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f-((a.z||0)+((b.z||0)-(a.z||0))*f)*.5)
  distance+=segment;if(distance>=maxLength)break
 }
 c.strokeStyle=color;c.lineWidth=.8;c.stroke()
}
function guides(c,g){
 if(!g.assist||g.balls[0].dead)return
 const q=g.balls[0],v=P.guide(g.balls,g.angle),prediction=g.prediction
 c.save();c.setLineDash([3,3])
 if(prediction){
  const before=prediction.cuePath.filter(p=>!p.after),after=prediction.cuePath.filter(p=>p.after)
  traceLine(c,before,prediction.special?'#ffd29e':'#e4faffad',500);c.setLineDash([])
  if(after.length){circle(c,after[0].x,after[0].y,P.R,null,'#dff8ff85');traceLine(c,after,'#76dbffb0',55)}
  traceLine(c,prediction.objectPath,'#ffe1a5',90)
  if(!prediction.hit&&before.length){const end=before[before.length-1];circle(c,end.x,end.y,P.R,null,'#dff8ff70')}
 }else{
  line(c,q.x,q.y,v.x,v.y,'#ecfff9b0',.65);c.setLineDash([]);circle(c,v.x,v.y,P.R,null,'#f1ffffb0')
 }
 if(v.hit&&g.match&&!g.match.breaking){
  const b=v.hit,own=g.match.groups[g.match.turn],eight=own&&!Rules.remaining(g.balls,own).length,legal=eight?b.n===8:own?Rules.group(b.n)===own:b.n!==8
  if(!legal){circle(c,b.x,b.y,8,null,'#ff6c79');text(c,'首碰犯规',b.x,b.y-13,7,'#ffb5b9','center')}
 }
 c.restore()
}
function cueBody(c,style,power,now){
 const accent=cueColors[style],charge=power/100
 c.save();c.lineJoin='round'
 const metal=c.createLinearGradient(0,-5,0,5)
 metal.addColorStop(0,'#203e58');metal.addColorStop(.32,'#b8d2e1');metal.addColorStop(.5,'#3e5e75');metal.addColorStop(.72,'#14283b');metal.addColorStop(1,'#08111e')
 c.shadowColor='#000a';c.shadowBlur=3;c.shadowOffsetY=2
 // Slim playable shaft connects to a broad, split-frame energy chamber.
 poly(c,[[2,-1],[44,-2],[49,-3],[91,-4.5],[114,-4],[120,0],[114,4],[91,4.5],[49,3],[44,2],[2,1]],metal,'#779aae')
 c.shadowColor='transparent';c.shadowOffsetY=0
 poly(c,[[42,-3],[51,-5.5],[84,-5.5],[91,-2.8],[91,2.8],[84,5.5],[51,5.5],[42,3]],'#071220','#578197')
 const core=c.createLinearGradient(43,0,88,0);core.addColorStop(0,accent+'55');core.addColorStop(.55,accent);core.addColorStop(1,'#efffff')
 c.save();c.shadowColor=accent;c.shadowBlur=4+charge*7
 panel(c,46,-1.8,41,3.6,1.6,core)
 for(let i=0;i<6;i++){const x=49+i*6;line(c,x,-2.4,x+1.5,2.4,'#f2ffff80',.65)}
 c.restore()
 // Titanium upper/lower spars leave the reactor visible through the middle.
 for(const sign of [-1,1]){
  poly(c,[[42,sign*2.6],[51,sign*5.3],[83,sign*5.3],[91,sign*2.7],[82,sign*3.6],[52,sign*3.6]],metal,'#7591a4')
  glowLine(c,53,sign*4.5,79,sign*4.5,accent,.7)
 }
 if(style===1){
  for(const sign of [-1,1])poly(c,[[55,sign*4],[67,sign*9],[87,sign*7],[91,sign*3],[78,sign*4]],'#302746','#b995ff')
 }else if(style===2){
  for(const sign of [-1,1])for(let i=0;i<3;i++){const x=52+i*11;poly(c,[[x,sign*3.8],[x+3,sign*7.6],[x+12,sign*6],[x+8,sign*3.8]],'#4d3c25','#d6aa67')}
 }
 panel(c,92,-4,20,8,2,'#07121e','#6c8799')
 for(let i=0;i<6;i++)line(c,94+i*2.7,-3,96+i*2.7,3,'#6e90a455',.8)
 for(const x of [39,89,112]){c.fillStyle='#c4d9e4';c.fillRect(x,-(x===39?2.2:4.5),1.3,x===39?4.4:9)}
 poly(c,[[113,-4.5],[118,-4.5],[122,0],[118,4.5],[113,4.5]],'#163044',accent)
 circle(c,116.5,0,2.1,accent);circle(c,116.5,0,.8,'#f3ffff')
 line(c,9,-.55,35,-1.1,'#e0f2ff',.6);line(c,15,.7,36,1.2,accent,.5)
 c.fillStyle='#e3eff4';c.fillRect(2,-1.2,3,2.4);c.fillStyle='#b8dae6';c.fillRect(0,-1.3,2,2.6)
 // Charging pulse travels from the rear reactor toward the tip.
 if(power>.5){
  const t=((now||0)%550)/550,x=102-t*94
  c.save();c.globalAlpha=.3+charge*.65;c.shadowColor=accent;c.shadowBlur=6
  line(c,8,-3.2,91,-6.5,accent,.5);line(c,8,3.2,91,6.5,accent,.5)
  circle(c,x,0,1.1+charge*.7,'#f2ffff');c.restore()
 }
 c.restore()
}
// The small table marker is a projected contact point. The front-view inset
// shows tip height unambiguously; side offset is measured relative to the shot.
function contactOffset(spin){return {x:-(spin.spinY||0)*P.R*.65,y:-(spin.spinX||0)*P.R*.7}}
function cue(c,g){
 const strike=g.strikeUntil>g.now,b=strike&&g.strikeOrigin?g.strikeOrigin:g.balls[0]
 if(!b||b.dead)return
 const spin=strike&&g.strikeOrigin?g.strikeOrigin:g,offset=contactOffset(spin)
 const a=(strike&&g.strikeOrigin?g.strikeOrigin.angle:g.angle)+Math.PI
 const pull=strike?Math.max(0,(g.strikeUntil-g.now)/110)*(12+g.shotPower*.32):12+g.power*.32
 c.save();c.translate(b.x,b.y);c.rotate(a)
 if(!strike){c.setLineDash([1,1.6]);line(c,offset.x,offset.y,offset.x+pull,offset.y,'#ffcf9790',.6);c.setLineDash([])}
 c.save();c.translate(offset.x+pull,offset.y)
 // Projected lift and a separate shadow make elevated/special strokes visible.
 if(spin.special&&spin.special!=='normal')c.scale(spin.special==='masse'?.62:.84,1)
 cueBody(c,g.cueStyle||0,g.power,g.now)
 circle(c,0,0,1.4,'#ffd0a0','#fff0d9');c.restore();c.restore()
}
function contactMarker(c,g){
 if(!g.ready||g.placing||g.complete||g.balls[0].dead)return
 const b=g.balls[0],o=contactOffset(g),a=g.angle+Math.PI
 const x=b.x+o.x*Math.cos(a)-o.y*Math.sin(a),y=b.y+o.x*Math.sin(a)+o.y*Math.cos(a)
 c.save();circle(c,x,y,1.35,'#ff8658','#fff5cf')
 const side=Math.abs(g.spinX)>.12,vertical=Math.abs(g.spinY)>.12
 if(side||vertical){
  // Arrow indicates the selected spin, not a predicted path.
  const radius=P.R+2.6,start=-Math.PI*.8,end=start+(side?g.spinX:-g.spinY)*Math.PI*1.2
  c.beginPath();c.arc(b.x,b.y,radius,Math.min(start,end),Math.max(start,end));c.strokeStyle='#ffc58b';c.lineWidth=.7;c.stroke()
  const t=end+(end<start?-Math.PI/2:Math.PI/2),X=b.x+Math.cos(end)*radius,Y=b.y+Math.sin(end)*radius
  line(c,X,Y,X-Math.cos(t-.5)*2,Y-Math.sin(t-.5)*2,'#ffc58b',.8)
  line(c,X,Y,X-Math.cos(t+.5)*2,Y-Math.sin(t+.5)*2,'#ffc58b',.8)
  text(c,g.spinLabel(),b.x,Math.max(12,b.y-15),6.5,'#ffe0b2','center',600)
 }
 c.restore()
}
function spinFront(c,g,cx,cy,r){
 ballRaw(c,{n:0,x:cx,y:cy},r)
 c.save();c.setLineDash([2,3]);line(c,cx-r*.82,cy,cx+r*.82,cy,'#36506060',.7);line(c,cx,cy-r*.82,cx,cy+r*.82,'#36506060',.7);c.setLineDash([])
 const x=cx+g.spinX*r*.72,y=cy-g.spinY*r*.72
 circle(c,cx,cy,r*.72,null,'#4d6f7240')
 // Shaft aimed at the chosen front-face point, with a visible ferrule and tip.
 const k=r/36
 line(c,x+13*k,y+25*k,x+3*k,y+6*k,'#1a2e43',5*k);line(c,x+12*k,y+24*k,x+2*k,y+5*k,'#a4dbe9',2.6*k)
 line(c,x+3*k,y+6*k,x,y,'#d5eff3',3.5*k);circle(c,x,y,Math.max(2,r*.11),'#ff8658','#fff7de')
 c.restore()
}
function spinDock(c,g,L){
 if(!g.spinOpen||g.panel||!g.ready||g.placing||g.complete)return
 const w=238,h=174,x=Math.max(12,L.right-w),y=L.h-55-h
 rr(c,x,y,w,h,13,'#081b2af5','#638a9e')
 g.hits.push({id:'spinDock',x,y,w,h})
 text(c,'击球点 · 杆头视角',x+14,y+18,12,'#e7f7ff','left',600)
 text(c,'拖红点 · 松手即用',x+14,y+37,9,'#89b7c6')
 const cx=x+64,cy=y+99,r=36
 spinFront(c,g,cx,cy,r)
 text(c,'高',cx,cy-r-8,9,'#9fbac6','center');text(c,'低',cx,cy+r+10,9,'#9fbac6','center')
 text(c,'左',cx-r-12,cy,9,'#9fbac6','center');text(c,'右',cx+r+12,cy,9,'#9fbac6','center')
 g.hits.push({id:'spinpad',x:cx-r-4,y:cy-r-4,w:2*r+8,h:2*r+8,cx,cy,r:r*.72})
 text(c,g.spinLabel(),x+120,y+62,11,'#ffcea0','left',600)
 button(c,g,'center','中杆',x+122,y+80,98,24)
 button(c,g,'jump','跳杆',x+122,y+109,46,24,g.special==='jump')
 button(c,g,'masse','扎杆',x+174,y+109,46,24,g.special==='masse')
 text(c,'本杆有效 · 下杆回中杆',x+14,y+157,9,'#7399ad')
}
function chrome(c,g,L){
 const {w,h,power:p,fine:f}=L
 g.hits=[]
 if(g.match){
  for(let i=0;i<2;i++){
   const x=i===0?L.left:L.right-140,active=g.match.turn===i&&!g.complete,accent=i===0?'#64e5ff':'#c294ff'
   rr(c,x,5,140,40,9,active?'#173347':'#0d1b2a',active?accent:'#2a3b50')
   text(c,'玩家 '+(i+1)+'  ·  '+Rules.label(g.match.groups[i]),x+8,16,10,active?'#effbff':'#91a6bb','left',600)
   const own=g.match.groups[i],ns=own?(own==='solid'?[1,2,3,4,5,6,7]:[9,10,11,12,13,14,15]):[]
   if(own)ns.forEach((n,k)=>{c.save();const b=g.balls.find(t=>t.n===n);c.globalAlpha=b&&b.dead?.16:1;ball(c,{n,x:x+12+k*16,y:32},4.5);c.restore()})
   else text(c,g.match.breaking?'开球不分组':'合法首进球决定分组',x+8,33,8,'#849eb2')
   if(own&&!Rules.remaining(g.balls,own).length)ball(c,{n:8,x:x+127,y:30},6)
  }
  text(c,'一杆入袋 · ORBIT',w/2,16,12,'#e4f7ff','center',700)
  text(c,g.complete?'本局结束':g.match.breaking?'轨 道 竞 技 场  /  开 球':g.placing?'BALL IN HAND':'玩家 '+(g.match.turn+1)+' 击球',w/2,35,9,'#8cd6e8','center',600)
 }else{
  text(c,'一杆入袋',L.left,23,17,'#e1f5ff','left',700)
  const status=g.scenario==='practice'?'自由清台':g.scenario==='line'?'准度练习':g.scenario==='spin'?'走位练习':'跳球练习'
  text(c,status,w/2,18,11,'#b8d5d8','center',600)
  text(c,g.shots+' 杆   /   '+g.sunk+' 进球',w/2,35,10,'#88a0ad','center')
 }
 const enabled=g.ready&&!g.placing&&!g.complete
 c.save();if(!enabled)c.globalAlpha=.4
 rr(c,p.x,p.y,p.w,p.h,17,'#111f2b','#293c49')
 text(c,(g.match?g.match.breaking:g.scenario==='practice'&&g.shots===0)?'开球':'力度',p.x+p.w/2,p.y-10,10,'#9eb2bc','center')
 const barY=p.y+24,barH=p.h-47
 rr(c,p.x+16,barY,10,barH,5,'#07121a')
 const grad=c.createLinearGradient(0,barY,0,barY+barH);grad.addColorStop(0,'#56dab9');grad.addColorStop(.6,'#e2d78c');grad.addColorStop(1,'#ff805c')
 if(g.power>0)rr(c,p.x+16,barY,10,barH*(g.powerFraction||0),5,grad)
 for(let i=0;i<=10;i++)line(c,p.x+7,barY+barH*i/10,p.x+12,barY+barH*i/10,'#50616b',.8)
 const knob=barY+barH*(g.powerFraction||0)
 rr(c,p.x+6,knob-7,30,14,6,'#e3f3df','#fff9')
 line(c,p.x+16,knob-2,p.x+26,knob-2,'#5b8075');line(c,p.x+16,knob+2,p.x+26,knob+2,'#5b8075')
 if(g.lastPower){const yy=barY+barH*g.lastPower/100;line(c,p.x+28,yy,p.x+37,yy,'#ffcf78',1.5)}
 text(c,g.power.toFixed(1)+'%',p.x+p.w/2,p.y+p.h-10,10,'#d5eddf','center',700)
 g.hits.push({id:'power',...p})
 rr(c,f.x,f.y,f.w,f.h,15,'#111f2b','#293c49')
 text(c,'微调',f.x+f.w/2,f.y-10,10,'#9eb2bc','center')
 c.save();c.beginPath();c.rect(f.x+5,f.y+10,f.w-10,f.h-20);c.clip()
 const phase=(g.angle*180/Math.PI*6)%12
 for(let k=-2;k<Math.ceil(f.h/6)+2;k++){
   const y=f.y+8+k*6+phase
   line(c,f.x+9,y,f.x+(k%4===0?28:22),y,k%4===0?'#bac8c8':'#536977',1)
 }
 c.restore();line(c,f.x+3,f.y+f.h/2,f.x+f.w-3,f.y+f.h/2,'#edcf83',2)
 g.hits.push({id:'fine',...f});c.restore()
 const y=h-43
 button(c,g,'menu','球局',L.left,y,49,29)
 button(c,g,'help','玩法',L.left+56,y,49,29)
 button(c,g,'undo',g.match?'规则':'撤杆',L.left+112,y,49,29)
 button(c,g,'cues','球杆',L.left+168,y,49,29)
 const spinX=L.right-210
 rr(c,spinX,y-5,112,35,8,'#172634','#476576')
 spinFront(c,g,spinX+20,y+12,13)
 text(c,g.spinLabel(),spinX+39,y+7,g.spinLabel().length>7?8:10,'#ffdbaf')
 text(c,'点击调整杆法',spinX+39,y+21,7,'#8aaebb')
 g.hits.push({id:'spin',x:spinX,y:y-5,w:112,h:35})
 button(c,g,'sound',g.sound?'声音 开':'声音 关',L.right-91,y,66,29)
 const msg=g.placing?(g.placementKind==='break'?'开球：在线后拖白球，松手摆好 · 也可直接选杆法或拉杆':'自由球：拖到空位，松手摆好'):g.drag&&g.drag.kind==='power'?(g.drag.precision?'精调 ×0.15 · 松手出杆':'当前力度预演 · 向右移慢调 · 拉回取消'):g.status
 text(c,msg,w/2,h-51,9,g.ready?'#b3c7cd':'#e6cf9a','center')
 if(g.canPlace&&g.ready&&!g.complete)text(c,'拖白球摆位',(L.left+217+L.right-210)/2,y+14,9,'#96d8c8','center')
 if(g.toast&&g.now<g.toastUntil){
   const ww=Math.min(w-50,g.toast.length*10+28)
   rr(c,w/2-ww/2,51,ww,31,15,'#0a1b22ec','#749180')
   text(c,g.toast,w/2,67,10,'#ecdfb8','center',600)
 }
}
function modal(c,g,L){
 const {w,h}=L,kind=g.panel
 if(!kind)return
 c.fillStyle='#020912c9';c.fillRect(0,0,w,h)
 const mw=Math.min(w-40,510),mh=Math.min(h-30,322),x=(w-mw)/2,y=(h-mh)/2
 rr(c,x,y,mw,mh,18,'#142330','#3c5860')
 g.hits=[]
 button(c,g,'close','×',x+mw-40,y+12,27,27)
 if(kind==='menu'){
   text(c,'黑八对决 · 技术训练',x+25,y+32,19,'#eee2c4','left',600)
   text(c,'同屏双人轮流击球，也可独自练习',x+25,y+58,11,'#8faab6')
   const cards=[['rack','双人黑八','分组 · 自由球 · 指袋黑八'],['practice','自由清台','不限球组 · 撤杆重试'],['spin','走位练习','高低杆 · 左右塞组合'],['jump','跳球练习','越过障碍 · 花式击球']]
   cards.forEach(([id,title,sub],i)=>{
     const xx=x+25+(i%2)*(mw-40)/2,yy=y+83+Math.floor(i/2)*81,ww=(mw-60)/2
     rr(c,xx,yy,ww,69,10,'#1c3240','#35505c')
     text(c,title,xx+14,yy+23,14,'#e6d5af','left',600);text(c,sub,xx+14,yy+47,10,'#9bb9c6')
     g.hits.push({id:'scene:'+id,x:xx,y:yy,w:ww,h:69})
   })
   text(c,g.best?'清台纪录  '+g.best+' 杆':'每一杆，都更靠近一点',x+25,y+mh-27,11,'#8faab6')
 }else if(kind==='help'){
   text(c,'三步，上手',x+25,y+31,20,'#eee2c4','left',600)
   const rows=[['01  瞄准','拖白球松手摆好；点球台瞄准，右侧微调。'],['02  拉杆','下拉蓄力，右移进入慢速精调，松手出杆。'],['03  控球','点底部白球，拖红点松手即用；黑八先指定袋口。']]
   rows.forEach(([a,b],i)=>{text(c,a,x+27,y+83+i*54,13,'#d4e8d8','left',600);text(c,b,x+27,y+105+i*54,11,'#9fb7c3')})
   text(c,'辅助线按当前力度预演；未蓄力按 50% · 黄刻度为上杆力度',x+27,y+mh-58,11,'#dfcfa9')
   button(c,g,'assist',g.assist?'辅助线 开':'辅助线 关',x+27,y+mh-41,96,28)
   text(c,'预演只显示首碰附近，后续撞球会截断',x+138,y+mh-26,10,'#7e9daa')
 }else if(kind==='rules'){
   text(c,'本局规则 · 休闲黑八',x+25,y+30,19,'#eef7ff','left',700)
   const rows=[
    '开球白球在线后摆放；全色 1–7 / 双色 9–15。',
    '开球后合法首进球定组；混进按先落袋的球定组。',
    '先碰本组；碰球后须进球或任意球碰库。',
    '无碰球、碰错组、无碰库、白球进袋：对手全台自由球。',
    '本组清完的下一杆才打黑八，出杆前点袋口指定。',
    '提前进黑八、黑八伴随犯规、进错袋：直接判负。',
    '开球进球不分组；须进球或四球碰库，黑八进袋复位。'
   ]
   rows.forEach((t,i)=>text(c,t,x+25,y+65+i*24,10,'#b8d0de'))
   text(c,'休闲约定：普通球免报袋；开球犯规也给全台自由球。',x+25,y+mh-57,9,'#91b0c5')
   button(c,g,'history','查看最近判罚',x+25,y+mh-40,120,28)
 }else if(kind==='history'){
   text(c,'对局记录',x+25,y+32,19,'#eef7ff','left',700)
   const rows=g.match?g.match.history:[]
   ;(rows.length?rows:['出杆后，这里显示球权与判罚原因。']).forEach((t,i)=>text(c,t,x+25,y+85+i*39,10,'#bbd6e6'))
 }else if(kind==='cues'){
   text(c,'武装库 / ORBIT CUES',x+25,y+28,18,'#e0f8ff','left',700)
   text(c,'机械分段 · 发光内芯 · 三种结构，同等性能',x+25,y+51,10,'#91adbf')
   cueNames.forEach((name,i)=>{
    const yy=y+72+i*71,active=(g.cueStyle||0)===i
    panel(c,x+22,yy,mw-44,63,9,active?'#193449':'#0b1929',active?cueColors[i]:'#294356')
    text(c,name,x+35,yy+16,11,cueColors[i],'left',600)
    text(c,active?'已装备':'点击装备',x+mw-40,yy+16,9,active?'#e0fbff':'#91a9ba','right')
    const scale=Math.min((mw-80)/124,2.9)
    c.save();c.translate(x+mw/2-61*scale,yy+42);c.scale(scale,1.7);cueBody(c,i,35,g.now);c.restore()
    g.hits.push({id:'cue:'+i,x:x+22,y:yy,w:mw-44,h:63})
   })
 }else if(kind==='win'){
   text(c,g.match?'玩家 '+(g.match.winner+1)+' 获胜':'清 台 成 功',w/2,y+66,28,'#8af0ff','center',700)
   text(c,g.match?g.match.reason:g.shots+' 杆  /  '+g.fouls+' 次白球落袋',w/2,y+113,13,'#c1d9dc','center')
   text(c,g.match?'黑八对决 · 本局结束':g.newBest?'刷新你的最佳纪录！':'下一局，试着少用一杆。',w/2,y+151,13,'#8fb7b9','center')
   button(c,g,'scene:'+g.scenario,'再来一局',w/2-78,y+mh-85,156,40,true)

 }
}
function background(c,g,L){
 const bg=c.createRadialGradient(L.w*.5,L.h*.45,20,L.w*.5,L.h*.45,L.w*.7)
 bg.addColorStop(0,'#173047');bg.addColorStop(.55,'#0b1627');bg.addColorStop(1,'#030710');c.fillStyle=bg;c.fillRect(0,0,L.w,L.h)
 // Receding arena floor and wide structural bands, rather than a flat backdrop.
 for(let i=-8;i<=8;i++)line(c,L.w/2+i*45,L.h*.38,L.w/2+i*125,L.h,'#5384b415',.6)
 for(let i=0;i<9;i++){const y=L.h*.38+Math.pow(i/8,1.7)*L.h*.62;line(c,0,y,L.w,y,'#5384b415',.6)}
 for(const side of [0,1]){c.save();if(side){c.translate(L.w,0);c.scale(-1,1)}poly(c,[[0,0],[L.w*.18,0],[L.w*.08,L.h],[0,L.h]],'#04101c55');glowLine(c,L.w*.18,0,L.w*.08,L.h,'#257ebf35',1);c.restore()}
 }
function configure(c,L,dpr,createCanvas){
 // One arena bitmap and one small ball atlas; discard both on resize/unload.
 renderCaches.delete(c)
 try{
  const surface=createCanvas(Math.ceil(L.w*dpr),Math.ceil(L.h*dpr)),base=surface.getContext('2d')
  base.scale(dpr,dpr)
  const size=Math.ceil(18*L.s*dpr),atlas=createCanvas(size*16,size),ac=atlas.getContext('2d')
  const scale=size/18
  for(let n=0;n<16;n++){ac.save();ac.translate(n*size,0);ac.scale(scale,scale);ballRaw(ac,{n,x:9,y:9,z:0});ac.restore()}
  renderCaches.set(c,{surface,base,atlas,spriteSize:size,turn:null})
 }catch(e){renderCaches.delete(c)}
}
function release(c){renderCaches.delete(c)}
function render(c,g,L){
 c.clearRect(0,0,L.w,L.h)
 const cache=renderCaches.get(c),turn=g.match?g.match.turn:0
 if(cache){
  try{
   if(cache.turn!==turn){cache.base.clearRect(0,0,L.w,L.h);background(cache.base,g,L);tableBase(cache.base,Object.assign({},g,{power:0}),L);cache.turn=turn}
   c.drawImage(cache.surface,0,0,L.w,L.h)
  }catch(e){release(c);background(c,g,L);tableBase(c,g,L)}
 }else{background(c,g,L);tableBase(c,g,L)}
 for(let i=0;i<12;i++){const x=(i*137.3)%L.w,y=(i*73.7+g.now*.0015)%L.h;circle(c,x,y,.7,i%2?'#55dfff35':'#bc8aff35')}
 table(c,g,L);chrome(c,g,L);spinDock(c,g,L);modal(c,g,L)
}

module.exports={render,layout,configure,release,contactOffset}

};
factories['controller']=function(module,exports,require){
const P=require('physics')
const R=require('render')
const Rules=require('rules')
const Audio=require('audio')
const clone=v=>JSON.parse(JSON.stringify(v))
function fresh(n,x,y){return {n,x,y,vx:0,vy:0,z:0,vz:0,side:0,top:0,bend:0,age:0,dead:false}}
Page({
 data:{error:''},
 onReady(){this.init()},
 retry(){this.setData({error:''});this.init()},
 init(){
  wx.createSelectorQuery().in(this).select('#game').fields({node:true,size:true}).exec(res=>{
   if(!res[0]||!res[0].node){this.setData({error:'球台加载失败，请重新打开。'});return}
   this.canvas=res[0].node;this.ctx=this.canvas.getContext('2d')
   const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync()
   const dpr=Math.min(info.pixelRatio||2,2)
   this.canvas.width=res[0].width*dpr;this.canvas.height=res[0].height*dpr
   this.ctx.scale(dpr,dpr)
   const safe=info.safeArea||{}
   this.L=R.layout(res[0].width,res[0].height,{left:Math.max(0,safe.left||0),right:Math.max(0,info.windowWidth-(safe.right||info.windowWidth))})
   this.configureRenderer(dpr)
   this.rect={left:0,top:0}
   this.g={now:Date.now(),sound:true,assist:true,spinX:0,spinY:0,special:'normal',best:0,cueStyle:0,panel:null,previewPath:null}
   this.g.spinLabel=()=>this.spinLabel()
   try{this.g.best=wx.getStorageSync('poolBest')||0;const opts=wx.getStorageSync('poolOptions');if(opts){this.g.sound=opts.sound;this.g.assist=opts.assist;this.g.cueStyle=opts.cueStyle||0}}catch(e){}
   if(this.audio)this.audio.destroy()
   this.audio=Audio.create(()=>wx.createInnerAudioContext())
   this.reset('rack')
   this.hidden=false;this.last=Date.now();this.running=true;this.tick()
  })
 },
 configureRenderer(dpr){
  R.release(this.ctx)
  if(wx.createOffscreenCanvas)R.configure(this.ctx,this.L,dpr,(width,height)=>wx.createOffscreenCanvas({type:'2d',width,height}))
 },
 onHide(){this.hidden=true;this.touchCancel();if(this.audio)this.audio.stop();if(this.canvas&&this.frame)this.canvas.cancelAnimationFrame(this.frame);this.frame=null},
 onShow(){if(this.canvas&&this.running){this.hidden=false;this.last=Date.now();if(!this.frame)this.tick()}},
 onResize(){
  if(!this.canvas)return
  this.touchCancel()
  wx.createSelectorQuery().in(this).select('#game').fields({node:true,size:true}).exec(res=>{
   if(!res[0])return
   const i=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync(),d=Math.min(i.pixelRatio||2,2)
   this.canvas.width=res[0].width*d;this.canvas.height=res[0].height*d;this.ctx.scale(d,d)
   const safe=i.safeArea||{}
   this.L=R.layout(res[0].width,res[0].height,{left:safe.left||0,right:Math.max(0,i.windowWidth-(safe.right||i.windowWidth))})
   this.configureRenderer(d)
  })
 },
 onUnload(){if(this.ctx)R.release(this.ctx);this.running=false;if(this.canvas&&this.frame)this.canvas.cancelAnimationFrame(this.frame);if(this.audio)this.audio.destroy()},
 reset(scene){
  const g=this.g
  if(this.audio)this.audio.stop()
  g.scenario=scene;g.balls=(scene==='rack'||scene==='practice')?P.rack(false):
   scene==='line'?[fresh(0,90,126),fresh(1,250,48)]:
   scene==='spin'?[fresh(0,90,92),fresh(1,153,92),fresh(3,282,43),fresh(8,275,146)]:
   [fresh(0,73,92),fresh(2,140,92),fresh(1,246,92)]
  g.angle=scene==='line'?Math.atan2(48-126,250-90):0
  Object.assign(g,{sunk:0,shots:0,fouls:0,complete:false,ready:true,placing:false,placeValid:true,canPlace:null,spinOpen:false,power:0,drag:null,spinX:0,spinY:0,special:'normal',panel:null,potted:[],falls:[],effects:[],impacts:[],snapshot:null,strikeUntil:0,toast:null,lag:0,previewPath:null})
  g.match=scene==='rack'?Rules.create():null;g.calledPocket=null;g.lastPower=0;g.powerFraction=0
  g.placementKind=null
  g.status=g.match?'玩家 1 开球 · 开球不分组':'拖球台瞄准 · 左侧下拉出杆'
  if(this.isOpening())this.beginPlacement('break')
  this.preview()
 },
 isOpening(){const g=this.g;return g.shots===0&&!!(g.match?g.match.breaking:g.scenario==='practice')},
 beginPlacement(kind){
  const g=this.g;g.placing=true;g.placementKind=kind;g.canPlace=kind;g.spinOpen=false;g.power=0;g.powerFraction=0;g.drag=null;g.prediction=null;g.previewPath=null
  this.movePlace({x:this.L.tx+g.balls[0].x*this.L.s,y:this.L.ty+g.balls[0].y*this.L.s})
  g.status=kind==='break'?'开球：在左侧开球线后摆放白球':'自由球：全台摆放白球'
 },
 commitPlace(){
  const g=this.g
  if(!g.placing)return true
  if(!g.placeValid){this.notify('位置重叠或靠近袋口，请拖到空位');return false}
  g.placing=false;g.placementKind=null;g.status='白球已摆好 · 点球台瞄准，直接拉杆';this.preview(true);return true
 },
 spinLabel(){
  const g=this.g,lr=Math.abs(g.spinX)<.12?'':g.spinX<0?'左塞':'右塞',ud=Math.abs(g.spinY)<.12?'':g.spinY>0?'高杆':'低杆'
  return (ud||lr?ud+lr:'中杆')+(g.special==='masse'?' · 扎杆':g.special==='jump'?' · 跳杆':'')
 },
 shotMode(){const g=this.g;return {breakShot:!!(g.match?g.match.breaking:g.scenario==='practice'&&g.shots===0),top:g.spinY,side:g.spinX,lift:g.special==='jump'?1:0,bend:g.special==='masse'?(Math.abs(g.spinX)>.1?g.spinX:1):0}},
 preview(force=false){
  const g=this.g;if(!g.ready||g.placing||!g.balls||g.balls[0].dead)return
  const now=Date.now()
  if(!force&&g.drag&&now-(this.lastPreview||0)<40){g.previewDirty=true;return}
  this.lastPreview=now;g.previewDirty=false
  const power=g.power>0?g.power/100:.5
  g.prediction=P.predict(g.balls,g.angle,power,this.shotMode())
  g.previewPath=g.special==='normal'?null:g.prediction?g.prediction.cuePath:null
 },
 play(name,volume=1){if(this.g.sound&&this.audio)this.audio.play(name,volume)},
 resetSpin(){this.g.spinX=this.g.spinY=0;this.g.special='normal';this.g.previewPath=null;this.g.prediction=null},
 notify(s){this.g.toast=s;this.g.toastUntil=Date.now()+2200},
 tick(){
  if(!this.running||this.hidden)return
  this.frame=null
  const g=this.g,now=Date.now(),dt=Math.min(40,now-this.last)
  g.now=now;this.last=now
  if(!g.ready){
   const soundFrame={hit:0,rail:0}
   g.lag+=dt*.06
   while(g.lag>=.25){
    const events=P.step(g.balls,.25,null,e=>{
     if(g.match&&g.shot)Rules.record(g.shot,e)
     if(e.type==='contact')soundFrame.hit=Math.max(soundFrame.hit,e.speed/12)
     if(e.type==='rail'){
      soundFrame.rail=Math.max(soundFrame.rail,e.speed/16)
      if(e.speed>1)g.impacts.push({x:Math.max(0,Math.min(P.W,e.x)),y:Math.max(0,Math.min(P.H,e.y)),at:now,strength:Math.min(1,e.speed/9)})
     }
    })
    for(const n of events){
     const b=g.balls.find(t=>t.n===n)
     g.falls.push({n,x:b.x,y:b.y,at:now});this.play('pocket',.68)
     if(n===0){g.scratch=true;this.notify('白球落袋 · 停稳后可自由摆位')}
     else{g.shotPotted.push(n);g.effects.push({x:b.x,y:b.y,at:now});this.notify(n+' 号球进袋')}
    }
    g.lag-=.25
   }
   this.play('hit',soundFrame.hit);this.play('rail',soundFrame.rail)
   if(!P.moving(g.balls))this.finish()
  }
  g.impacts=(g.impacts||[]).filter(x=>now-x.at<360).slice(-12)
  g.falls=g.falls.filter(x=>now-x.at<320);g.effects=g.effects.filter(x=>now-x.at<650)
  if(g.ready&&g.previewDirty&&now-(this.lastPreview||0)>=40)this.preview(true)
  R.render(this.ctx,g,this.L)
  this.frame=this.canvas.requestAnimationFrame(()=>this.tick())
 },
 fire(){
  const g=this.g
  if(!g.ready||g.placing||g.complete||g.power<.5)return
  if(g.match&&!g.match.breaking&&g.match.groups[g.match.turn]&&!Rules.remaining(g.balls,g.match.groups[g.match.turn]).length&&g.calledPocket===null){this.notify('打黑八前，先点一个袋口指定目标');return}
  g.shot=g.match?Rules.start(g.match,g.balls,g.calledPocket):null
  g.snapshot={balls:clone(g.balls),sunk:g.sunk,shots:g.shots,fouls:g.fouls,potted:g.potted.slice(),angle:g.angle,canPlace:g.canPlace}
  g.strikeOrigin={x:g.balls[0].x,y:g.balls[0].y,angle:g.angle,spinX:g.spinX,spinY:g.spinY,special:g.special};g.lastPower=g.power;g.shotPower=g.power;g.strikeUntil=Date.now()+110;g.shotPotted=[];g.scratch=false;g.lag=0
  P.shoot(g.balls[0],g.angle,g.power/100,this.shotMode(),1)
  g.ready=false;g.shots++;g.status='';g.panel=null;g.spinOpen=false;g.canPlace=null
  this.play('cue',.3+g.power/150);g.power=0
 },
 finish(){
  const g=this.g
  g.ready=true;g.sunk+=g.shotPotted.length;g.potted.push(...g.shotPotted);g.drag=null
  if(g.match){
   const result=Rules.resolve(g.match,g.shot)
   if(result.respotEight){P.spot(g.balls,8);g.potted=g.potted.filter(n=>n!==8);g.sunk=g.potted.length}
   g.fouls=g.match.fouls.reduce((a,b)=>a+b,0)
   g.calledPocket=null;g.status=result.message;this.notify(result.message)
   if(g.match.winner!==null){g.complete=true;g.placing=false;g.panel='win'}
   else if(result.ballInHand){if(g.scratch)P.replace(g.balls);this.beginPlacement('free')}
  }else{
   if(g.scratch){g.fouls++;P.replace(g.balls);this.beginPlacement('free')}
   g.status=g.shotPotted.length?'好球！继续下一杆':'拖球台瞄准 · 左侧下拉出杆'
   if(g.balls.slice(1).every(b=>b.dead)){
    g.placing=false;g.complete=true;g.panel='win';g.newBest=false
    if(g.scenario==='practice'&&(!g.best||g.shots<g.best)){g.best=g.shots;g.newBest=true;try{wx.setStorageSync('poolBest',g.best)}catch(e){}}
   }
  }
  this.resetSpin();this.preview()
 },
 point(e){
  const t=(e.touches&&e.touches[0])||(e.changedTouches&&e.changedTouches[0])
  if(!t)return null
  return {x:t.x==null?t.clientX:t.x,y:t.y==null?t.clientY:t.y}
 },
 touchStart(e){
  if(!this.g||!this.L)return
  const p=this.point(e);if(!p)return
  const g=this.g,L=this.L
  const hit=(g.hits||[]).slice().reverse().find(b=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)
  if(hit){
   if(hit.id==='spinpad'&&g.ready&&!g.placing){g.drag={kind:'spin',hit};this.moveSpin(p);return}
   if(hit.id==='spinDock')return
   if(['power','fine'].includes(hit.id)&&g.ready&&!g.panel){if(!this.commitPlace())return;g.spinOpen=false}
   if(hit.id==='fine'&&g.ready&&!g.placing&&!g.panel){g.drag={kind:'fine',y:p.y,angle:g.angle};return}
   if(hit.id==='power'&&g.ready&&!g.placing&&!g.panel){
    g.drag={kind:'power',x:p.x,y:p.y,lastY:p.y,fraction:0,precision:false};g.power=0;g.powerFraction=0;return
   }
   if(hit.id==='fine'||hit.id==='power')return
   g.drag={kind:'button',id:hit.id,x:p.x,y:p.y};return
  }
  if(g.panel||!g.ready||g.complete)return
  const x=(p.x-L.tx)/L.s,y=(p.y-L.ty)/L.s
  if(x<-18||x>P.W+18||y<-18||y>P.H+18)return
  if(!g.placing&&g.match&&!g.match.breaking&&g.match.groups[g.match.turn]&&!Rules.remaining(g.balls,g.match.groups[g.match.turn]).length){
   const pocket=P.pockets.findIndex(t=>Math.hypot(t[0]-x,t[1]-y)<15)
   if(pocket>=0){g.calledPocket=pocket;this.notify('已指定 '+(pocket+1)+' 号袋 · 可出杆');return}
  }
  g.spinOpen=false
  if(g.placing){g.drag={kind:'place'};this.movePlace(p);return}
  if(g.canPlace&&Math.hypot(x-g.balls[0].x,y-g.balls[0].y)<Math.max(10,18/L.s)){
   g.placing=true;g.placementKind=g.canPlace;g.drag={kind:'place'};this.movePlace(p);return
  }
  const b=g.balls[0],dx=x-b.x,dy=y-b.y,along=dx*Math.cos(g.angle)+dy*Math.sin(g.angle),cross=dx*Math.sin(g.angle)-dy*Math.cos(g.angle)
  if(along<-12&&along>-140&&Math.abs(cross)<7){
   g.drag={kind:'cue',x:p.x,y:p.y};return
  }
  g.drag={kind:'aim'};this.moveAim(p)
 },
 touchMove(e){
  if(!this.g||!this.g.drag)return
  const p=this.point(e);if(!p)return
  const g=this.g,d=g.drag
  if(d.kind==='spin')this.moveSpin(p)
  if(d.kind==='aim')this.moveAim(p)
  if(d.kind==='place')this.movePlace(p)
  if(d.kind==='fine'){g.angle=d.angle+(p.y-d.y)*.035*Math.PI/180;this.preview()}
  if(d.kind==='power')this.movePower(p)
  if(d.kind==='cue'){
   const distance=-(p.x-d.x)*Math.cos(g.angle)-(p.y-d.y)*Math.sin(g.angle)
   g.powerFraction=Math.max(0,Math.min(1,distance/(this.L.s*65)))
   g.power=Math.round(1000*g.powerFraction)/10
   this.preview()
  }
 },
 touchEnd(e){
  if(!this.g)return
  const g=this.g,d=g.drag,p=this.point(e)
  if(!d)return
  if(d.kind==='power'||d.kind==='cue'){
   if(d.kind==='power'&&p)this.movePower(p)
   if(g.power>=.5)this.fire();g.power=0;g.powerFraction=0
  }else if(d.kind==='place'){if(p)this.movePlace(p);this.commitPlace()}
  else if(d.kind==='spin'){if(p)this.moveSpin(p);g.spinOpen=false;if(g.panel==='spin')g.panel=null;g.status=this.spinLabel()+' · 点球台瞄准，直接拉杆'}
  else if(d.kind==='button'&&p&&Math.hypot(p.x-d.x,p.y-d.y)<18)this.action(d.id)
  g.drag=null
  if(g.ready)this.preview(true)
 },
 touchCancel(){if(this.g){this.g.drag=null;this.g.power=0;this.g.powerFraction=0;if(this.L&&this.g.ready)this.preview(true)}},
 moveAim(p){
  const g=this.g,b=g.balls[0],x=(p.x-this.L.tx)/this.L.s-b.x,y=(p.y-this.L.ty)/this.L.s-b.y
  if(Math.hypot(x,y)>10){g.angle=Math.atan2(y,x);this.preview()}
 },
 movePower(p){
  const r=this.L.power,g=this.g,d=g.drag
  if(!d||d.kind!=='power')return
  const precision=p.x>r.x+r.w+22
  const delta=(p.y-d.lastY)/(r.h-47)*(precision?.15:1)
  d.lastY=p.y;d.precision=precision
  d.fraction=Math.max(0,Math.min(1,d.fraction+delta))
  if(p.x<r.x-30)d.fraction=0
  g.powerFraction=d.fraction
  g.power=Math.round(1000*d.fraction)/10
  this.preview()
 },
 moveSpin(p){
  const h=this.g.drag.hit
  let x=(p.x-h.cx)/h.r,y=(h.cy-p.y)/h.r
  const len=Math.hypot(x,y);if(len>1){x/=len;y/=len}
  this.g.spinX=x;this.g.spinY=y;this.preview()
 },
 movePlace(p){
  const g=this.g,b=g.balls[0]
  b.x=Math.max(P.R+1,Math.min(g.placementKind==='break'?P.HEAD_LINE-.1:P.W-P.R-1,(p.x-this.L.tx)/this.L.s))
  b.y=Math.max(P.R+1,Math.min(P.H-P.R-1,(p.y-this.L.ty)/this.L.s))
  g.placeValid=g.balls.slice(1).every(t=>t.dead||Math.hypot(t.x-b.x,t.y-b.y)>2*P.R+.5)&&P.pockets.every(t=>Math.hypot(t[0]-b.x,t[1]-b.y)>14)
 },
 action(id){
  const g=this.g
  if(id==='close'){g.panel=g.complete?'menu':null;g.spinOpen=false;return}
  if(id==='sound'){g.sound=!g.sound;if(!g.sound&&this.audio)this.audio.stop();this.saveOptions();return}
  if(id==='assist'){g.assist=!g.assist;this.saveOptions();return}
  if(id==='help'){g.panel='help';return}
  if(id==='history'){g.panel='history';return}
  if(id==='rules'){g.panel='rules';return}
  if(id==='cues'){g.panel='cues';return}
  if(id.startsWith('cue:')){g.cueStyle=Number(id.slice(4));this.saveOptions();return}
  if(id==='menu'){
   if(!g.ready){this.notify('等这一杆停稳，再换球局');return}
   g.panel='menu';return
  }
  if(id.startsWith('scene:')){
   if(!g.ready)return
   this.reset(id.slice(6));return
  }
  if(id==='undo'){
   if(g.match){g.panel='rules';return}
   if(!g.ready){this.notify('球停稳后可以撤回上一杆');return}
   if(!g.snapshot){this.notify('出一杆之后，可以撤回重试');return}
   Object.assign(g,clone(g.snapshot));g.snapshot=null;g.placing=false;g.placementKind=null;g.complete=false;g.power=0;g.effects=[];g.falls=[];g.panel=null
   g.status='已撤回 · 换个力度再试';this.resetSpin();this.preview();return
  }
  if(id==='breakPlace'){
   if(g.ready&&!g.complete&&this.isOpening())this.beginPlacement('break')
   return
  }
  if(id==='place'){if(g.ready)this.commitPlace();return}
  if(id==='spin'){if(g.ready&&!g.complete&&this.commitPlace()){g.panel=null;g.spinOpen=!g.spinOpen}return}
  if(!g.ready||g.placing)return
  if(id==='center'){g.spinX=g.spinY=0;g.special='normal';g.spinOpen=false}
  if(['normal','masse','jump'].includes(id)){g.special=id;g.spinOpen=false}
  this.preview()
 },
 saveOptions(){try{wx.setStorageSync('poolOptions',{sound:this.g.sound,assist:this.g.assist,cueStyle:this.g.cueStyle})}catch(e){}}
})

};
function require(id){if(!cache[id]){const m={exports:{}};cache[id]=m;factories[id](m,m.exports,require)}return cache[id].exports}
const canvas=document.querySelector('#game'),arena=document.querySelector('#arena');let page,logicalW=0,logicalH=0,rotated=false,activePointer=null,started=false
const NativeAudioContext=window.AudioContext||window.webkitAudioContext;let audioContext=null;const buffers=new Map()
function audio(){if(!audioContext&&NativeAudioContext)audioContext=new NativeAudioContext();return audioContext}
function unlock(){const c=audio();if(c&&c.state==='suspended')c.resume().catch(()=>{})}
function voice(){let url='',source=null,gain=null,disposed=false,revision=0
 return {volume:1,set src(v){url=(window.ORBIT_AUDIO&&window.ORBIT_AUDIO[v])||new URL('.'+v,document.baseURI).href;if(!buffers.has(url)){buffers.set(url,fetch(url).then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer()}).then(b=>audio().decodeAudioData(b)).catch(()=>null))}},get src(){return url},seek(){},play(){const c=audio();if(disposed||!c||c.state!=='running')return;const volume=this.volume,token=revision;buffers.get(url)?.then(buffer=>{if(!buffer||disposed||token!==revision||c.state!=='running')return;source=c.createBufferSource();source.buffer=buffer;gain=c.createGain();gain.gain.value=volume;source.connect(gain);gain.connect(c.destination);source.onended=()=>{if(gain)gain.disconnect()};source.start()})},stop(){revision++;try{source?.stop()}catch{}source=null},destroy(){this.stop();disposed=true;gain?.disconnect()}}
}
function dimensions(){const r=arena.getBoundingClientRect();rotated=r.height>r.width*1.15;logicalW=Math.max(320,rotated?r.height:r.width);logicalH=Math.max(240,rotated?r.width:r.height);canvas.style.width=logicalW+'px';canvas.style.height=logicalH+'px';canvas.style.transform='translate(-50%,-50%)'+(rotated?' rotate(90deg)':'')}
canvas.requestAnimationFrame=fn=>requestAnimationFrame(fn);canvas.cancelAnimationFrame=id=>cancelAnimationFrame(id)
const wx={
 createSelectorQuery(){const q={in(){return q},select(){return q},fields(){return q},exec(fn){dimensions();fn([{node:canvas,width:logicalW,height:logicalH}])}};return q},
 getWindowInfo(){return {pixelRatio:devicePixelRatio||1,windowWidth:logicalW,windowHeight:logicalH,safeArea:{left:0,right:logicalW}}},
 getStorageSync(k){try{return JSON.parse(localStorage.getItem('orbit:'+k))}catch{return null}},setStorageSync(k,v){try{localStorage.setItem('orbit:'+k,JSON.stringify(v))}catch{}},
 createInnerAudioContext:voice,
 createOffscreenCanvas({width,height}){const c=document.createElement('canvas');c.width=width;c.height=height;return c}
}
function Page(spec){page=Object.assign({},spec);page.setData=values=>{page.data=Object.assign({},page.data,values);if(values.error){document.querySelector('#errorText').textContent=values.error;document.querySelector('#error').hidden=false}}}
require('controller')
function point(e){const r=canvas.getBoundingClientRect();return rotated?{x:(e.clientY-r.top)*logicalW/r.height,y:(r.right-e.clientX)*logicalH/r.width}:{x:(e.clientX-r.left)*logicalW/r.width,y:(e.clientY-r.top)*logicalH/r.height}}
function event(e,end=false){const p=point(e);return {touches:end?[]:[p],changedTouches:[p]}}
canvas.addEventListener('pointerdown',e=>{if(!started||activePointer!==null||e.button>0)return;e.preventDefault();unlock();activePointer=e.pointerId;canvas.setPointerCapture(e.pointerId);page.touchStart(event(e))})
canvas.addEventListener('pointermove',e=>{if(e.pointerId===activePointer){e.preventDefault();page.touchMove(event(e))}})
canvas.addEventListener('pointerup',e=>{if(e.pointerId!==activePointer)return;e.preventDefault();page.touchEnd(event(e,true));activePointer=null;canvas.releasePointerCapture(e.pointerId)})
function cancel(){activePointer=null;page.touchCancel()}
canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',()=>{if(activePointer!==null)cancel()});canvas.addEventListener('contextmenu',e=>e.preventDefault())
window.addEventListener('blur',()=>{if(started){cancel();page.onHide()}});window.addEventListener('focus',()=>{if(started&&!document.hidden)page.onShow()})
document.addEventListener('visibilitychange',()=>{if(!started)return;if(document.hidden){cancel();page.onHide();audioContext?.suspend()}else page.onShow()})
let resizeFrame;window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(started)page.onResize()})})
function notice(t){const n=document.querySelector('#notice');n.textContent=t;n.style.opacity=1;clearTimeout(notice.timer);notice.timer=setTimeout(()=>n.style.opacity=0,2800)}
document.querySelector('#start').onclick=()=>{if(started)return;started=true;unlock();document.querySelector('#welcome').remove();page.onReady();canvas.focus()}
document.querySelector('#help').onclick=()=>{if(started)page.action('help')}
document.querySelector('#full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else{document.body.classList.toggle('focused');page.onResize();notice('双击球台可退出沉浸模式')}}catch{notice('当前浏览器不支持全屏，可横屏游玩')}}
document.addEventListener('fullscreenchange',()=>{document.body.classList.toggle('focused',!!document.fullscreenElement);if(started)page.onResize()})
arena.addEventListener('dblclick',e=>{if(document.body.classList.contains('focused')&&!document.fullscreenElement){document.body.classList.remove('focused');if(started)page.onResize()}})
document.querySelector('#share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href.split('#')[0]);notice('链接已复制，可以发给老师或朋友')}catch{notice('复制浏览器地址栏，即可分享球场')}}
window.addEventListener('keydown',e=>{if(!started)return;if(e.key==='Escape'){cancel();page.action('close');if(document.body.classList.contains('focused')&&!document.fullscreenElement){document.body.classList.remove('focused');page.onResize()}}})
window.addEventListener('pagehide',()=>{if(started)page.onHide()})
// Expose only diagnostics needed for compatibility checks, never player data.
window.orbitStatus=()=>({ready:!!page.g?.ready,placing:!!page.g?.placing,shots:page.g?.shots||0,rotated,width:logicalW,height:logicalH})

})();
