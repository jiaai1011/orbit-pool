// Offline authoring: layouts are accepted only after real-physics witness shots.
const fs=require('fs'),P=require('../src/physics')
const fresh=([n,x,y])=>({n,x,y,vx:0,vy:0,rx:0,ry:0,wz:0,z:0,vz:0,side:0,dead:false})
const clone=x=>JSON.parse(JSON.stringify(x))
function simulate(balls,shot){const bs=clone(balls),events=[];P.shoot(bs[0],shot.angle,shot.power,{top:shot.top||0,side:shot.side||0});let ticks=0;while(P.moving(bs)&&ticks++<9000)P.step(bs,.25,null,e=>events.push(e));return {bs,events,settled:ticks<9000}}
function ghost(c,b,p){const d=Math.hypot(p[0]-b.x,p[1]-b.y),x=b.x-(p[0]-b.x)/d*11,y=b.y-(p[1]-b.y)/d*11;return Math.atan2(y-c.y,x-c.x)}
function solve(balls,n,kind,pocket,top=0){
 const cue=balls[0],obj=balls.find(b=>b.n===n),targets=pocket==null?[0,2,3,5,1,4]:[pocket]
 for(const k of targets){const pk=P.pockets[k],base=ghost(cue,obj,pk);let angles=[]
  if(kind==='bank')for(const axis of ['top','bottom','left','right']){const mirror=axis==='top'?[pk[0],11-pk[1]]:axis==='bottom'?[pk[0],357-pk[1]]:axis==='left'?[11-pk[0],pk[1]]:[709-pk[0],pk[1]];angles.push(ghost(cue,obj,mirror))}
  else if(kind==='kick'){
   const d=Math.hypot(pk[0]-obj.x,pk[1]-obj.y),g=[obj.x-(pk[0]-obj.x)/d*11,obj.y-(pk[1]-obj.y)/d*11]
   for(const q of [[g[0],11-g[1]],[g[0],357-g[1]],[11-g[0],g[1]],[709-g[0],g[1]]])angles.push(Math.atan2(q[1]-cue.y,q[0]-cue.x))
  }else angles=[base]
  for(const a of angles)for(const off of [0,.003,-.003,.008,-.008,.016,-.016,.03,-.03,.05,-.05])for(const power of [.12,.2,.3,.4,.55,.7,.9]){
   const shot={angle:a+off,power,top},sim=simulate(balls,shot),pots=sim.events.filter(e=>e.type==='pocket'),hit=sim.events.find(e=>e.type==='contact'&&(e.a===0||e.b===0));
   if(!sim.settled||sim.bs[0].dead||!hit||(hit.a===0?hit.b:hit.a)!==n||pots.length!==1||pots[0].n!==n||pots[0].pocket!==k)continue
   const end=sim.events.indexOf(pots[0]),contact=sim.events.indexOf(hit)
   if(kind==='bank'&&!sim.events.slice(0,end).some(e=>e.type==='rail'&&e.n===n))continue
   if(kind==='kick'&&!sim.events.slice(0,contact).some(e=>e.type==='rail'&&e.n===0))continue
   return {shot,sim,pocket:k}
  }
 }
 return null
}
const levels=[],witness=[]
function add(l,solutions){l.id=levels.length+1;l.chapter=Math.floor((l.id-1)/10);l.par=l.order.length;l.limit=l.par+2;levels.push(l);witness.push({id:l.id,shots:solutions});console.log('Validated',l.id,l.name)}
const basicNames=['第一颗星','轻推入袋','直线延伸','跨过半台','切入角度','反向薄球','中袋准星','长台定点','贴近库边','准度毕业']
for(let i=0;i<10;i++){
 const k=[2,5,0,3,2,5,1,0,5,2][i],pk=P.pockets[k],ob=i===6?[180,48]:[pk[0]===0?45+i*2:pk[0]===360?315-i*2:180,pk[1]<20?32+i*2:152-i*2]
 const d=Math.hypot(ob[0]-pk[0],ob[1]-pk[1]),u=[(ob[0]-pk[0])/d,(ob[1]-pk[1])/d],gap=30+i*7,cut=i<4?0:(i%2?1:-1)*(8+i*2)
 const cue=[ob[0]+u[0]*gap-u[1]*cut,ob[1]+u[1]*gap+u[0]*cut],layout=[[0,...cue],[1,...ob]],s=solve(layout.map(fresh),1,'pot',k)
 if(!s)throw Error('basic '+i);add({name:basicNames[i],kind:'pot',balls:layout,order:[1],...(i>=6?{pockets:{1:k}}:{}),tip:i<4?'沿瞄准线轻推；白球落袋会失败。':'瞄准目标球的接触点，用右侧滚轮细调。'},[s.shot])
}
const posNames=['停在光圈','轻柔留位','高杆跟进','直线追球','低杆回拉','拉回半步','低杆左塞','低杆右塞','远距回拉','控球毕业']
for(let i=0;i<10;i++){
 const pk=i%2?5:2,ob=[272-(i%3)*14-i*1.5,i%2?133-i:51+i],p=P.pockets[pk],d=Math.hypot(p[0]-ob[0],p[1]-ob[1]),u=[(p[0]-ob[0])/d,(p[1]-ob[1])/d],gap=i===8?110:i===9?85:38+(i%3)*14,layout=[[0,ob[0]-u[0]*gap,ob[1]-u[1]*gap],[1,...ob]],top=i<2?-.2:i<4?.8:-.9
 let choice=null
 const bs=layout.map(fresh),angle=ghost(bs[0],bs[1],p)
 for(const power of i<2?[.16,.2,.26,.34]:i<4?[.2,.26,.34,.4,.5]:[.4,.5,.65,.8,.95]){const shot={angle,power,top,side:i===6?-.35:i===7?.35:0},sim=simulate(bs,shot);const travel=(sim.bs[0].x-(ob[0]-u[0]*11))*u[0]+(sim.bs[0].y-(ob[1]-u[1]*11))*u[1];if((i<2||i<4&&travel>28||i>=4&&travel<-28)&&sim.bs[1].dead&&!sim.bs[0].dead&&sim.bs[0].x>25&&sim.bs[0].x<335&&sim.bs[0].y>25&&sim.bs[0].y<159){choice={shot,sim};break}}
 if(!choice)throw Error('zone '+i)
 const b=choice.sim.bs[0],r=i<4?23:i<8?19:15
 add({name:posNames[i],kind:'zone',balls:layout,order:[1],zone:{x:+b.x.toFixed(1),y:+b.y.toFixed(1),r},tip:i<2?'控制力度，让进球后的白球留在光圈内。':i<4?'可尝试高杆，让白球碰球后继续向前。':'可尝试低杆；距离越远，越需要保留倒旋的出杆力度。'},[choice.shot])
}
const banks=[[[0,100,100],[1,190,64]],[[0,260,90],[1,170,124]],[[0,90,150],[1,155,90]],[[0,270,40],[1,215,100]],[[0,65,90],[1,150,60]]]
for(let i=0;i<5;i++){let sol=solve(banks[i].map(fresh),1,'bank');if(!sol)throw Error('bank '+i);add({name:['第一次翻袋','反向折返','斜线翻袋','长库折射','翻袋毕业'][i],kind:'bank',balls:banks[i],order:[1],pockets:{1:sol.pocket},tip:'让目标球先撞库边，再反弹进金色目标袋；直接进袋不算。'},[sol.shot])}
const kicks=[[[0,100,100],[1,300,40]],[[0,250,100],[1,50,140]],[[0,100,75],[1,290,135]],[[0,260,75],[1,60,40]],[[0,140,120],[1,270,55]]]
for(let i=0;i<5;i++){let sol=solve(kicks[i].map(fresh),1,'kick');if(!sol)throw Error('kick '+i);add({name:['先借一库','绕路进球','对侧解球','远台借库','折线毕业'][i],kind:'kick',balls:kicks[i],order:[1],pockets:{1:sol.pocket},tip:'白球先碰库，再碰目标球。看反射角，用力度控制第二段路程。'},[sol.shot])}
const spots=[[315,32],[47,144],[306,146],[45,37],[180,30]]
for(let i=0;i<20;i++){
 const master=i>=10,j=i%10,count=master?3+Math.floor(j/4):2+Math.floor(j/5),offset=i%5
 const layout=[[0,110+(i%4)*30,80+(i%3)*12]]
 for(let n=1;n<=count;n++){const s=spots[(n-1+offset)%5];layout.push([master&&n===count?8:n,s[0]+((i%3)-1)*4,s[1]+((i%2)*2-1)*3])}
 let bs=layout.map(fresh),solutions=[],order=layout.slice(1).map(b=>b[0]),finalPocket=null
 for(const n of order){const s=solve(bs,n,'pot');if(!s)throw Error('sequence '+i+' ball '+n);solutions.push(s.shot);bs=s.sim.bs;finalPocket=s.pocket}
 add({name:master?['黑八初试','两翼收官','三角残局','反向收尾','四球接力','精准衔接','转台控球','终点黑八','五球连奏','轨道大师'][j]:['双球接力','两端奔袭','换边走位','先近后远','双球毕业','三球连线','绕台一圈','留住角度','顺序思考','清台毕业'][j],kind:'order',balls:layout,order,...(master&&j>=4?{pockets:{8:finalPocket}}:{}),tip:master?'按编号顺序进球，最后打黑八；有金色目标袋时，黑八必须进该袋。':'先碰并打进高亮目标球，再继续下一颗；提前进后面的球会失败。'},solutions)
}
fs.writeFileSync('src/levels.js','// 50 fixed, physics-validated challenge layouts.\nmodule.exports='+JSON.stringify(levels,null,2)+'\n')
fs.writeFileSync('tests/challenge-solutions.json',JSON.stringify(witness,null,2)+'\n')
console.log('All 50 levels have a verified, scratch-free solution')
