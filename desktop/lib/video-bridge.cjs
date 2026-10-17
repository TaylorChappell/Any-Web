'use strict';
// Runs in an isolated JavaScript world in the source's top-level WebContents.
// It never exposes Node, IPC, filesystem access or an arbitrary script evaluator.
function installVideoBridge(config){
 if(!config.origins.includes(location.origin)||location.pathname!==config.path||window.top!==window)return false;
 if(globalThis.__ANY_NATIVE_PLAYER__?.session===config.session)return true;
 let video=null,restored=false,episodeChanged=false,pending=[],lastProgress=0,error=null;
 // Keep this function identical in the TV and desktop bridges (covered by tests).
 function createCaptionGuard(){
  const watched=new WeakSet();
  // Movish uses Vidstack's own tracks/DOM, not HTMLVideoElement.textTracks.
  // Hide only caption surfaces and caption controls; never the picture, audio,
  // loading/error messages, source selection or general settings.
  const css=`video::cue{color:transparent!important;background:transparent!important;text-shadow:none!important;opacity:0!important}
  media-captions,.vds-captions,.jw-captions,.vjs-text-track-display,.plyr__captions,.shaka-text-container,.art-subtitle,.dplayer-subtitle,
  media-caption-button,.vds-caption-button,.jw-icon-cc,.vjs-subs-caps-button,[data-plyr="captions"],.shaka-caption-button,
  #mv-settings [data-tab="subs"],#mv-settings [data-tab="style"],#mv-tab-subs,#mv-tab-style{display:none!important;visibility:hidden!important;pointer-events:none!important}`;
  function disable(list){
   if(!list)return;
   try{for(const t of Array.from(list))if(['subtitles','captions'].includes(t.kind)&&t.mode!=='disabled')t.mode='disabled';}catch{}
   if(!watched.has(list)){
    watched.add(list);
    for(const event of ['addtrack','change','add','mode-change'])list.addEventListener?.(event,()=>disable(list));
   }
  }
  return function enforce(root){
   const doc=root.ownerDocument||root;
   let sheet=root.querySelector('#any-captions-off');
   if(!sheet){const parent=root.head||root.documentElement||(root.nodeType===11?root:null);if(!parent)return;sheet=doc.createElement('style');sheet.id='any-captions-off';parent.appendChild(sheet);}
   if(sheet.textContent!==css)sheet.textContent=css;
   for(const media of root.querySelectorAll('video,media-player')){
    disable(media.textTracks);
    for(const track of media.querySelectorAll('track[kind="subtitles"],track[kind="captions"],track:not([kind])'))if(track.hasAttribute('default'))track.removeAttribute('default');
   }
   // Vidstack/custom elements can render captions in open shadow roots.
   for(const host of root.querySelectorAll('media-player,media-provider,media-video-layout,media-captions'))if(host.shadowRoot)enforce(host.shadowRoot);
  };
 }
 const captionsOff=createCaptionGuard();
 const subtitleTracks=()=>Array.from(video?.textTracks||[]).map((t,index)=>({t,index})).filter(({t})=>['subtitles','captions'].includes(t.kind)).slice(0,32);
 const bound=new WeakSet();
 const layout=new Map();let layoutVideo=null,layoutParent=null;
 function style(node,values){
  if(!node?.style)return;
  let saved=layout.get(node);if(!saved){saved=new Map();layout.set(node,saved);}
  for(const [key,value] of Object.entries(values)){
   if(!saved.has(key))saved.set(key,{value:node.style.getPropertyValue(key),priority:node.style.getPropertyPriority(key)});
   node.style.setProperty(key,value,'important');saved.get(key).ours=node.style.getPropertyValue(key);
  }
 }
 function clearLayout(){
  for(const [node,properties]of layout)for(const [key,old]of properties)if(node.style.getPropertyValue(key)===old.ours){if(old.value)node.style.setProperty(key,old.value,old.priority);else node.style.removeProperty(key);}
  layout.clear();layoutVideo=null;layoutParent=null;
 }
 function fitVideo(v){
  // Wait for actual media so provider loading, source-choice and error screens
  // remain usable. Resize the existing player; never move/recreate the video.
  if(v.readyState<1||!Number.isFinite(v.duration)||v.duration<=0)return;
  if(layoutVideo===v&&layoutParent===v.parentElement){for(const [node,properties]of layout)for(const [key,saved]of properties)if(node.style.getPropertyValue(key)!==saved.ours||node.style.getPropertyPriority(key)!=='important')node.style.setProperty(key,saved.ours,'important');return;}
  clearLayout();layoutVideo=v;layoutParent=v.parentElement;
  const viewport={position:'fixed',top:'0px',right:'0px',bottom:'0px',left:'0px',width:'100vw',height:'100vh','min-width':'0px','min-height':'0px','max-width':'none','max-height':'none',margin:'0px',padding:'0px',border:'0px','box-sizing':'border-box','aspect-ratio':'auto',transform:'none'};
  const reset={transform:'none',filter:'none',perspective:'none',contain:'none','content-visibility':'visible','clip-path':'none',overflow:'visible'};
  const doc=v.ownerDocument,container=v.closest('#mv-player,.video-js,.jwplayer,.plyr')||v.parentElement;
  for(let node=container;node;node=node.parentElement)style(node,reset);
  style(doc.documentElement,{margin:'0px',padding:'0px',width:'100%',height:'100%',overflow:'hidden',background:'#000'});
  style(doc.body,{margin:'0px',padding:'0px',width:'100%',height:'100%',overflow:'hidden',background:'#000'});
  style(container,{...viewport,'z-index':'2147483000',background:'#000'});
  for(let node=v.parentElement;node&&node!==container;node=node.parentElement)style(node,{...reset,position:'static','aspect-ratio':'auto','max-width':'none','max-height':'none',padding:'0px'});
  style(v,{...viewport,position:'absolute',width:'100%',height:'100%','object-fit':'contain','object-position':'50% 50%',background:'#000'});
  // The bridge only inspects same-origin child documents. Expand their frames
  // too, otherwise an inner full-size video can still sit in a small iframe.
  let child=doc.defaultView;
  while(child&&child!==window){let frame;try{frame=child.frameElement}catch{break}if(!frame)break;for(let node=frame.parentElement;node;node=node.parentElement)style(node,reset);style(frame,{...viewport,'z-index':'2147483000'});child=frame.ownerDocument.defaultView;}
 }
 function docs(root,depth=0){const list=[root];if(depth<3)for(const frame of root.querySelectorAll('iframe')){try{if(frame.contentDocument)list.push(...docs(frame.contentDocument,depth+1))}catch{}}return list;}
 function snapshot(event='playerstatus'){
  const v=video,duration=v&&Number.isFinite(v.duration)&&v.duration>0?v.duration:0,position=v&&Number.isFinite(v.currentTime)?Math.max(0,Math.min(v.currentTime,duration)):0;
  return {event,position,duration,playing:!!v&&!v.paused&&!v.ended,playable:!!v&&restored&&!episodeChanged&&!v.seeking&&v.readyState>=3,controllable:!!v&&!episodeChanged,mediaLoaded:duration>0,buffering:!!v&&v.readyState<3,episodeChanged,error,subtitles:subtitleTracks().map(({t,index})=>({index,label:t.label||t.language||`Subtitles ${index+1}`,language:t.language||"",selected:t.mode==="showing"}))};
 }
 function report(event){if(event==='timeupdate'&&Date.now()-lastProgress<250)return;lastProgress=Date.now();pending.push(snapshot(event));if(pending.length>16)pending.shift();}
 function restore(v){
  if(restored||episodeChanged||v!==video||!Number.isFinite(v.duration)||v.duration<=0)return;
  try{v.currentTime=Math.max(0,Math.min(config.start,v.duration-.25));restored=true;if(config.party)v.pause();else{v.muted=false;Promise.resolve(v.play()).catch(()=>{error='play-rejected';});}}catch{}
 }
 function bind(){
  const all=docs(document);for(const doc of all)captionsOff(doc);const area=v=>{const r=v.getBoundingClientRect();return r.width*r.height;};
  const next=all.map(d=>d.querySelector('#mv-player video')).find(Boolean)||all.flatMap(d=>Array.from(d.querySelectorAll('video'))).filter(v=>area(v)>=14400).sort((a,b)=>area(b)-area(a))[0];
  if(!next){if(video&&!video.isConnected){video=null;restored=false;clearLayout();}return;}
  if(next!==video){video=next;restored=false;error=null;}
  if(!bound.has(next)){
   bound.add(next);if(config.party)next.pause();
   for(const name of ['playing','pause','seeked','ended','timeupdate'])next.addEventListener(name,()=>{if(next!==video)return;restore(next);report(name==='playing'?'play':name);});
   for(const name of ['loadedmetadata','canplay'])next.addEventListener(name,()=>restore(next));
   next.addEventListener('error',()=>{if(next===video)error='media-error';});
  }
  restore(next);fitVideo(next);
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
    else if(command==='subtitle'){if(time!==-1)return false;for(const doc of docs(document))captionsOff(doc);}
    else if(command==='seek'&&Number.isFinite(time)&&Number.isFinite(video.duration))video.currentTime=Math.max(0,Math.min(video.duration,time));
    else return false;return true;
   }catch{return false;}
  }
 };
 bind();return true;
}
module.exports={installVideoBridge};
