const P=require('../../physics')
const renderCaches=new WeakMap()
const Rules=require('../../rules')
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
