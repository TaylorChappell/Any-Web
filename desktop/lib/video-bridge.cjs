'use strict';
// Runs in an isolated JavaScript world in the source's top-level WebContents.
// It never exposes Node, IPC, filesystem access or an arbitrary script evaluator.
function installVideoBridge(config){
 if(!config.origins.includes(location.origin)||location.pathname!==config.path||window.top!==window)return false;
 if(globalThis.__ANY_NATIVE_PLAYER__?.session===config.session)return true;
 let video=null,restored=false,episodeChanged=false,pending=[],lastProgress=0,error=null;
 const bound=new WeakSet();
 function docs(root,depth=0){const list=[root];if(depth<3)for(const frame of root.querySelectorAll('iframe')){try{if(frame.contentDocument)list.push(...docs(frame.contentDocument,depth+1))}catch{}}return list;}
 function snapshot(event='playerstatus'){
  const v=video,duration=v&&Number.isFinite(v.duration)&&v.duration>0?v.duration:0,position=v&&Number.isFinite(v.currentTime)?Math.max(0,Math.min(v.currentTime,duration)):0;
  return {event,position,duration,playing:!!v&&!v.paused&&!v.ended,playable:!!v&&restored&&!episodeChanged&&!v.seeking&&v.readyState>=3,controllable:!!v&&!episodeChanged,mediaLoaded:duration>0,buffering:!!v&&v.readyState<3,episodeChanged,error};
 }
 function report(event){if(event==='timeupdate'&&Date.now()-lastProgress<250)return;lastProgress=Date.now();pending.push(snapshot(event));if(pending.length>16)pending.shift();}
 function restore(v){
  if(restored||episodeChanged||v!==video||!Number.isFinite(v.duration)||v.duration<=0)return;
  try{v.currentTime=Math.max(0,Math.min(config.start,v.duration-.25));restored=true;if(config.party)v.pause();else{v.muted=false;Promise.resolve(v.play()).catch(()=>{error='play-rejected';});}}catch{}
 }
 function bind(){
  const all=docs(document),area=v=>{const r=v.getBoundingClientRect();return r.width*r.height;};
  const next=all.map(d=>d.querySelector('#mv-player video')).find(Boolean)||all.flatMap(d=>Array.from(d.querySelectorAll('video'))).filter(v=>area(v)>=14400).sort((a,b)=>area(b)-area(a))[0];
  if(!next){if(video&&!video.isConnected){video=null;restored=false;}return;}
  if(next!==video){video=next;restored=false;error=null;}
  if(!bound.has(next)){
   bound.add(next);if(config.party)next.pause();
   for(const name of ['playing','pause','seeked','ended','timeupdate'])next.addEventListener(name,()=>{if(next!==video)return;restore(next);report(name==='playing'?'play':name);});
   for(const name of ['loadedmetadata','canplay'])next.addEventListener(name,()=>restore(next));
   next.addEventListener('error',()=>{if(next===video)error='media-error';});
  }
  restore(next);
 }
 window.addEventListener('message',event=>{
  if(config.source!=='movish'||event.source!==window||event.origin!==location.origin)return;
  let data=event.data;if(typeof data==='string'){try{data=JSON.parse(data)}catch{return}}
  if(!data||!['movish:episode','movish:progress'].includes(data.type)||Number(data.tmdbId)!==config.id||config.type!=='tv')return;
  if(Number.isSafeInteger(Number(data.season))&&Number.isSafeInteger(Number(data.episode))&&(Number(data.season)!==config.season||Number(data.episode)!==config.episode)){episodeChanged=true;video?.pause();}
 });
 globalThis.__ANY_NATIVE_PLAYER__={session:config.session,
  poll(){bind();const events=pending.splice(0);events.push(snapshot());return events;},
  control(command,time){bind();if(command==='getStatus')return true;if(!video||episodeChanged)return false;
   try{if(command==='play'){video.muted=false;error=null;Promise.resolve(video.play()).catch(()=>{error='play-rejected';});}
    else if(command==='pause')video.pause();
    else if(command==='seek'&&Number.isFinite(time)&&Number.isFinite(video.duration))video.currentTime=Math.max(0,Math.min(video.duration,time));
    else return false;return true;
   }catch{return false;}
  }
 };
 bind();return true;
}
module.exports={installVideoBridge};
