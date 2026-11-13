const assert=require('assert'),fs=require('fs'),path=require('path')
let spec;const store={};const wx={getStorageSync:k=>store[k],setStorageSync:(k,v)=>store[k]=JSON.parse(JSON.stringify(v))},cache={}
function load(id){if(cache[id])return cache[id].exports;const module={exports:{}};cache[id]=module;new Function('require','module','exports','Page','wx',fs.readFileSync(path.join(__dirname,'../src',id+'.js'),'utf8'))(p=>load(path.basename(p).replace('.js','')),module,module.exports,p=>spec=p,wx);return module.exports}
load('controller');const P=load('physics'),R=load('render'),C=load('challenge'),solutions=require('./challenge-solutions.json')
const page={...spec,g:{now:Date.now(),sound:false,assist:true,best:0,spinLabel:()=>page.spinLabel()},L:R.layout(844,390)}
page.reset('rack');page.action('challenges');assert.equal(page.g.panel,'challenges');page.action('level:50');assert(!page.g.challenge);assert(page.g.challengeNotice.includes('先完成'))
for(let id=1;id<=50;id++){
 page.action('level:'+id);assert.equal(page.g.panel,'challengeIntro');assert(!page.g.placing);assert.equal(page.g.canPlace,null);page.action('challengeGo');assert.equal(page.g.panel,null)
 for(const shot of solutions[id-1].shots){
  Object.assign(page.g,{angle:shot.angle,power:shot.power*100,spinX:shot.side||0,spinY:shot.top||0});page.fire();assert(!page.g.ready)
  let t=0;while(P.moving(page.g.balls)&&t++<9000){const pots=P.step(page.g.balls,.25,null,e=>C.record(page.g.challenge,e));for(const n of pots)if(n===0)page.g.scratch=true;else page.g.shotPotted.push(n)}
  page.finish();assert(page.g.ready);assert.equal(page.g.spinX,0);assert.equal(page.g.spinY,0)
 }
 assert(page.g.complete);assert(page.g.challenge.result.won,'controller victory '+id);assert.equal(page.g.panel,'challengeResult');assert(store.poolChallengeV1.records[id]);
}
assert.equal(C.stats(store.poolChallengeV1).stars,150)
page.action('challengeNext');assert.equal(page.g.challenge.level.id,50);page.action('challengeRetry');assert.equal(page.g.shots,0);assert(!page.g.complete);assert.equal(page.g.challenge.index,0)
page.action('undo');assert.equal(page.g.shots,0);assert.equal(page.g.scenario,'challenge')
page.g.power=20;page.fire();page.action('level:1');assert.equal(page.g.challenge.level.id,50,'cannot change moving level')
page.g.balls.forEach(b=>{b.vx=b.vy=b.rx=b.ry=0});page.g.scratch=true;page.g.balls[0].dead=true;page.finish();assert(!page.g.challenge.result.won);assert(!page.g.placing)
page.action('close');assert.equal(page.g.panel,'challenges');page.action('scene:rack');assert(!page.g.challenge);assert(page.g.match);assert(page.g.placing)
const noop=()=>{},gradient={addColorStop:noop},ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)})
for(const dims of [[667,317],[844,332],[766,390],[1280,614]])for(const id of [1,15,25,30,40,50]){
 page.L=R.layout(...dims);page.startChallenge(id)
 for(const panel of ['challenges','challengeIntro',null]){page.g.panel=panel;R.render(ctx,page.g,page.L);assert(page.g.hits.every(h=>[h.x,h.y,h.w,h.h].every(Number.isFinite)));if(!panel){const buttons=page.g.hits.filter(h=>!['power','fine'].includes(h.id));for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i],b=buttons[j];assert(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'bottom controls overlap')}}if(panel)assert(page.g.hits.every(h=>h.x>=0&&h.y>=0&&h.x+h.w<=dims[0]&&h.y+h.h<=dims[1]))}
 page.g.challenge.result={won:true,stars:3,reason:'目标全部完成'};page.g.panel='challengeResult';R.render(ctx,page.g,page.L)
}
console.log('PASS: all 50 through controller fire/finish, spin reset, stars persistence, unlock gate, next/retry/exit, moving guard, scratch failure, layout hit bounds')
