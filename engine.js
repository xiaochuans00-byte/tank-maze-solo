(function(root){
'use strict';
const CELL=56,COLS=14,ROWS=10,W=COLS*CELL,H=ROWS*CELL,RADIUS=11.5,THICK=5;
const COLORS=['#a9d77e','#ee9970','#81b9e9'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
function hitCircle(x,y,r,wall){const px=clamp(x,wall.x,wall.x+wall.w),py=clamp(y,wall.y,wall.y+wall.h);return (x-px)**2+(y-py)**2<r*r;}
function makeMaze(seed){
 const rnd=random(seed),cells=Array.from({length:COLS*ROWS},()=>({n:true,e:true,s:true,w:true})),seen=new Set([0]),stack=[0];
 const dirs=[['n',0,-1,'s'],['e',1,0,'w'],['s',0,1,'n'],['w',-1,0,'e']];
 while(stack.length){const cur=stack[stack.length-1],x=cur%COLS,y=Math.floor(cur/COLS),available=dirs.filter(d=>x+d[1]>=0&&x+d[1]<COLS&&y+d[2]>=0&&y+d[2]<ROWS&&!seen.has(cur+d[1]+d[2]*COLS));if(!available.length){stack.pop();continue;}const d=available[Math.floor(rnd()*available.length)],next=cur+d[1]+d[2]*COLS;cells[cur][d[0]]=false;cells[next][d[3]]=false;seen.add(next);stack.push(next);}
 for(let i=0;i<cells.length;i++){if(i%COLS<COLS-1&&rnd()<.22){cells[i].e=false;cells[i+1].w=false;}if(i<COLS*(ROWS-1)&&rnd()<.22){cells[i].s=false;cells[i+COLS].n=false;}}
 const walls=[{x:0,y:0,w:W,h:THICK},{x:0,y:H-THICK,w:W,h:THICK},{x:0,y:0,w:THICK,h:H},{x:W-THICK,y:0,w:THICK,h:H}];
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const c=cells[y*COLS+x];if(c.e&&x<COLS-1)walls.push({x:(x+1)*CELL-THICK/2,y:y*CELL-THICK/2,w:THICK,h:CELL+THICK});if(c.s&&y<ROWS-1)walls.push({x:x*CELL-THICK/2,y:(y+1)*CELL-THICK/2,w:CELL+THICK,h:THICK});}
 return {cells,walls,seed};
}
function neighbors(maze,index){const c=maze.cells[index],a=[];if(!c.n)a.push(index-COLS);if(!c.e)a.push(index+1);if(!c.s)a.push(index+COLS);if(!c.w)a.push(index-1);return a;}
function path(maze,from,to){if(from===to)return [from];const queue=[from],prev=new Map([[from,-1]]);for(let j=0;j<queue.length;j++){const i=queue[j];for(const n of neighbors(maze,i)){if(prev.has(n))continue;prev.set(n,i);if(n===to){const out=[to];let p=i;while(p!==-1){out.unshift(p);p=prev.get(p);}return out;}queue.push(n);}}return[];}
function cellAt(x,y){return clamp(Math.floor(y/CELL),0,ROWS-1)*COLS+clamp(Math.floor(x/CELL),0,COLS-1);}
function advanceBullet(b,dt,walls){
 b.x+=b.vx*dt;b.y+=b.vy*dt;let reflected=false;
 for(const w of walls){if(!hitCircle(b.x,b.y,b.r,w))continue;let nx=b.x-clamp(b.x,w.x,w.x+w.w),ny=b.y-clamp(b.y,w.y,w.y+w.h),len=Math.hypot(nx,ny);
  if(len<1e-7){const sides=[{d:Math.abs(b.x-w.x),x:-1,y:0},{d:Math.abs(b.x-w.x-w.w),x:1,y:0},{d:Math.abs(b.y-w.y),x:0,y:-1},{d:Math.abs(b.y-w.y-w.h),x:0,y:1}];sides.sort((a,c)=>a.d-c.d);nx=sides[0].x;ny=sides[0].y;len=0;b.x+=nx*(b.r+sides[0].d+.03);b.y+=ny*(b.r+sides[0].d+.03);}
  else {nx/=len;ny/=len;b.x+=nx*(b.r-len+.03);b.y+=ny*(b.r-len+.03);}
  const dot=b.vx*nx+b.vy*ny;if(dot<0){b.vx-=2*dot*nx;b.vy-=2*dot*ny;b.bounces++;reflected=true;}
 }return reflected;
}
class Game{
 constructor(options={}){this.mode=options.mode||'solo';this.goal=options.goal||5;this.pickupsEnabled=options.pickups!==false;this.seed=options.seed??Date.now();this.scores=[0,0,0];this.round=0;this.onEvent=()=>{};this.newRound();}
 newRound(){this.round++;this.maze=makeMaze(this.seed+this.round*7919);this.rnd=random(this.seed+this.round*101);this.bullets=[];this.particles=[];this.pickups=[];this.time=0;this.finished=false;this.settling=0;this.result=null;this.nextPickup=4;this.tanks=[];const spawn=[{x:1.5*CELL,y:1.5*CELL,a:0},{x:(COLS-1.5)*CELL,y:(ROWS-1.5)*CELL,a:Math.PI},{x:(COLS-1.5)*CELL,y:1.5*CELL,a:Math.PI/2}];for(let i=0;i<(this.mode==='trio'?3:2);i++)this.tanks.push({id:i,...spawn[i],alive:true,cooldown:0,shield:0,weapon:null,charges:0,ai:this.mode==='solo'&&i===1,aiTimer:0,aiPath:[],aiFire:0,track:0});}
 clearAt(x,y,r=RADIUS,ignore=-1){return !this.maze.walls.some(w=>hitCircle(x,y,r,w))&&!this.tanks.some(t=>t.alive&&t.id!==ignore&&Math.hypot(t.x-x,t.y-y)<r+RADIUS);}
 move(t,speed,dt){const dx=Math.cos(t.a)*speed*dt,dy=Math.sin(t.a)*speed*dt;if(this.clearAt(t.x+dx,t.y,RADIUS,t.id))t.x+=dx;if(this.clearAt(t.x,t.y+dy,RADIUS,t.id))t.y+=dy;t.track+=speed*dt;}
 shoot(t){if(!t.alive||t.cooldown>0)return false;const active=this.bullets.filter(b=>b.owner===t.id).length,spread=t.weapon==='spread',count=spread?3:1,limit=t.weapon==='rapid'?9:5;if(active+count>limit)return false;t.cooldown=t.weapon==='rapid'?.115:spread?.55:.24;for(let i=0;i<count;i++){const a=t.a+(spread?(i-1)*.19:0),speed=spread?225:190;this.bullets.push({x:t.x+Math.cos(a)*16,y:t.y+Math.sin(a)*16,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:2.6,owner:t.id,life:spread?5:10,age:0,bounces:0,trail:[]});}if(t.weapon&&--t.charges<=0)t.weapon=null;this.emit('fire',t);return true;}
 emit(type,data){this.onEvent({type,data});}
 burst(x,y,color,amount=24){for(let i=0;i<amount;i++){const a=this.rnd()*Math.PI*2,s=25+this.rnd()*145;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+this.rnd()*.55,max:.85,color,size:1+this.rnd()*3});}}
 hit(t,b){if(t.shield>0){t.shield=0;b.dead=true;this.burst(t.x,t.y,'#7ecce4',15);this.emit('shield',t);return;}t.alive=false;b.dead=true;this.burst(t.x,t.y,COLORS[t.id]);this.emit('death',t);}
 ai(t,dt){
  const target=this.tanks.filter(o=>o.alive&&o.id!==t.id).sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y))[0];if(!target)return{};
  t.aiTimer-=dt;t.aiFire-=dt;if(t.aiTimer<=0){t.aiTimer=.3;t.aiPath=path(this.maze,cellAt(t.x,t.y),cellAt(target.x,target.y));}
  let tx=target.x,ty=target.y;const cur=cellAt(t.x,t.y),cx=(cur%COLS+.5)*CELL,cy=(Math.floor(cur/COLS)+.5)*CELL;
  if(t.aiPath.length>1){if(Math.hypot(t.x-cx,t.y-cy)>8){tx=cx;ty=cy;}else{const n=t.aiPath[1];tx=(n%COLS+.5)*CELL;ty=(Math.floor(n/COLS)+.5)*CELL;}}
  let desired=Math.atan2(ty-t.y,tx-t.x),diff=angle(desired-t.a);let threat=null;for(const b of this.bullets){if(b.owner===t.id&&!b.bounces)continue;const dx=t.x-b.x,dy=t.y-b.y,proj=(dx*b.vx+dy*b.vy)/(b.vx*b.vx+b.vy*b.vy);if(proj>0&&proj<.6&&Math.hypot(dx-b.vx*proj,dy-b.vy*proj)<21){threat=b;break;}}
  if(threat){desired=Math.atan2(threat.vy,threat.vx)+Math.PI/2;diff=angle(desired-t.a);}
  let turn=Math.abs(diff)>.065?Math.sign(diff):0,forward=Math.abs(diff)<.6?1:0,fire=false;
  if(t.aiFire<=0){t.aiFire=.25+this.rnd()*.2;const probe={x:t.x+Math.cos(t.a)*16,y:t.y+Math.sin(t.a)*16,vx:Math.cos(t.a)*190,vy:Math.sin(t.a)*190,r:2.6,bounces:0};for(let i=0;i<230;i++){advanceBullet(probe,1/120,this.maze.walls);if(Math.hypot(probe.x-target.x,probe.y-target.y)<16){fire=true;break;}if(probe.bounces&&Math.hypot(probe.x-t.x,probe.y-t.y)<17)break;}if(!fire&&this.rnd()<.015)fire=true;}
  return{turn,move:forward,fire};
 }
 spawnPickup(){if(this.pickups.length>=3)return;for(let k=0;k<40;k++){const c=Math.floor(this.rnd()*COLS*ROWS),x=(c%COLS+.5)*CELL,y=(Math.floor(c/COLS)+.5)*CELL;if(this.tanks.some(t=>t.alive&&Math.hypot(x-t.x,y-t.y)<CELL*1.5)||this.pickups.some(p=>Math.hypot(p.x-x,p.y-y)<CELL))continue;this.pickups.push({x,y,type:['rapid','spread','shield'][Math.floor(this.rnd()*3)],life:18});return;}}
 step(dt,inputs={}){
  for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;p.vy*=.985;}this.particles=this.particles.filter(p=>p.life>0);if(this.finished)return;
  this.time+=dt;for(const t of this.tanks){t.cooldown=Math.max(0,t.cooldown-dt);t.shield=Math.max(0,t.shield-dt);if(!t.alive)continue;const input=t.ai?this.ai(t,dt):(inputs[t.id]||{});t.a=angle(t.a+(input.turn||0)*3.8*dt);if(input.move)this.move(t,input.move>0?105:-84,dt);if(input.fire)this.shoot(t);}
  for(const b of this.bullets){b.age+=dt;b.life-=dt;if(b.life<=0){b.dead=true;continue;}if(b.trail.length>6)b.trail.shift();b.trail.push({x:b.x,y:b.y});const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/1.6));for(let i=0;i<steps&&!b.dead;i++){if(advanceBullet(b,dt/steps,this.maze.walls))this.emit('bounce',b);for(const t of this.tanks){if(!t.alive||(t.id===b.owner&&b.age<.1&&!b.bounces))continue;if(Math.hypot(b.x-t.x,b.y-t.y)<RADIUS+b.r){this.hit(t,b);break;}}}}
  this.bullets=this.bullets.filter(b=>!b.dead);
  if(this.pickupsEnabled){this.nextPickup-=dt;if(this.nextPickup<=0){this.nextPickup=4+this.rnd()*3;this.spawnPickup();}for(const p of this.pickups){p.life-=dt;for(const t of this.tanks){if(t.alive&&Math.hypot(t.x-p.x,t.y-p.y)<23){p.life=0;if(p.type==='shield')t.shield=6;else{t.weapon=p.type;t.charges=p.type==='rapid'?20:4;}this.emit('pickup',{tank:t,type:p.type});break;}}}this.pickups=this.pickups.filter(p=>p.life>0);}
  const alive=this.tanks.filter(t=>t.alive);if(alive.length<=1){this.settling+=dt;if(!alive.length||this.settling>=.85){this.finished=true;const winner=alive[0]?.id??null;if(winner!==null)this.scores[winner]++;this.result={winner,matchWinner:winner!==null&&this.scores[winner]>=this.goal?winner:null};this.emit('round',this.result);}}else this.settling=0;
 }
}
const api={Game,makeMaze,path,neighbors,cellAt,advanceBullet,hitCircle,random,CELL,COLS,ROWS,W,H,RADIUS,COLORS};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TankEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
