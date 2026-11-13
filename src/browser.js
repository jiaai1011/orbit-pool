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
