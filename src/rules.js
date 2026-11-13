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
