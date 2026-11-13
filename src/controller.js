const P=require('../../physics')
const R=require('./render')
const Rules=require('../../rules')
const Audio=require('../../audio')
const Challenge=require('../../challenge')
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
   this.g.challengeProgress=Challenge.sanitize(null)
   try{this.g.challengeProgress=Challenge.sanitize(wx.getStorageSync('poolChallengeV1'))}catch(e){}
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
  g.challenge=null;g.challengeProgress=g.challengeProgress||Challenge.sanitize(null)
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
 startChallenge(id,intro=true){
  const g=this.g,level=Challenge.get(id)
  if(!level||!g.ready)return
  if(id>Challenge.unlocked(g.challengeProgress)){g.challengeNotice='先完成第 '+Challenge.unlocked(g.challengeProgress)+' 关，再解锁后续';return}
  this.reset('challenge');g.challenge=Challenge.create(id);g.balls=level.balls.map(Challenge.fresh)
  const target=g.balls[1];g.angle=Math.atan2(target.y-g.balls[0].y,target.x-g.balls[0].x)
  g.challengeChapter=level.chapter;g.challengeNotice='';g.challengeSaveFailed=false;g.status=Challenge.objective(level)
  g.panel=intro?'challengeIntro':null;this.preview(true)
 },
 finishChallenge(){
  const g=this.g,state=g.challenge,result=Challenge.finish(state,g.balls,g.shots)
  if(result){
   state.result=result;g.complete=true;g.panel='challengeResult';g.status=result.reason
   if(result.won){g.challengeProgress=Challenge.save(g.challengeProgress,state.level.id,result,g.shots);try{wx.setStorageSync('poolChallengeV1',g.challengeProgress)}catch(e){g.challengeSaveFailed=true;this.notify('本次成绩暂时无法保存')}}
  }else g.status='下一颗：'+state.level.order[state.index]+' 号球 · 剩余 '+(state.level.limit-g.shots)+' 杆'
  this.resetSpin();this.preview()
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
     if(g.challenge)Challenge.record(g.challenge,e)
     if(e.type==='contact')soundFrame.hit=Math.max(soundFrame.hit,e.speed/12)
     if(e.type==='rail'){
      soundFrame.rail=Math.max(soundFrame.rail,e.speed/16)
      if(e.speed>1)g.impacts.push({x:Math.max(0,Math.min(P.W,e.x)),y:Math.max(0,Math.min(P.H,e.y)),at:now,strength:Math.min(1,e.speed/9)})
     }
    })
    for(const n of events){
     const b=g.balls.find(t=>t.n===n)
     g.falls.push({n,x:b.x,y:b.y,at:now});this.play('pocket',.68)
     if(n===0){g.scratch=true;this.notify(g.challenge?'白球落袋 · 本次挑战失败':'白球落袋 · 停稳后可自由摆位')}
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
  if(g.challenge)Challenge.start(g.challenge)
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
  if(g.challenge){this.finishChallenge();return}
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
  if(id==='close'){g.panel=g.complete?(g.challenge?'challenges':'menu'):null;g.spinOpen=false;return}
  if(id==='challenges'){
   if(!g.ready){this.notify('球停稳后可选择关卡');return}
   g.challengeChapter=g.challenge?g.challenge.level.chapter:Math.floor((Challenge.unlocked(g.challengeProgress)-1)/10);g.challengeNotice='';g.panel='challenges';g.spinOpen=false;return
  }
  if(id.startsWith('chapter:')){const n=Number(id.slice(8));if(Number.isInteger(n)&&n>=0&&n<5){g.challengeChapter=n;g.challengeNotice=''}return}
  if(id.startsWith('level:')){this.startChallenge(Number(id.slice(6)));return}
  if(id==='challengeGo'){if(g.challenge&&!g.complete)g.panel=null;return}
  if(id==='challengeRetry'){if(g.challenge)this.startChallenge(g.challenge.level.id,false);return}
  if(id==='challengeNext'){if(g.challenge&&g.challenge.result&&g.challenge.result.won&&g.challenge.level.id<50)this.startChallenge(g.challenge.level.id+1);return}
  if(id==='challengeGoal'){if(g.challenge)g.panel=g.complete?'challengeResult':'challengeIntro';return}
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
   if(g.challenge){if(g.ready)this.startChallenge(g.challenge.level.id,false);return}
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
