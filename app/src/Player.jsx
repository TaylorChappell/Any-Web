import React,{useEffect,useRef,useState} from 'react';
import {api} from './api.js';
import {desktopBridge,desktopPartySource,desktopPartySupported,nativePlayerEvent} from './desktop.js';
import {titleOf,progressValue,clock,images} from './model.js';
import {sourceById,SOURCES,playerUrl,parsePlayerEvent,PartySync,originsFor,browserPartySource} from './playback.js';
import {useAsync,go} from './catalogue.jsx';
import {watchLink,Episodes} from './Details.jsx';
import {Avatar,Button,Spinner,Modal,Empty} from './ui.jsx';
export function PlayerPage({type,id,params,settings,onError}){const [reload,setReload]=useState(0);const partyId=params.get('party'),party=api.parties.find(p=>p.id===partyId),source=party?.source||params.get('source')||settings.source,s=party?.season||Math.max(1,Number(params.get('s'))||1),e=party?.episode||Math.max(1,Number(params.get('e'))||1),epoch=party?.epoch||0;const title=useAsync(()=>api.tmdb(`${type}/${id}`).then(t=>titleOf(t,type)),[type,id]);useEffect(()=>{if(!partyId)return;return()=>{api.command('leave',{partyId}).catch(()=>{})}},[partyId]);if(title.loading)return <div className="page-loader"><Spinner/></div>;if(title.error)return <Empty title="Playback unavailable">{title.error}</Empty>;if(partyId&&!party)return <Empty title="Finding your party…">{api.status==='Connected'?'If the invitation has ended, return to Together.':'Waiting to reconnect to ANY.'}<Button onClick={()=>go('/together')}>Together</Button></Empty>;const member=party?.members.find(m=>m.profileId===api.profile);if(party&&(party.ended||!member?.onThisDevice||member.status!=='joined'))return <Empty title="You’re no longer in this party"><Button onClick={()=>go('/together')}>Back to Together</Button></Empty>;if(party&&!(desktopBridge()?desktopPartySupported(source):sourceById(source).controls))return <Empty title="Switch this party to a web-compatible source"><Button onClick={()=>go('/together')}>Choose source & join</Button></Empty>;return <Player key={`${id}:${source}:${s}:${e}:${epoch}:${reload}`} onReload={()=>setReload(v=>v+1)} title={title.data} source={source} season={s} episode={e} party={party} settings={settings} position={party?party.position:Number(params.get('pos'))||0} onError={onError}/>}
function Player({title,source,season,episode,party,position,onError,onReload}) {
 const desktop=desktopBridge(),nativeSession=useRef(crypto.randomUUID()),stage=useRef();
 const iframe=useRef(),root=useRef(),sync=useRef(),partyRef=useRef(party);
 const statsRef=useRef({position:0,duration:0,playing:false}),origin=useRef(sourceById(source).base);
 const learnedOrigin=useRef(false),protocol=useRef(false),probe=useRef(0),resume=useRef(false),lastSave=useRef(0),lastProgress=useRef(null);
 const [stats,setStats]=useState(statsRef.current),[controls,setControls]=useState(true),[episodes,setEpisodes]=useState(false);
 const [selectedSeason,setSelectedSeason]=useState(season),[ready,setReady]=useState(false),[waited,setWaited]=useState(false);
 const [loadFailed,setLoadFailed]=useState(false),[confirmed,setConfirmed]=useState(false),[switching,setSwitching]=useState(''),[busy,setBusy]=useState(false);
 const [local,setLocal]=useState({phase:'loading',ready:false,playing:false});
 partyRef.current=party;
 const src=sourceById(source),url=useRef(playerUrl(source,title,season,episode,position,!!party));
 const save=()=>{const data=lastProgress.current;if(!data)return;lastProgress.current=null;api.change('progress',data.key,data).catch(e=>onError(e.message))};
 const sendPlayer=(command,time)=>{
  if(desktop){desktop.playerCommand({session:nativeSession.current,command,...(time===undefined?{}:{time})}).catch(()=>{});return;}
  if(!src.controls)return;
  // Only probe documented origins after a redirect. Playback commands use the
  // origin learned from validated messages from this exact iframe.
  const target=command==='getStatus'&&!learnedOrigin.current?[src.base,...originsFor(src).filter(o=>o!==src.base)][probe.current++%originsFor(src).length]:origin.current;
  iframe.current?.contentWindow?.postMessage({command,...(time===undefined?{}:{time})},target);
 };
 const command=async(action,fields={})=>{
  try {
   const p=partyRef.current;
   if(p)await api.command(action,{partyId:p.id,epoch:p.epoch,...fields});
   else if(action==='seek')sendPlayer('seek',fields.position);
   else if(action==='restart')sendPlayer('seek',0);
   else if(action==='skip')sendPlayer('seek',Math.max(0,statsRef.current.position+fields.delta));
   else sendPlayer(action);
  }catch(e){onError(e.message)}
 };
 const activate=()=>{sync.current?.activate();if(sync.current)setLocal(sync.current.view());setControls(true)};
 const frameLoaded=()=>{sendPlayer('getStatus');if(sync.current?.phase==='loading'){sync.current.activate();setLocal(sync.current.view())}};
 const reload=()=>{
  if(sync.current){sync.current.reset();sync.current.report(true,true)}
  onReload(); // New iframe and handshake; no stale sample or protocol survives.
 };
 useEffect(()=>{
  if(party){sync.current=new PartySync({sendPlayer,sendStatus:data=>api.send(data),command,now:()=>api.serverNow()});sync.current.update(party);if(api.ws?.readyState===1)sync.current.activate();sync.current.tick(api.ws?.readyState===1)}
  const receiveData=data=>{
   if(!data)return;
   if(data.episodeChanged){sync.current?.block();onError('The source changed episode. Use ANY’s episode controls or reload the player.');return;}
   origin.current=data.origin;learnedOrigin.current=true;setReady(true);if(data.controllable)protocol.current=true;
   const next={...statsRef.current,...data,playing:data.playing??statsRef.current.playing};statsRef.current=next;setStats(next);setLoadFailed(false);
   if(!party&&data.duration>0&&data.controllable&&!resume.current){resume.current=true;if(position>0)sendPlayer('seek',position)}
   if(sync.current){sync.current.update(partyRef.current);sync.current.event(data);setLocal(sync.current.view())}
   if(data.duration>0&&(!party||sync.current?.ready)&&(data.position>0||data.playing===true||data.event==='ended')){
    lastProgress.current=progressValue(title,title.media_type==='tv'?season:0,title.media_type==='tv'?episode:0,data.position,data.duration,data.event==='ended');
    if(Date.now()-lastSave.current>=10000||['pause','ended'].includes(data.event)){lastSave.current=Date.now();save()}
   }
  };
  const receive=event=>receiveData(parsePlayerEvent(event,iframe.current?.contentWindow,source,title,season,episode));
  const unsubscribe=desktop?.onPlayerEvent(message=>{if(message.session!==nativeSession.current)return;if(message.kind==='error'){setLoadFailed(true);sync.current?.block();if(sync.current)setLocal(sync.current.view());onError(message.message);return;}receiveData(nativePlayerEvent(message,nativeSession.current));});
  if(!desktop)window.addEventListener('message',receive);
  if(desktop)desktop.openPlayer({session:nativeSession.current,source,type:title.media_type,id:title.id,season,episode,position,party:!!party}).then(()=>{window.dispatchEvent(new Event('resize'));sendPlayer('getStatus');}).catch(error=>{setLoadFailed(true);onError(error.message);});
  const tick=()=>{
   if(sync.current&&partyRef.current){sync.current.update(partyRef.current);sync.current.tick(api.ws?.readyState===1);setLocal(sync.current.view())}
   if(desktop||src.controls)sendPlayer('getStatus');
  };
  tick();const timer=setInterval(tick,desktop?250:1000),warning=setTimeout(()=>setWaited(true),18000);
  const visibility=()=>{if(document.hidden)save()};document.addEventListener('visibilitychange',visibility);
  return()=>{unsubscribe?.();if(desktop)desktop.closePlayer(nativeSession.current).catch(()=>{});window.removeEventListener('message',receive);clearInterval(timer);clearTimeout(warning);document.removeEventListener('visibilitychange',visibility);save();sync.current=null};
 },[]);
 useEffect(()=>{
  const key=e=>{
   if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
   if(e.key==='Escape'){e.preventDefault();if(episodes)setEpisodes(false);else if(!desktop&&controls)setControls(false);else go(`/${title.media_type}/${title.id}`)}
   else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();setControls(true)}
   else if((e.key===' '||e.key==='Enter')&&e.target.tagName!=='BUTTON'){
    e.preventDefault();if(partyRef.current&&!sync.current?.ready)activate();
    else if(protocol.current)command(statsRef.current.playing?'pause':'play');
   }else if(protocol.current&&(!partyRef.current||sync.current?.ready)&&['ArrowLeft','ArrowRight'].includes(e.key)&&e.target.tagName!=='BUTTON'){
    e.preventDefault();command('skip',{delta:e.key==='ArrowLeft'?-10:10});
   }
  };window.addEventListener('keydown',key);const off=desktop?.onPlayerKey(message=>{if(message.session===nativeSession.current)key({key:message.key,target:root.current,preventDefault:()=>{}});});return()=>{off?.();window.removeEventListener('keydown',key);};
 },[controls,episodes]);
 useEffect(()=>{
  if(!desktop||!stage.current)return;
  const resize=()=>{const r=stage.current.getBoundingClientRect();desktop.setPlayerBounds({session:nativeSession.current,x:r.x,y:r.y,width:r.width,height:r.height,visible:!episodes&&!switching&&!confirmed&&!document.hidden}).catch(()=>{});};
  const observer=new ResizeObserver(resize);observer.observe(stage.current);resize();
  window.addEventListener('resize',resize);document.addEventListener('visibilitychange',resize);window.addEventListener('scroll',resize,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',resize);window.removeEventListener('scroll',resize,true);};
 },[episodes,switching,confirmed]);
 const playing=party?local.playing:stats.playing,positionNow=stats.position;
 const member=party?.members.find(m=>m.profileId===api.profile);
 const canControl=stats.duration>0&&protocol.current&&(!party||(local.ready&&member?.ready))&&api.status==='Connected';
 const waiting=party&&(!local.ready||!member?.ready),showHelp=loadFailed||(waited&&(!ready||waiting))||local.phase==='blocked';
 const failureText=loadFailed?`${src.name} could not load its player.`:
  local.failure==='no-response'?`${src.name} has not returned a player connection. Reload or choose another party source.`:
  local.failure==='no-media'?`${src.name} connected, but has not loaded a video for this title. Try another party source.`:
  local.failure==='start-failed'?`${src.name} returned video details, but playback did not advance. The source may be buffering or the browser may require Play inside the video.`:
  local.failure==='alignment'?`${src.name} played, but did not confirm pause or seek at the party position. Try another party source.`:
  local.failure==='stalled'?`${src.name} stopped advancing or reporting playback. The party is paused while this player recovers.`:
  !protocol.current?`Waiting for ${src.name} to return its player connection. If it stays blank, reload or choose another party source.`:
  !stats.duration?`${src.name} connected, but has not loaded the video yet.`:
  `Waiting for ${src.name} to confirm moving video and playback controls.`;
 const waitingText=api.status!=='Connected'?'Reconnecting — the party is paused.':member?.error&&protocol.current?member.error:
  local.phase==='blocked'?failureText:
  local.phase==='aligning'?'Matching this video to the party…':
  local.phase==='starting'?'Starting the video automatically…':
  local.ready?'Video ready. Waiting for the party…':`Connecting to ${src.name}… The video will start automatically.`;
 async function playEpisode(s,e){if(party)await command('episode',{season:s,episode:e});else go(watchLink(title,{season:s,episode:e,source}));setEpisodes(false)}
 return <main className={"player-page"+(desktop?" desktop-player":"")} ref={root} tabIndex={0}>
  <div className="player-top"><Button icon="left" aria-label="Leave player" onClick={()=>go(`/${title.media_type}/${title.id}`)}/><div><h1>{title.title}</h1><span>{title.media_type==='tv'?`Season ${season} · Episode ${episode} · `:''}{party?'Together · ':''}{`Source ${SOURCES.indexOf(src)+1} · ${src.name}`}</span></div><Button icon="expand" aria-label="Fullscreen" onClick={()=>{if(desktop){desktop.fullscreen().catch(()=>onError('Fullscreen is unavailable.'));return;}if(document.fullscreenElement)document.exitFullscreen?.();else root.current?.requestFullscreen?.().catch(()=>onError('Fullscreen is unavailable in this browser.'))}}/></div>
  <div className="video-stage" ref={stage}>{desktop?<div className="native-player-placeholder"><Spinner/><span>Loading {src.name}…</span></div>:<iframe ref={iframe} src={url.current} title={`${title.title} player`} allow="autoplay; fullscreen; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen onLoad={frameLoaded} onError={()=>setLoadFailed(true)}/>}</div>
  {(controls||waiting)&&<div className="player-controls">
   {party&&!party.playing&&<div className="party-presence">{party.members.filter(m=>m.status==='joined').map(m=><div key={m.profileId}><Avatar id={m.profile?.avatar} size={38}/><span>{m.profile?.name}<small>{m.error||(!m.connected?'Reconnecting':m.ready?m.buffering?'Buffering':'Ready':'Waiting for video')}</small></span></div>)}</div>}
   {waiting&&<div className="party-start" role="status"><p>{waitingText}</p>{local.phase==='blocked'&&local.failure==='start-failed'&&<Button tone="red" icon="play" disabled={api.status!=='Connected'} onClick={activate}>Retry playback</Button>}</div>}
   <div className="timeline"><span>{clock(positionNow)}</span><input aria-label="Playback position" type="range" min="0" max={stats.duration||1} step="1" value={Math.min(positionNow,stats.duration||1)} disabled={!canControl} onChange={e=>command('seek',{position:Number(e.target.value)})}/><span>{clock(stats.duration)}</span></div>
   <div className="player-actions">
    <Button icon={playing?'pause':'play'} disabled={!canControl} aria-label={playing?'Pause':'Play'} onClick={()=>command(playing?'pause':'play')}/>
    <Button disabled={!canControl} onClick={()=>command('skip',{delta:-10})}>−10s</Button><Button disabled={!canControl} onClick={()=>command('skip',{delta:10})}>+10s</Button><Button icon="restart" disabled={!canControl} aria-label="Start over" onClick={()=>command('restart')}/>
    {title.media_type==='tv'&&<Button onClick={()=>setEpisodes(true)}>Episodes</Button>}<span className="spacer"/>
    <select aria-label={party?'Party source':'Playback source'} value={source} disabled={busy} onChange={e=>party?setSwitching(e.target.value):go(watchLink(title,{season,episode,source:e.target.value,position:stats.position}))}>
     {SOURCES.filter(s=>!party||((desktop?desktopPartySupported(s.id):s.controls)&&api.sources.includes(s.id))).map(s=><option key={s.id} value={s.id}>Source {SOURCES.indexOf(s)+1} · {s.name}</option>)}
    </select>{!desktop&&<Button onClick={()=>setControls(false)}>Hide controls</Button>}
   </div>
   <p className="player-note">{party?(playing?(desktop?'Playing on this computer':'Playing on this browser'):waiting?(desktop?'Waiting for this computer’s video':'Waiting for this browser’s video'):party.playing?'Starting party playback…':party.desiredPlaying?'Waiting for everyone’s video':'Party paused'):!desktop&&!src.controls?'Use the video’s own playback controls. This source does not offer remote browser controls.':!protocol.current?'Use the video’s controls while ANY waits for its control connection.':'Space: play / pause · Left / right: skip · Up / down: controls · Esc: hide controls, then leave'}</p>
   {showHelp&&<div className="playback-help"><p>{party?failureText:src.progress?'No playback status received yet. If the video is blank, try another source or reload the player.':'This source does not report playback to ANY. Automatic watch-history tracking is unavailable.'}</p><div className="actions"><Button onClick={reload}>Reload player</Button>{!party&&<><a className="button" href={url.current} target="_blank" rel="noopener noreferrer">Open source ↗</a><Button onClick={()=>setConfirmed(true)}>Mark as watched</Button></>}</div></div>}
  </div>}
  {!controls&&!waiting&&<Button className="show-controls" onClick={()=>setControls(true)}>Show controls</Button>}
  {switching&&<Modal title="Change the party source?" onClose={()=>setSwitching('')}><p>Switch everyone to {sourceById(switching).name}. The party pauses and each player reloads at the same position. Everyone stays in the party.</p><Button tone="red" disabled={busy} onClick={async()=>{setBusy(true);try{await api.command('join',{partyId:party.id,source:switching});setSwitching('')}catch(e){onError(e.message)}finally{setBusy(false)}}}>Switch source for everyone</Button></Modal>}
  {episodes&&<Modal wide title="Choose an episode" onClose={()=>setEpisodes(false)}><Episodes title={title} season={selectedSeason} onSeason={setSelectedSeason} onPlay={playEpisode}/></Modal>}
  {confirmed&&<Modal title="Mark as watched?" onClose={()=>setConfirmed(false)}><p>This marks {title.media_type==='tv'?`season ${season}, episode ${episode}`:title.title} complete in this profile’s history.</p><Button tone="red" onClick={()=>{const value=progressValue(title,title.media_type==='tv'?season:0,title.media_type==='tv'?episode:0,stats.duration||title.runtime*60,stats.duration||title.runtime*60,true);api.change('progress',value.key,value);setConfirmed(false)}}>Mark watched</Button></Modal>}
 </main>;
}
export function Together({onError}){
 const [transfer,setTransfer]=useState(null),[switching,setSwitching]=useState(null),[busy,setBusy]=useState(false);
 const desktop=desktopBridge(),compatible=desktop?desktopPartySource(api.sources):browserPartySource(api.sources);
 async function join(p,force=false,source){setBusy(true);try{
  await api.command('join',{partyId:p.id,transfer:force,...(source?{source}:{})});
  const current=api.parties.find(x=>x.id===p.id)||p;
  go(watchLink(current.title,{season:current.season,episode:current.episode,source:source||current.source,party:p.id,position:current.position}));setTransfer(null);setSwitching(null);
 }catch(e){if(e.status===409&&/another device/i.test(e.message)){setSwitching(null);setTransfer({party:p,source})}else onError(e.message)}finally{setBusy(false)}}
 function open(p){if(desktop?desktopPartySupported(p.source):sourceById(p.source).controls)join(p);else setSwitching(p)}
 return <div className="page"><p className="eyebrow">SAME FILM. SAME MOMENT.</p><h1>Together</h1><p className="page-subtitle">Invite another profile from any title. TV, desktop and web can join the same party.</p>{!api.parties.length?<Empty title="Your next movie night starts here">Open a film or series, select the friends icon and invite another profile.</Empty>:<div className="party-grid">{api.parties.map(p=>{const me=p.members.find(m=>m.profileId===api.profile),host=p.members.find(m=>m.profileId===p.ownerId),supported=desktop?desktopPartySupported(p.source):sourceById(p.source).controls;return <article className="party-card" key={p.id}><div className="party-art" style={{backgroundImage:`url("${images(p.title.backdrop_path,'w780')}")`}}><span className="pill">{me?.status==='invited'?'You’re invited':'Movie night'}</span></div><div className="party-copy"><h2>{p.title.title}</h2><p>With {host?.profile?.name||'your friends'}{p.title.media_type==='tv'?` · S${p.season} E${p.episode}`:''}</p><div className="party-avatars">{p.members.filter(m=>['joined','invited'].includes(m.status)).map(m=><span key={m.profileId} title={`${m.profile?.name} · ${m.status}`}><Avatar id={m.profile?.avatar} size={38}/></span>)}</div>{!supported&&<p className="muted">Join on web by switching everyone to a compatible source. The party stays together and opens paused.</p>}<div className="actions"><Button icon="people" tone="red" disabled={busy} onClick={()=>open(p)}>{me?.status==='invited'?'Join party':'Return to party'}</Button>{me?.status==='invited'&&<Button disabled={busy} onClick={()=>api.command('decline',{partyId:p.id}).catch(e=>onError(e.message))}>Decline</Button>}</div></div></article>})}</div>}
 {switching&&<Modal title={desktop?"Change source to join?":"Join this party on web?"} onClose={()=>setSwitching(null)}><p>Switch everyone from {sourceById(switching.source).name} to {sourceById(compatible||'vidfast').name}. Playback pauses at the current position while each player reloads. Your invitations and episode stay the same.</p>{!compatible&&<p>No compatible source is enabled on the backend. Retry the connection in Settings.</p>}<Button tone="red" disabled={busy||!compatible} onClick={()=>join(switching,false,compatible)}>Switch source & join</Button></Modal>}
 {transfer&&<Modal title="Move this profile here?" onClose={()=>setTransfer(null)}><p>This profile is watching on another device. Continuing here will disconnect that device from the party.</p><Button tone="red" disabled={busy} onClick={()=>join(transfer.party,true,transfer.source)}>Watch here</Button></Modal>}</div>
}
