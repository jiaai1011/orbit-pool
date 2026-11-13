// Re-verify existing zone targets after physics changes; preserve player level layouts.
const fs=require('fs'),P=require('../src/physics'),C=require('../src/challenge'),solutions=require('../tests/challenge-solutions.json')
for(const l of C.levels.filter(l=>l.kind==='zone')){
 const original=solutions[l.id-1].shots[0];let found=null
 for(const top of [original.top,-.3,-.5,-.7,-.9,-1,.3,.6,1]){
  for(let percent=10;percent<=95;percent++){
   const shot={...original,top,power:percent/100},state=C.create(l.id),bs=l.balls.map(C.fresh);C.start(state);P.shoot(bs[0],shot.angle,shot.power,shot)
   let ticks=0;while(P.moving(bs)&&ticks++<9000)P.step(bs,.25,null,e=>C.record(state,e))
   const result=C.finish(state,bs,1)
   if(result&&result.won){found=shot;break}
  }
  if(found)break
 }
 if(!found)throw Error('No solution for existing zone '+l.id)
 solutions[l.id-1].shots=[found];console.log('Preserved target and verified level',l.id)
}
fs.writeFileSync('tests/challenge-solutions.json',JSON.stringify(solutions,null,2)+'\n')
