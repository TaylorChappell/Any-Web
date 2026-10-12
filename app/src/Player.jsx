import React,{useEffect,useRef,useState} from 'react';
import {api} from './api.js';
import {titleOf,progressValue,clock,images} from './model.js';
import {sourceById,SOURCES,playerUrl,parsePlayerEvent,PartySync,originsFor,browserPartySource} from './playback.js';
import {useAsync,go} from './catalogue.jsx';
import {watchLink,Episodes} from './Details.jsx';
import {Avatar,Button,Spinner,Modal,Empty} from './ui.jsx';
export function PlayerPage({type,id,params,settings,onError}){const [reload,setReload]=useState(0);const partyId=params.get('party'),party=api.parties.find(p=>p.id===partyId),source=party?.source||params.get('source')||settings.source,s=party?.season||Math.max(1,Number(params.get('s'))||1),e=party?.episode||Math.max(1,Number(params.get('e'))||1),epoch=party?.epoch||0;const title=useAsync(()=>api.tmdb(`${type}/${id}`).then(t=>titleOf(t,type)),[type,id]);useEffect(()=>{if(!partyId)return;return()=>{api.command('leave',{partyId}).catch(()=>{})}},[partyId]);if(title.loading)return <div className="page-loader"><Spinner/></div>;if(title.error)return <Empty title="Playback unavailable">{title.error}</Empty>;if(partyId&&!party)return <Empty title="Finding your party…">{api.status==='Connected'?'If the invitation has ended, return to Together.':'Waiting to reconnect to ANY.'}<Button onClick={()=>go('/together')}>Together</Button></Empty>;const member=party?.members.find(m=>m.profileId===api.profile);if(party&&(party.ended||!member?.onThisDevice||member.status!=='joined'))return <Empty title="You’re no longer in this party"><Button onClick={()=>go('/together')}>Back to Together</Button></Empty>;if(party&&!sourceById(source).controls)return <Empty title="Switch this party to a web-compatible source"><Button onClick={()=>go('/together')}>Choose source & join</Button></Empty>;return <Player key={`${id}:${source}:${s}:${e}:${epoch}:${reload}`} onReload={()=>setReload(v=>v+1)} title={title.data} source={source} season={s} episode={e} party={party} settings={settings} position={party?party.position:Number(params.get('pos'))||0} onError={onError}/>}
function Player({title,source,season,episode,party,position,onError,onReload}) {
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
 const reload=()=>{
  if(sync.current){sync.current.reset();sync.current.report(true,true)}
  onReload(); // New iframe and handshake; no stale sample or protocol survives.
 };
 useEffect(()=>{
  if(party){sync.current=new PartySync({sendPlayer,sendStatus:data=>api.send(data),command,now:()=>api.serverNow()});sync.current.update(party);sync.current.tick(api.ws?.readyState===1)}
  const receive=event=>{
   const data=parsePlayerEvent(event,iframe.current?.contentWindow,source,title,season,episode);if(!data)return;
   origin.current=data.origin;learnedOrigin.current=true;setReady(true);if(data.controllable)protocol.current=true;
   const next={...statsRef.current,...data,playing:data.playing??statsRef.current.playing};statsRef.current=next;setStats(next);setLoadFailed(false);
   if(!party&&data.controllable&&!resume.current){resume.current=true;if(position>0)sendPlayer('seek',position)}
   if(sync.current){sync.current.update(partyRef.current);sync.current.event(data);setLocal(sync.current.view())}
   if((!party||sync.current?.ready)&&(data.position>0||data.playing===true||data.event==='ended')){
    lastProgress.current=progressValue(title,title.media_type==='tv'?season:0,title.media_type==='tv'?episode:0,data.position,data.duration,data.event==='ended');
    if(Date.now()-lastSave.current>=10000||['pause','ended'].includes(data.event)){lastSave.current=Date.now();save()}
   }
  };
  window.addEventListener('message',receive);
  const tick=()=>{
   if(sync.current&&partyRef.current){sync.current.update(partyRef.current);sync.current.tick(api.ws?.readyState===1);setLocal(sync.current.view())}
   if(src.controls)sendPlayer('getStatus');
  };
  tick();const timer=setInterval(tick,1000),warning=setTimeout(()=>setWaited(true),18000);
  const visibility=()=>{if(document.hidden)save()};document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('message',receive);clearInterval(timer);clearTimeout(warning);document.removeEventListener('visibilitychange',visibility);save();sync.current=null};
 },[]);
 useEffect(()=>{
  const key=e=>{
   if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
   if(e.key==='Escape'){e.preventDefault();if(episodes)setEpisodes(false);else if(controls)setControls(false);else go(`/${title.media_type}/${title.id}`)}
   else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();setControls(true)}
   else if((e.key===' '||e.key==='Enter')&&e.target.tagName!=='BUTTON'){
    e.preventDefault();if(partyRef.current&&!sync.current?.ready)activate();
    else if(protocol.current)command(statsRef.current.playing?'pause':'play');
   }else if(protocol.current&&(!partyRef.current||sync.current?.ready)&&['ArrowLeft','ArrowRight'].includes(e.key)&&e.target.tagName!=='BUTTON'){
    e.preventDefault();command('skip',{delta:e.key==='ArrowLeft'?-10:10});
   }
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[controls,episodes]);
 const playing=party?local.playing:stats.playing,positionNow=stats.position;
 const member=party?.members.find(m=>m.profileId===api.profile);
 const canControl=protocol.current&&(!party||(local.ready&&member?.ready))&&api.status==='Connected';
 const waiting=party&&(!local.ready||!member?.ready),showHelp=loadFailed||(waited&&(!ready||waiting))||local.phase==='blocked';
 const waitingText=api.status!=='Connected'?'Reconnecting — the party is paused.':member?.error&&protocol.current?member.error:
  local.phase==='blocked'?'The video did not start or stopped responding. Click Play inside the video, reload it, or change the party source.':
  local.phase==='aligning'?'Video started. Checking pause and matching the party position…':
  local.phase==='starting'?'Starting this browser’s video… If nothing happens, click Play inside the video itself.':
  'Start the video on this browser once. ANY will check it and pause at the party position. You may need to click Play inside the video.';
 async function playEpisode(s,e){if(party)await command('episode',{season:s,episode:e});else go(watchLink(title,{season:s,episode:e,source}));setEpisodes(false)}
 return <main className="player-page" ref={root} tabIndex={0}>
  <div className="player-top"><Button icon="left" aria-label="Leave player" onClick={()=>go(`/${title.media_type}/${title.id}`)}/><div><h1>{title.title}</h1><span>{title.media_type==='tv'?`Season ${season} · Episode ${episode} · `:''}{party?'Together · ':''}{`Source ${SOURCES.indexOf(src)+1} · ${src.name}`}</span></div><Button icon="expand" aria-label="Fullscreen" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen?.();else root.current?.requestFullscreen?.().catch(()=>onError('Fullscreen is unavailable in this browser.'))}}/></div>
  <div className="video-stage"><iframe ref={iframe} src={url.current} title={`${title.title} player`} allow="autoplay; fullscreen; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen onError={()=>setLoadFailed(true)}/></div>
  {(controls||waiting)&&<div className="player-controls">
   {party&&!party.playing&&<div className="party-presence">{party.members.filter(m=>m.status==='joined').map(m=><div key={m.profileId}><Avatar id={m.profile?.avatar} size={38}/><span>{m.profile?.name}<small>{m.error||(!m.connected?'Reconnecting':m.ready?m.buffering?'Buffering':'Ready':'Waiting for video')}</small></span></div>)}</div>}
   {waiting&&<div className="party-start" role="status"><p>{waitingText}</p><Button tone="red" icon="play" disabled={api.status!=='Connected'||['starting','aligning'].includes(local.phase)} onClick={activate}>Start video on this browser</Button></div>}
   <div className="timeline"><span>{clock(positionNow)}</span><input aria-label="Playback position" type="range" min="0" max={stats.duration||1} step="1" value={Math.min(positionNow,stats.duration||1)} disabled={!canControl} onChange={e=>command('seek',{position:Number(e.target.value)})}/><span>{clock(stats.duration)}</span></div>
   <div className="player-actions">
    <Button icon={playing?'pause':'play'} disabled={!canControl} aria-label={playing?'Pause':'Play'} onClick={()=>command(playing?'pause':'play')}/>
    <Button disabled={!canControl} onClick={()=>command('skip',{delta:-10})}>−10s</Button><Button disabled={!canControl} onClick={()=>command('skip',{delta:10})}>+10s</Button><Button icon="restart" disabled={!canControl} aria-label="Start over" onClick={()=>command('restart')}/>
    {title.media_type==='tv'&&<Button onClick={()=>setEpisodes(true)}>Episodes</Button>}<span className="spacer"/>
    <select aria-label={party?'Party source':'Playback source'} value={source} disabled={busy} onChange={e=>party?setSwitching(e.target.value):go(watchLink(title,{season,episode,source:e.target.value,position:stats.position}))}>
     {SOURCES.filter(s=>!party||(s.controls&&api.sources.includes(s.id))).map(s=><option key={s.id} value={s.id}>Source {SOURCES.indexOf(s)+1} · {s.name}</option>)}
    </select><Button onClick={()=>setControls(false)}>Hide controls</Button>
   </div>
   <p className="player-note">{party?(playing?'Playing on this browser':waiting?'Waiting for this browser’s video':party.playing?'Starting party playback…':party.desiredPlaying?'Waiting for everyone’s video':'Party paused'):!src.controls?'Use the video’s own playback controls. This source does not offer remote browser controls.':!protocol.current?'Use the video’s controls while ANY waits for its control connection.':'Space: play / pause · Left / right: skip · Up / down: controls · Esc: hide controls, then leave'}</p>
   {showHelp&&<div className="playback-help"><p>{party?'ANY has not confirmed a working, controllable video here. A connected party does not mean the source has loaded.':src.progress?'No playback status received yet. If the video is blank, try another source or reload the player.':'This source does not report playback to ANY. Automatic watch-history tracking is unavailable.'}</p><div className="actions"><Button onClick={reload}>Reload player</Button>{!party&&<><a className="button" href={url.current} target="_blank" rel="noopener noreferrer">Open source ↗</a><Button onClick={()=>setConfirmed(true)}>Mark as watched</Button></>}</div></div>}
  </div>}
  {!controls&&!waiting&&<Button className="show-controls" onClick={()=>setControls(true)}>Show controls</Button>}
  {switching&&<Modal title="Change the party source?" onClose={()=>setSwitching('')}><p>Switch everyone to {sourceById(switching).name}. The party pauses and each player reloads at the same position. Everyone stays in the party.</p><Button tone="red" disabled={busy} onClick={async()=>{setBusy(true);try{await api.command('join',{partyId:party.id,source:switching});setSwitching('')}catch(e){onError(e.message)}finally{setBusy(false)}}}>Switch source for everyone</Button></Modal>}
  {episodes&&<Modal wide title="Choose an episode" onClose={()=>setEpisodes(false)}><Episodes title={title} season={selectedSeason} onSeason={setSelectedSeason} onPlay={playEpisode}/></Modal>}
  {confirmed&&<Modal title="Mark as watched?" onClose={()=>setConfirmed(false)}><p>This marks {title.media_type==='tv'?`season ${season}, episode ${episode}`:title.title} complete in this profile’s history.</p><Button tone="red" onClick={()=>{const value=progressValue(title,title.media_type==='tv'?season:0,title.media_type==='tv'?episode:0,stats.duration||title.runtime*60,stats.duration||title.runtime*60,true);api.change('progress',value.key,value);setConfirmed(false)}}>Mark watched</Button></Modal>}
 </main>;
}
export function Together({onError}){
 const [transfer,setTransfer]=useState(null),[switching,setSwitching]=useState(null),[busy,setBusy]=useState(false);
 const compatible=browserPartySource(api.sources);
 async function join(p,force=false,source){setBusy(true);try{
  await api.command('join',{partyId:p.id,transfer:force,...(source?{source}:{})});
  const current=api.parties.find(x=>x.id===p.id)||p;
  go(watchLink(current.title,{season:current.season,episode:current.episode,source:source||current.source,party:p.id,position:current.position}));setTransfer(null);setSwitching(null);
 }catch(e){if(e.status===409&&/another device/i.test(e.message)){setSwitching(null);setTransfer({party:p,source})}else onError(e.message)}finally{setBusy(false)}}
 function open(p){if(sourceById(p.source).controls)join(p);else setSwitching(p)}
 return <div className="page"><p className="eyebrow">SAME FILM. SAME MOMENT.</p><h1>Together</h1><p className="page-subtitle">Invite another profile from any title. TV and web can join the same party.</p>{!api.parties.length?<Empty title="Your next movie night starts here">Open a film or series, select the friends icon and invite another profile.</Empty>:<div className="party-grid">{api.parties.map(p=>{const me=p.members.find(m=>m.profileId===api.profile),host=p.members.find(m=>m.profileId===p.ownerId),supported=sourceById(p.source).controls;return <article className="party-card" key={p.id}><div className="party-art" style={{backgroundImage:`url("${images(p.title.backdrop_path,'w780')}")`}}><span className="pill">{me?.status==='invited'?'You’re invited':'Movie night'}</span></div><div className="party-copy"><h2>{p.title.title}</h2><p>With {host?.profile?.name||'your friends'}{p.title.media_type==='tv'?` · S${p.season} E${p.episode}`:''}</p><div className="party-avatars">{p.members.filter(m=>['joined','invited'].includes(m.status)).map(m=><span key={m.profileId} title={`${m.profile?.name} · ${m.status}`}><Avatar id={m.profile?.avatar} size={38}/></span>)}</div>{!supported&&<p className="muted">Join on web by switching everyone to a compatible source. The party stays together and opens paused.</p>}<div className="actions"><Button icon="people" tone="red" disabled={busy} onClick={()=>open(p)}>{me?.status==='invited'?'Join party':'Return to party'}</Button>{me?.status==='invited'&&<Button disabled={busy} onClick={()=>api.command('decline',{partyId:p.id}).catch(e=>onError(e.message))}>Decline</Button>}</div></div></article>})}</div>}
 {switching&&<Modal title="Join this party on web?" onClose={()=>setSwitching(null)}><p>Switch everyone from {sourceById(switching.source).name} to {sourceById(compatible||'vidfast').name}. Playback pauses at the current position while each player reloads. Your invitations and episode stay the same.</p>{!compatible&&<p>No compatible source is enabled on the backend. Retry the connection in Settings.</p>}<Button tone="red" disabled={busy||!compatible} onClick={()=>join(switching,false,compatible)}>Switch source & join</Button></Modal>}
 {transfer&&<Modal title="Move this profile here?" onClose={()=>setTransfer(null)}><p>This profile is watching on another device. Continuing here will disconnect that device from the party.</p><Button tone="red" disabled={busy} onClick={()=>join(transfer.party,true,transfer.source)}>Watch here</Button></Modal>}</div>
}
