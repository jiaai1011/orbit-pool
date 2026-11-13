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
