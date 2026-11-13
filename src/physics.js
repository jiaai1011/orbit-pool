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
  const power=Math.max(0,Math.min(1,p)),tipY=Math.max(-1,Math.min(1,m.top||0)),tipX=Math.max(-1,Math.min(1,m.side||0))
  const top=tipY*1.6,side=tipX*1.2
  // Power is calibrated to launch speed, not a fixed total kinetic-energy budget.
  // The old energy split removed 34% of draw speed before cloth drag even began.
  // Allow a small off-centre loss; cloth friction alone then wears off backspin.
  const v=powerSpeed(power)*(m.breakShot?1+.8*power*power:1)*(1-.08*Math.min(1,tipY*tipY+tipX*tipX))*(m.lift?.85:1)
  b.vx=Math.cos(a)*v;b.vy=Math.sin(a)*v;b.ax=Math.cos(a);b.ay=Math.sin(a)
  b.rx=b.ax*v*top;b.ry=b.ay*v*top;b.wz=side*v
  b.drawApproach=b.n===0&&tipY<0&&!m.lift&&!m.bend
  b.side=m.side||0;b.bend=(m.bend||0)*flip;b.age=0;b.z=0
  b.vz=m.lift&&power>0?1.8+power*.3:0
}
function friction(b,dt){
  if(b.dead||b.z>0)return
  b.rx=b.rx||0;b.ry=b.ry||0;b.wz=b.wz||0
  const dx=b.vx-b.rx,dy=b.vy-b.ry,slip=Math.hypot(dx,dy)
  let left=dt
  if(slip>1e-8){
    // A game-feel assist for a level draw stroke: gentler drag on the approach,
    // then full cloth coupling after the first object-ball or cushion impact.
    // Scale continuously as backspin wears away; never add a reverse impulse.
    const speed=Math.hypot(b.vx,b.vy),back=speed>1e-8?Math.max(0,-(b.rx*b.vx+b.ry*b.vy)/(speed*speed)):0
    const drag=SLIDE*(b.drawApproach?1-.72*Math.min(1,back/.3):1)
    const sliding=Math.min(dt,slip/(3.5*drag)),j=drag*sliding,x=dx/slip*j,y=dy/slip*j
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
  b.drawApproach=false
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
      a.drawApproach=b.drawApproach=false
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
      if(impulse>1e-8)a.drawApproach=b.drawApproach=false
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
