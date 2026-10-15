'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createTracker,dayOf}=require('./analytics.js');
function setup(enabled=true){let clock=Date.parse('2026-10-15T12:00:00Z'),id=0;const sent=[],store=new Map();const tracker=createTracker({enabled,now:()=>clock,uuid:()=>`id-${++id}`,storage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},post:async(path,body)=>{sent.push({path,body:structuredClone(body)});return {ok:true,status:200,json:async()=>({token:'signed-test-token'})};}});return {tracker,sent,store,setTime:value=>{clock=value;}};}
test('starts are cumulative; pauses do not accrue time; retries preserve totals',async()=>{
 const {tracker,sent}=setup();tracker.begin();await tracker.flush();
 for(let i=0;i<50;i++)tracker.tick(.02,true);
 tracker.tick(.02,false);await tracker.flush();
 for(let i=0;i<50;i++)tracker.tick(.02,false);
 tracker.begin();await tracker.flush();
 const messages=sent.filter(x=>x.path==='/api/event').map(x=>x.body);
 assert.equal(messages.at(-1).matches,2);assert.equal(messages.at(-1).activeMs,1000);assert.equal(messages.at(-1).played,true);
 const before=messages.length;await tracker.flush();assert.equal(sent.filter(x=>x.path==='/api/event').length,before);
});
test('opt-out suppresses registration and events and remains safe without storage',async()=>{
 const {tracker,sent}=setup(false);tracker.begin();tracker.tick(.05,true);await tracker.flush();assert.equal(sent.length,0);
 tracker.setEnabled(true);tracker.begin();await tracker.flush();assert(sent.length>0);
 tracker.setEnabled(false);const n=sent.length;tracker.begin();await tracker.flush();assert.equal(sent.length,n);
 const noStorage=createTracker({enabled:true,uuid:()=>crypto.randomUUID(),post:async()=>({ok:false}),storage:null});noStorage.begin();await noStorage.flush();
});
test('midnight rotates browser identifiers and does not invent another match',async()=>{
 const {tracker,sent,setTime}=setup();tracker.begin();await tracker.flush();
 setTime(Date.parse('2026-10-15T16:00:01Z'));tracker.tick(.05,true);await tracker.flush();
 const sessions=sent.filter(x=>x.path==='/api/session');assert.equal(sessions.length,2);
 assert.notEqual(sessions[0].body.visitorId,sessions[1].body.visitorId);
 const last=sent.filter(x=>x.path==='/api/event').at(-1).body;assert.equal(last.matches,0);assert.equal(last.activeMs,50);
 assert.equal(dayOf(Date.parse('2026-10-15T16:00:01Z')),'2026-10-16');
});
