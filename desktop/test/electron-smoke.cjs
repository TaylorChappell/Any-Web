'use strict';
const {BrowserWindow,app}=require('electron');const assert=require('node:assert/strict');const http=require('node:http');const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
const {PlayerHost}=require('../lib/player-host.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,timeout=18000){const end=Date.now()+timeout;while(Date.now()<end){if(fn())return;await wait(100);}throw Error('Timed out: '+label);}
async function run(){
 const {PartySync}=await import(pathToFileURL(path.join(__dirname,'../lib/party-sync.mjs')).href);
 const clip=fs.readFileSync(path.join(__dirname,'fixture.webm'));
 const server=http.createServer((req,res)=>{if(req.url==='/fixture.webm'){res.writeHead(200,{'Content-Type':'video/webm','Content-Length':clip.length});res.end(clip);return;}res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><style>body{margin:0;background:black}video{width:640px;height:360px}</style><div id="mv-player"><video src="/fixture.webm" preload="auto" controls></video></div>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const peers=[];let room={id:'fixture-party',epoch:1,position:3,duration:30,playing:false,anchor:Date.now()},heartbeat;
 try{
  for(let i=0;i<2;i++){
   const win=new BrowserWindow({show:true,width:700,height:440,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
   await win.loadURL('about:blank');let peer={win,events:[],ready:false};
   peer.sync=new PartySync({now:Date.now,sendPlayer:(command,time)=>peer.host.command({session:peer.id,command,...(time===undefined?{}:{time})}).catch(()=>{}),sendStatus:s=>{peer.ready=s.ready;},command:()=>{throw Error('A programmatic playback event echoed a party command');}});
   peer.host=new PlayerHost(win,{emit:message=>{if(message.kind==='error')throw Error(message.message);if(message.kind==='status'){peer.events.push(message.data);peer.sync.event(message.data);}},key:()=>{}});
   peer.id='native-fixture-session-'+i;peer.sync.update(room);peers.push(peer);
   await peer.host.open({source:'movish',type:'movie',id:1,season:1,episode:1,start:3,party:true,session:peer.id,origins:[origin],path:'/player/movie/1',url:origin+'/player/movie/1'});
   peer.host.setBounds({session:peer.id,x:0,y:0,width:640,height:360,visible:true});
  }
  heartbeat=setInterval(()=>{for(const p of peers){p.host.command({session:p.id,command:'getStatus'}).catch(()=>{});p.sync.update(room);p.sync.tick(true);}},250);
  await until(()=>peers.every(p=>p.ready),'both real videos automatically prime and pause');
  for(const p of peers){const prefs=p.host.current.view.webContents.getLastWebPreferences();assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.sandbox,true);assert.equal(prefs.webSecurity,true);
   const isolation=await p.host.current.view.webContents.executeJavaScript('({node:typeof require,bridge:typeof globalThis.__ANY_NATIVE_PLAYER__,ipc:typeof window.anyDesktop})');assert.deepEqual(isolation,{node:'undefined',bridge:'undefined',ipc:'undefined'});
  }
  room={...room,playing:true,anchor:Date.now()+600};
  await until(()=>peers.every(p=>p.sync.view().playing&&p.sync.sample.position>4),'both real videos advance on one shared play');
  assert.ok(Math.abs(peers[0].sync.sample.position-peers[1].sync.sample.position)<1.5);
  room={...room,playing:false,position:6,anchor:Date.now()};
  await until(()=>peers.every(p=>!p.sync.sample.playing&&Math.abs(p.sync.sample.position-6)<1.5),'shared pause and seek');
  room={...room,position:12};await until(()=>peers.every(p=>Math.abs(p.sync.sample.position-12)<1.5),'shared forward seek');
  room={...room,position:2};await until(()=>peers.every(p=>Math.abs(p.sync.sample.position-2)<1.5),'shared rewind');
  const p=peers[0],old=p.id,oldView=p.host.current.view;room={...room,epoch:2,position:0};p.id='native-fixture-episode-2';p.sync.update(room);p.ready=false;
  await p.host.open({source:'movish',type:'tv',id:1,season:1,episode:2,start:0,party:true,session:p.id,origins:[origin],path:'/player/tv/1/1/2',url:origin+'/player/tv/1/1/2'});
  p.host.setBounds({session:p.id,x:0,y:0,width:640,height:360,visible:true});
  assert.equal(await p.host.command({session:old,command:'play'}),false);assert.ok(oldView.webContents.isDestroyed());
  await until(()=>p.ready,'new episode gets a fresh native readiness check');
  p.host.close(old);assert.ok(p.host.current,'stale close cannot stop the current episode');p.host.close(p.id);assert.equal(p.host.current,null);
  const report={passed:true,checks:['two real Chromium video decoders','automatic startup','native play and acknowledged pause','shared forward seek and rewind','drift below 1.5 seconds','episode reload and stale-session rejection','source has no Node or desktop IPC','sandbox and web security enabled'],platform:process.platform,electron:process.versions.electron,appVersion:app.getVersion()};
  const output=path.join(app.getPath('temp'),'ANY-desktop-test-result.json');fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{clearInterval(heartbeat);for(const p of peers){p.host.close();p.win.destroy();}await new Promise(r=>server.close(r));}
}
module.exports={run};
