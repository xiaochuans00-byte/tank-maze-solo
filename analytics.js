(function(root){'use strict';
const ENDPOINT='https://tank-maze-stats.prettybell11.chatgpt.site';
const dayOf=now=>new Date(now+8*3600000).toISOString().slice(0,10);
function createTracker(options){
 const now=options.now||Date.now,storage=options.storage,uuid=options.uuid,post=options.post;
 let enabled=options.enabled!==false,session=null,pending=null,wasActive=false,ack='';
 function visitor(day){try{const saved=JSON.parse(storage.getItem('tank-stats-visitor')||'null');if(saved?.day===day&&typeof saved.id==='string')return saved.id;const id=uuid();storage.setItem('tank-stats-visitor',JSON.stringify({day,id}));return id;}catch{return uuid();}}
 async function register(s){if(s.token)return true;if(s.registering)return s.registering;s.registering=(async()=>{try{const r=await post('/api/session',{sessionId:s.id,visitorId:s.visitor,device:options.device||'desktop'});if(!r.ok)return false;const data=await r.json();if(typeof data.token!=='string')return false;s.token=data.token;return true;}catch{return false;}finally{s.registering=null;}})();return s.registering;}
 function current(){const day=dayOf(now());if(!session||session.day!==day){if(session)void send(session,true);session={id:uuid(),day,visitor:visitor(day),token:null,registering:null,matches:0,activeMs:0,played:false,seq:0};ack='';}return session;}
 function signature(s){return `${s.id}:${s.matches}:${Math.floor(s.activeMs)}`;}
 async function send(s,beacon=false){if(!enabled||!s?.played)return;if(!await register(s)||!enabled)return;const snapshot=signature(s);if(snapshot===ack)return;const body={token:s.token,seq:++s.seq,matches:s.matches,activeMs:Math.floor(s.activeMs),played:true};try{if(beacon&&options.beacon){if(options.beacon('/api/event',body))return;}const r=await post('/api/event',body);if(r.ok&&s===session)ack=snapshot;if(r.status===401)s.token=null;}catch{}}
 async function flush(beacon=false){if(!enabled||!session)return;if(beacon)return send(session,true);if(pending)return pending;pending=send(session).finally(()=>{pending=null;});return pending;}
 function begin(){if(!enabled)return;const s=current();s.matches++;s.played=true;void flush();}
 function tick(dt,active){if(!enabled)return;const s=current();if(active&&Number.isFinite(dt)&&dt>0){s.played=true;s.activeMs+=Math.min(dt,.08)*1000;}if(wasActive&&!active)void flush();wasActive=active;}
 function setEnabled(value){enabled=!!value;session=null;pending=null;ack='';wasActive=false;if(enabled)void register(current());}
 if(enabled)void register(current());
 return {begin,tick,flush,setEnabled,isEnabled:()=>enabled};
}
if(typeof module==='object'&&module.exports){module.exports={createTracker,dayOf};return;}
const forcedOff=navigator.doNotTrack==='1'||root.doNotTrack==='1'||navigator.globalPrivacyControl===true;
let storedOff=false,safeStorage=null;try{safeStorage=root.localStorage;storedOff=safeStorage.getItem('tank-stats-off')==='1';}catch{}
const live=location.origin==='https://xiaochuans00-byte.github.io'&&location.pathname.startsWith('/tank-maze-solo/');
const stats=createTracker({enabled:live&&!forcedOff&&!storedOff,storage:safeStorage,uuid:()=>crypto.randomUUID(),device:matchMedia('(pointer:coarse)').matches?'mobile':'desktop',post:(path,body)=>fetch(ENDPOINT+path,{method:'POST',credentials:'omit',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body),keepalive:true,signal:AbortSignal.timeout(8000)}),beacon:(path,body)=>navigator.sendBeacon?.(ENDPOINT+path,new Blob([JSON.stringify(body)],{type:'text/plain'}))});
root.TankStats=stats;
setInterval(()=>{void stats.flush();},15000);
addEventListener('pagehide',()=>{void stats.flush(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)void stats.flush(true);});
const button=document.getElementById('stats-toggle');
function label(){if(button){button.textContent=forcedOff?'浏览器已关闭统计':stats.isEnabled()?'关闭匿名统计':'开启匿名统计';button.disabled=forcedOff;}}
if(button)button.onclick=()=>{const enabled=!stats.isEnabled();try{localStorage.setItem('tank-stats-off',enabled?'0':'1');}catch{}stats.setEnabled(enabled&&live);label();};label();
})(typeof window==='object'?window:globalThis);
