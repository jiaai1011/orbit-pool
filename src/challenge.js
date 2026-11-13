const levels=require('./levels')
const chapters=[{name:'初见球感',sub:'直球 · 薄球 · 指定袋',color:'#6ce8ec'},{name:'白球走位',sub:'停球 · 高低杆 · 落区控制',color:'#9ee8ae'},{name:'折线思维',sub:'目标球翻袋 · 白球一库解球',color:'#e8be77'},{name:'连贯清台',sub:'按序进球 · 留好下一杆',color:'#c3a0ff'},{name:'大师试炼',sub:'多球残局 · 黑八收官',color:'#ff9b92'}]
const fresh=([n,x,y])=>({n,x,y,vx:0,vy:0,rx:0,ry:0,wz:0,z:0,vz:0,side:0,dead:false})
function get(id){return levels[id-1]||null}
function create(id){const level=get(id);return level?{level,index:0,shot:null,result:null}:null}
function start(state){state.shot={first:null,cueRails:0,kick:false,rails:{},error:null,pots:[]};return state.shot}
function record(state,e){
 const s=state.shot,l=state.level;if(!s)return
 const expected=l.order[state.index]
 if(e.type==='rail'){s.rails[e.n]=(s.rails[e.n]||0)+1;if(e.n===0&&s.first===null)s.cueRails++}
 if(e.type==='contact'&&s.first===null&&(e.a===0||e.b===0)){
  s.first=e.a===0?e.b:e.a;s.kick=s.cueRails>0
  if(s.first!==expected)s.error='先碰了 '+s.first+' 号球，应先碰 '+expected+' 号球'
 }
 if(e.type==='pocket'){
  s.pots.push(e.n)
  if(e.n===0){s.error='白球落袋，本次挑战失败';return}
  if(e.n!==expected){s.error='进球顺序错误：下一颗应为 '+expected+' 号球';return}
  const pocket=l.pockets&&l.pockets[e.n]
  if(pocket!=null&&pocket!==e.pocket)s.error=e.n+' 号球进错袋，请打入金色目标袋'
  if(l.kind==='bank'&&!(s.rails[e.n]>0))s.error='目标球需要先碰库，再进袋'
  if(l.kind==='kick'&&!s.kick)s.error='白球需要先碰库，再碰目标球'
  state.index++
 }
}
function finish(state,balls,shots){
 const l=state.level,s=state.shot||{},cue=balls[0]
 let reason=s.error
 if(cue.dead)reason='白球落袋，本次挑战失败'
 const all=state.index>=l.order.length
 if(!reason&&all&&l.zone&&Math.hypot(cue.x-l.zone.x,cue.y-l.zone.y)>l.zone.r)reason='球已进袋，但白球未停进绿色目标区'
 if(reason)return {won:false,reason,stars:0}
 if(all)return {won:true,reason:'目标全部完成',stars:shots<=l.par?3:shots<=l.par+1?2:1}
 if(shots>=l.limit)return {won:false,reason:'杆数用完，还有 '+(l.order.length-state.index)+' 颗目标球',stars:0}
 return null
}
function sanitize(raw){const out={records:{}};if(raw&&raw.records&&typeof raw.records==='object')for(let id=1;id<=50;id++){const r=raw.records[id];if(r&&Number.isInteger(r.stars)&&r.stars>=1&&r.stars<=3&&Number.isInteger(r.shots)&&r.shots>=1&&r.shots<=get(id).limit)out.records[id]={stars:r.stars,shots:r.shots}}return out}
function unlocked(progress){let n=1;while(n<50&&progress.records[n])n++;return n}
function save(progress,id,result,shots){if(!result.won)return progress;const p=sanitize(progress),old=p.records[id];p.records[id]={stars:Math.max(old?old.stars:0,result.stars),shots:Math.min(old?old.shots:Infinity,shots)};return p}
function stats(p){const rows=Object.values(p.records);return {cleared:rows.length,stars:rows.reduce((n,r)=>n+r.stars,0),unlocked:unlocked(p)}}
function objective(l){const route=l.order.join(' → ');return l.kind==='zone'?'进球，并让白球停进绿色区域':l.kind==='bank'?'目标球至少碰库一次，再进指定袋':l.kind==='kick'?'白球先碰库，再将目标球打进指定袋':l.order.length>1?'按顺序清台：'+route:l.pockets?'将 '+route+' 号球打进金色目标袋':'将 '+route+' 号球打进任意袋'}
module.exports={levels,chapters,get,create,fresh,start,record,finish,sanitize,unlocked,save,stats,objective}
