import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePlayerEvent,playerUrl,PartySync,expectedPosition,SOURCES} from '../src/playback.js';
const title={id:1399,media_type:'tv',title:'Test'},frame={};
const event=(patch={},origin='https://vidfast.vc',source=frame)=>({source,origin,data:{type:'PLAYER_EVENT',data:{event:'playerstatus',currentTime:30,duration:1800,tmdbId:1399,mediaType:'tv',season:1,episode:2,playing:false,...patch}}});
test('provider messages require the correct frame, origin, title, episode and finite positions',()=>{assert.ok(parsePlayerEvent(event(),frame,'vidfast',title,1,2)?.controllable);for(const e of [event({},'https://evil.test'),event({},'https://vidfast.vc',{}),event({tmdbId:42}),event({season:2}),event({episode:3}),event({currentTime:NaN}),event({duration:0})])assert.equal(parsePlayerEvent(e,frame,'vidfast',title,1,2),null)});
test('all eight player URLs preserve movie and episode routing and party autoplay is disabled',()=>{assert.equal(SOURCES.length,8);for(const s of SOURCES){const u=new URL(playerUrl(s.id,title,1,2,0,true));assert.match(u.pathname,/tv\/1399\/1\/2$/);assert.equal(u.searchParams.get('autoplay'),'false');assert.equal(u.searchParams.get('autoNext'),'false')}assert.match(playerUrl('movish',{...title,media_type:'movie'},1,1),/\/player\/movie\/1399\?/);assert.throws(()=>playerUrl('movish',title,1,-1))});
function fixture(position=30){
 let now=10000;const sent=[],status=[],commands=[];
 const sync=new PartySync({now:()=>now,sendPlayer:(...v)=>sent.push(v),sendStatus:v=>status.push(v),command:(...v)=>commands.push(v)});
 const p={id:'party',epoch:1,position,duration:1800,anchor:now,playing:false};sync.update(p);
 const sample=(patch={})=>sync.event({event:'playerstatus',position,duration:1800,playing:false,controllable:true,...patch});
 const advance=ms=>now+=ms;
 const prime=()=>{sample();sync.activate();sample({event:'play',playing:true});advance(1000);sample({position:position+1,playing:true});assert.equal(sync.phase,'aligning');sample({position,playing:false});assert.equal(sync.ready,true)};
 return {sync,p,sent,status,commands,sample,advance,prime,now:()=>now};
}
test('metadata and repeated paused status cannot declare a browser ready',()=>{
 const f=fixture();f.sync.tick();f.sample();f.advance(2000);f.sync.tick();
 assert.equal(f.status.at(-1).ready,false);assert.equal(f.status.at(-1).canControl,true);
 assert.equal(f.sync.view().playing,false);assert.equal(f.sync.phase,'start');
});
test('startup verifies moving video and pause before readiness, without broadcasting initial play',()=>{
 const f=fixture();f.prime();assert.equal(f.status.at(-1).ready,true);assert.deepEqual(f.commands,[]);
 f.sync.update({...f.p,playing:true,anchor:f.now()+600});f.sync.tick();assert.equal(f.sent.at(-1)[0],'pause');
 f.advance(700);f.sync.tick();assert.equal(f.sent.at(-1)[0],'play');
 f.sample({event:'play',playing:true});assert.equal(f.commands.length,0);
 f.advance(2000);f.sample({event:'pause',position:32,playing:false});assert.equal(f.commands.at(-1)[0],'pause');
 f.sync.update({...f.p,epoch:2});f.sync.tick();assert.equal(f.sync.ready,false);assert.equal(f.sync.protocol,false);
});
test('native iframe play can unlock startup without a parent-page click',()=>{
 const f=fixture();f.sample();f.sample({event:'play',playing:true});f.advance(1000);f.sample({playing:true,position:31});
 assert.equal(f.sent.at(-1)[0],'pause');f.sample({playing:false});assert.equal(f.sync.ready,true);assert.deepEqual(f.commands,[]);
});
test('ignored startup play is reported as blocked, never ready',()=>{
 const f=fixture();f.sample();f.sync.activate();
 for(let i=0;i<14;i++){f.advance(1000);f.sample();f.sync.tick()}
 assert.equal(f.sync.phase,'blocked');assert.equal(f.status.at(-1).ready,false);assert.equal(f.status.at(-1).buffering,true);
 f.advance(2000);f.sample();f.sync.tick();assert.equal(f.sync.ready,false,'a paused response cannot clear the failure');
});
test('a play event or seek jump alone cannot prove playback',()=>{
 const f=fixture();f.sample();f.sync.activate();f.sample({event:'play',playing:true});f.advance(1000);f.sample({event:'seeked',position:500,playing:true});
 assert.equal(f.sync.ready,false);assert.equal(f.sync.primed,false);
 f.advance(1000);f.sample({position:900,playing:true});assert.equal(f.sync.primed,false);
});
test('a player that ignores pause never joins the room',()=>{
 const f=fixture();f.sample();f.sync.activate();f.sample({playing:true});
 for(let i=0;i<15;i++){f.advance(1000);f.sample({position:31+i,playing:true});f.sync.tick()}
 assert.equal(f.sync.ready,false);assert.equal(f.status.at(-1).ready,false);
});
test('startup aligns the actual paused video with the room before reporting ready',()=>{
 const f=fixture(80);f.sample({position:10});f.sync.activate();f.sample({position:10,playing:true});f.advance(1000);f.sample({position:11,playing:true});f.sample({position:11,playing:false});
 assert.equal(f.sync.ready,false);f.advance(2100);f.sync.tick();assert.deepEqual(f.sent.at(-1),['seek',80]);
 f.sample({event:'seeked',position:80});assert.equal(f.sync.ready,true);assert.deepEqual(f.commands,[]);
});
test('ignored remote play freezes readiness even if seek correction changes the position',()=>{
 const f=fixture();f.prime();f.sync.update({...f.p,playing:true,anchor:f.now()});f.sync.tick();
 for(let i=0;i<7;i++){f.advance(1000);f.sample({position:30+i,playing:false});f.sync.tick()}
 assert.equal(f.sync.ready,false);assert.equal(f.sync.phase,'blocked');assert.equal(f.sync.view().playing,false);
 assert.equal(f.status.at(-1).buffering,true);
 f.sync.update({...f.p,playing:false});f.sample();f.sync.tick();assert.equal(f.sync.ready,false);
});
test('fresh advancing playback follows remote seeks and pause without echo',()=>{
 const f=fixture();f.prime();f.sync.update({...f.p,playing:true,anchor:f.now()});f.sync.tick();
 f.sample({playing:true});f.advance(1000);f.sample({position:31,playing:true});f.sync.tick();assert.equal(f.sync.view().playing,true);
 f.sync.update({...f.p,playing:true,position:80,anchor:f.now()});f.advance(2100);f.sample({position:33,playing:true});f.sync.tick();assert.equal(f.sent.at(-1)[0],'seek');
 f.sample({event:'seeked',position:82,playing:true});assert.deepEqual(f.commands,[]);
 f.sync.update({...f.p,position:82,playing:false});f.sync.tick();assert.equal(f.sent.at(-1)[0],'pause');
 f.sample({event:'pause',position:82,playing:false});assert.deepEqual(f.commands,[]);
});
test('disconnect, stale telemetry and reload discard readiness',()=>{
 for(const cause of ['disconnect','stale','reload']){
  const f=fixture();f.prime();
  if(cause==='disconnect')f.sync.tick(false);
  else if(cause==='stale'){f.advance(6500);f.sync.tick()}
  else{f.sync.reset();f.sync.report(true,true);assert.equal(f.sync.sample,null);assert.equal(f.sync.protocol,false)}
  assert.equal(f.sync.ready,false);assert.equal(f.sync.view().playing,false);
 }
 assert.equal(expectedPosition({position:10,duration:30,playing:true,anchor:11000},10000),10);
});
