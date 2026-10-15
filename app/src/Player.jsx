import React,{useEffect,useRef,useState} from 'react';
import {api} from './api.js';
import {desktopBridge,desktopPartySource,desktopPartySupported,nativePlayerEvent} from './desktop.js';
import {titleOf,progressValue,clock,images,nextEpisodeVisible,feedbackValue,keyOf} from './model.js';
import {sourceById,SOURCES,playerUrl,parsePlayerEvent,PartySync,originsFor,browserPartySource} from './playback.js';
import {useAsync,go} from './catalogue.jsx';
import {watchLink,Episodes} from './Details.jsx';
import {Avatar,Button,Spinner,Modal,Empty} from './ui.jsx';
import {FinishTime} from './Experience.jsx';
import {HeldSeek} from './held-seek.js';
import {playbackIssue} from './experience-model.js';
export function PlayerPage({type,id,params,settings,onError}){const [reload,setReload]=useState(0),checkpoint=useRef(null);const partyId=params.get('party'),party=api.parties.find(p=>p.id===partyId),source=party?.source||params.get('source')||settings.source,s=party?.season||Math.max(1,Number(params.get('s'))||1),e=party?.episode||Math.max(1,Number(params.get('e'))||1),epoch=party?.epoch||0;const title=useAsync(()=>api.tmdb(`${type}/${id}`).then(t=>titleOf(t,type)),[type,id]);useEffect(()=>{if(!partyId)return;return()=>{api.command('leave',{partyId}).catch(()=>{})}},[partyId]);if(title.loading)return <div className="page-loader"><Spinner/></div>;if(title.error)return <Empty title="Playback unavailable">{title.error}</Empty>;if(partyId&&!party)return <Empty title="Finding your party…">{api.status==='Connected'?'If the invitation has ended, return to Together.':'Waiting to reconnect to ANY.'}<Button onClick={()=>go('/together')}>Together</Button></Empty>;const member=party?.members.find(m=>m.profileId===api.profile);if(party&&(party.ended||!member?.onThisDevice||member.status!=='joined'))return <Empty title="You’re no longer in this party"><Button onClick={()=>go('/together')}>Back to Together</Button></Empty>;if(party&&!(desktopBridge()?desktopPartySupported(source):sourceById(source).controls))return <Empty title="Switch this party to a web-compatible source"><Button onClick={()=>go('/together')}>Choose source & join</Button></Empty>;return <Player key={`${id}:${source}:${s}:${e}:${epoch}:${reload}`} onReload={position=>{checkpoint.current={key:`${type}:${id}:${s}:${e}`,position};setReload(v=>v+1)}} title={title.data} source={source} season={s} episode={e} party={party} settings={settings} position={party?party.position:checkpoint.current?.key===`${type}:${id}:${s}:${e}`?checkpoint.current.position:Number(params.get('pos'))||0} onError={onError}/>}
function Player({title,source,season,episode,party,position,onError,onReload}) {
 const desktop=desktopBridge(),nativeSession=useRef(crypto.randomUUID()),stage=useRef();
 const iframe=useRef(),root=useRef(),sync=useRef(),partyRef=useRef(party);
 const seeking=useRef(new HeldSeek()),[seekPreview,setSeekPreview]=useState(null);
 const cancelSeek=()=>{seeking.current.cancel();setSeekPreview(null)};
 const statsRef=useRef({position:0,duration:0,playing:false}),origin=useRef(sourceById(source).base);
 const learnedOrigin=useRef(false),protocol=useRef(false),probe=useRef(0),resume=useRef(false),lastSave=useRef(0),lastProgress=useRef(null);
 const [stats,setStats]=useState(statsRef.current),[controls,setControls]=useState(true),[episodes,setEpisodes]=useState(false);
 const [selectedSeason,setSelectedSeason]=useState(season),[ready,setReady]=useState(false),[waited,setWaited]=useState(false);
 const [loadFailed,setLoadFailed]=useState(false),[confirmed,setConfirmed]=useState(false),[switching,setSwitching]=useState(''),[busy,setBusy]=useState(false);
 const [subtitlesOpen,setSubtitlesOpen]=useState(false),[loadingAge,setLoadingAge]=useState(0),[recovery,setRecovery]=useState(null);
 const health=useRef({started:Date.now(),lastReport:Date.now(),lastAdvance:Date.now()}),lastConfirmed=useRef(position);
 const [local,setLocal]=useState({phase:'loading',ready:false,playing:false});
 const [next,setNext]=useState(null),[nextBusy,setNextBusy]=useState(false),nextButton=useRef(),nextActivated=useRef(false);
 const nextEligible=title.media_type==='tv'&&nextEpisodeVisible(stats.position,stats.duration);
 const showNext=nextEligible&&!!next&&!episodes&&!switching&&!confirmed&&!loadFailed;
 useEffect(()=>{let live=true;if(title.media_type==='tv')api.nextEpisode(title,season,episode).then(n=>{if(live)setNext(n)}).catch(()=>{});return()=>{live=false}},[title.id,season,episode]);
 useEffect(()=>{if(showNext&&!nextActivated.current){nextActivated.current=true;nextButton.current?.focus({preventScroll:true})}},[showNext]);
 const advance=async()=>{if(!next||nextBusy)return;setNextBusy(true);try{const value=progressValue(title,season,episode,statsRef.current.position,statsRef.current.duration,true);lastProgress.current=null;await api.change('progress',value.key,value);await playEpisode(next.season,next.episode)}finally{setNextBusy(false)}};
 const nativeAutoHide=desktop?.playbackLayoutVersion===1,idleTimer=useRef(),revealControls=useRef(()=>{}),pointerOnControls=useRef(false);
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
  onReload(lastConfirmed.current); // New iframe and handshake; no stale sample or protocol survives.
 };
 useEffect(()=>{
  if(!api.guest){const f=api.library.feedback.find(f=>f.key===keyOf(title));if(f?.watchState||f?.hideContinue)api.change('feedback',keyOf(title),feedbackValue(title,{watchState:'',hideContinue:false},f));}
  if(party){sync.current=new PartySync({sendPlayer,sendStatus:data=>api.send(data),command,now:()=>api.serverNow()});sync.current.update(party);if(api.ws?.readyState===1)sync.current.activate();sync.current.tick(api.ws?.readyState===1)}
  const receiveData=data=>{
   if(!data)return;
   if(data.episodeChanged){sync.current?.block();onError('The source changed episode. Use ANY’s episode controls or reload the player.');return;}
   origin.current=data.origin;learnedOrigin.current=true;setReady(true);if(data.controllable)protocol.current=true;
   const next={...statsRef.current,...data,playing:data.playing??statsRef.current.playing},now=Date.now();
   health.current.lastReport=now;if(Math.abs(data.position-statsRef.current.position)>.05||!next.playing)health.current.lastAdvance=now;
   if(data.duration>0&&data.playable!==false)lastConfirmed.current=data.position;
   statsRef.current=next;setStats(next);setLoadFailed(!!data.error);if(!data.error&&data.playable!==false)setRecovery(playbackIssue({...health.current,...next}));
   if(!party&&data.duration>0&&data.controllable&&!resume.current){resume.current=true;if(position>0)sendPlayer('seek',position)}
   if(sync.current){sync.current.update(partyRef.current);sync.current.event(data);setLocal(sync.current.view())}
   if(data.duration>0&&(!party||sync.current?.ready)&&(data.position>0||data.playing===true||data.event==='ended')){
    lastProgress.current=progressValue(title,title.media_type==='tv'?season:0,title.media_type==='tv'?episode:0,data.position,data.duration,data.event==='ended');
    if(Date.now()-lastSave.current>=10000||['pause','ended'].includes(data.event)){lastSave.current=Date.now();save()}
   }
  };
  const receive=event=>receiveData(parsePlayerEvent(event,iframe.current?.contentWindow,source,title,season,episode));
  const unsubscribe=desktop?.onPlayerEvent(message=>{if(message.session!==nativeSession.current)return;if(message.kind==='pointer'){pointerOnControls.current=false;revealControls.current();return;}if(message.kind==='error'){setLoadFailed(true);sync.current?.block();if(sync.current)setLocal(sync.current.view());onError(message.message);return;}receiveData(nativePlayerEvent(message,nativeSession.current));});
  if(!desktop)window.addEventListener('message',receive);
  if(desktop)desktop.openPlayer({session:nativeSession.current,source,type:title.media_type,id:title.id,season,episode,position,party:!!party,subtitleLanguage:localStorage.getItem('any.subtitles')}).then(()=>{window.dispatchEvent(new Event('resize'));sendPlayer('getStatus');}).catch(error=>{setLoadFailed(true);onError(error.message);});
  const tick=()=>{
   setLoadingAge(Math.floor((Date.now()-health.current.started)/1000));
   setRecovery(playbackIssue({...health.current,...statsRef.current}));
   if(sync.current&&partyRef.current){sync.current.update(partyRef.current);sync.current.tick(api.ws?.readyState===1);setLocal(sync.current.view())}
   if(desktop||src.controls)sendPlayer('getStatus');
  };
  tick();const timer=setInterval(tick,desktop?250:1000),warning=setTimeout(()=>setWaited(true),18000);
  const visibility=()=>{if(document.hidden)save()};document.addEventListener('visibilitychange',visibility);
  return()=>{unsubscribe?.();if(desktop)desktop.closePlayer(nativeSession.current).catch(()=>{});window.removeEventListener('message',receive);clearInterval(timer);clearTimeout(warning);document.removeEventListener('visibilitychange',visibility);save();sync.current=null};
 },[]);
 const member=party?.members.find(m=>m.profileId===api.profile);
 const canControl=stats.duration>0&&protocol.current&&(!party||(local.ready&&member?.ready))&&(!party||api.status==='Connected');
 useEffect(()=>{
  const key=e=>{
   const seekKey=['ArrowLeft','ArrowRight'].includes(e.key);
   if(e.type==='keyup'){
    if(!canControl){cancelSeek();return;}
    if(seeking.current.key!==null&&seekKey){e.preventDefault();seeking.current.handle({key:e.key,type:'keyup',timeStamp:performance.now()},statsRef.current.position,statsRef.current.duration,target=>command('seek',{position:target}));setSeekPreview(seeking.current.preview);}
    return;
   }
   if(['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName)&&!(seekKey&&e.target?.type==='range'))return;
   if(!seekKey)cancelSeek();
   if(e.repeat&&['Enter',' ','Escape','Tab'].includes(e.key))return;
   if(showNext&&document.activeElement===nextButton.current){
    if(e.fromPlayer&&['Enter',' '].includes(e.key)){e.preventDefault();advance();return;}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();nextButton.current.blur();root.current?.focus({preventScroll:true});revealControls.current();setControls(true);return;}
   }
   if(e.key==='Escape'){e.preventDefault();if(subtitlesOpen)setSubtitlesOpen(false);else if(episodes)setEpisodes(false);else if(controls)setControls(false);else go(`/${title.media_type}/${title.id}`)}
   else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();revealControls.current();setControls(true)}
   else if(e.key==='Tab'&&e.fromPlayer){e.preventDefault();revealControls.current();setControls(true);requestAnimationFrame(()=>root.current?.querySelector('.player-top button')?.focus())}
   else if((e.key===' '||e.key==='Enter')&&e.target.tagName!=='BUTTON'){
    e.preventDefault();if(partyRef.current&&!sync.current?.ready)activate();
    else if(protocol.current)command(statsRef.current.playing?'pause':'play');
   }else if(canControl&&['ArrowLeft','ArrowRight'].includes(e.key)&&e.target.tagName!=='BUTTON'){
    revealControls.current();
    e.preventDefault();
    if(e.fromPlayer&&desktop?.heldSeekVersion!==1){command('skip',{delta:e.key==='ArrowLeft'?-10:10});return;}
    seeking.current.handle({key:e.key,type:'keydown',repeat:e.repeat,timeStamp:performance.now()},statsRef.current.position,statsRef.current.duration,target=>command('seek',{position:target}));setSeekPreview(seeking.current.preview);
   }
  };window.addEventListener('keydown',key);window.addEventListener('keyup',key);const off=desktop?.onPlayerKey(message=>{if(message.session!==nativeSession.current)return;if(message.type==='cancel'){cancelSeek();return;}key({key:message.key,type:message.type||'keydown',repeat:message.repeat||false,target:root.current,fromPlayer:true,preventDefault:()=>{}});});return()=>{off?.();window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);};
 },[controls,episodes,subtitlesOpen,showNext,next,nextBusy,canControl]);
 const playing=party?local.playing:stats.playing,positionNow=seekPreview??stats.position;
 const waiting=party&&(!local.ready||!member?.ready),showHelp=!!recovery||loadFailed||(waited&&(!ready||waiting))||local.phase==='blocked';
 const showChrome=desktop?(!nativeAutoHide||seekPreview!==null||controls||waiting||showHelp||episodes||subtitlesOpen||switching||confirmed):(seekPreview!==null||controls||waiting);
 useEffect(()=>{if(!canControl||episodes||subtitlesOpen||switching||confirmed)cancelSeek();},[canControl,episodes,subtitlesOpen,switching,confirmed]);
 useEffect(()=>{const hide=()=>{if(document.hidden)cancelSeek()};window.addEventListener('blur',cancelSeek);document.addEventListener('visibilitychange',hide);return()=>{seeking.current.cancel();window.removeEventListener('blur',cancelSeek);document.removeEventListener('visibilitychange',hide);};},[]);
 useEffect(()=>{
  if(!nativeAutoHide)return;
  const hide=()=>{if(pointerOnControls.current||root.current?.querySelector('.player-controls :focus-visible,.player-top :focus-visible'))return;if(document.activeElement!==nextButton.current)root.current?.focus({preventScroll:true});setControls(false)};
  const activity=()=>{setControls(true);clearTimeout(idleTimer.current);if(playing&&!waiting&&!showHelp&&!episodes&&!subtitlesOpen&&!switching&&!confirmed)idleTimer.current=setTimeout(hide,3000)};
  revealControls.current=activity;activity();
  return()=>{clearTimeout(idleTimer.current);revealControls.current=()=>{}};
 },[nativeAutoHide,playing,!!waiting,showHelp,episodes,subtitlesOpen,switching,confirmed]);
 useEffect(()=>{
  if(!desktop||!stage.current)return;
  const resize=()=>{const r=stage.current.getBoundingClientRect();desktop.setPlayerBounds({session:nativeSession.current,x:r.x,y:r.y,width:r.width,height:r.height,fillWindow:nativeAutoHide&&!showChrome&&!showNext,visible:!episodes&&!subtitlesOpen&&!switching&&!confirmed&&!document.hidden}).catch(()=>{});};
  const observer=new ResizeObserver(resize);observer.observe(stage.current);resize();
  window.addEventListener('resize',resize);document.addEventListener('visibilitychange',resize);window.addEventListener('scroll',resize,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',resize);window.removeEventListener('scroll',resize,true);};
 },[episodes,subtitlesOpen,switching,confirmed,!!showChrome,showNext,nativeAutoHide]);
 const failureText=recovery?`${recovery}. Retry from your saved position or try another source.`:loadFailed?`${src.name} could not load its player.`:
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
 return <main className={"player-page"+(desktop?" desktop-player":"")+(desktop&&!showChrome&&!showNext?' cinema-mode':'')} ref={root} tabIndex={0} onPointerMove={e=>{if(nativeAutoHide){pointerOnControls.current=!!e.target.closest('.player-controls,.player-top');revealControls.current()}}}>
  {(!desktop||showChrome)&&<div className="player-top"><Button icon="left" aria-label="Leave player" onClick={()=>go(`/${title.media_type}/${title.id}`)}/><div><h1>{title.title}</h1><span>{title.media_type==='tv'?`Season ${season} · Episode ${episode} · `:''}{party?'Together · ':''}{`Source ${SOURCES.indexOf(src)+1} · ${src.name}`}</span></div><Button icon="expand" aria-label="Fullscreen" onClick={()=>{if(desktop){desktop.fullscreen().then(()=>{if(nativeAutoHide&&playing)setControls(false)}).catch(()=>onError('Fullscreen is unavailable.'));return;}if(document.fullscreenElement)document.exitFullscreen?.();else root.current?.requestFullscreen?.().catch(()=>onError('Fullscreen is unavailable in this browser.'))}}/></div>}
  <div className="video-stage" ref={stage}>{desktop?<div className="native-player-placeholder"><Spinner/><span>Loading {src.name}…</span></div>:<iframe ref={iframe} src={url.current} title={`${title.title} player`} allow="autoplay; fullscreen; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen onLoad={frameLoaded} onError={()=>setLoadFailed(true)}/>}</div>
  {showNext&&<div className="next-episode-panel"><small>Season {next.season} · Episode {next.episode}</small><Button ref={nextButton} icon="next" disabled={nextBusy||!!party&&api.status!=='Connected'} onClick={advance}>Next episode</Button></div>}
  {showChrome&&<div className="player-controls">
   {party&&!party.playing&&<div className="party-presence">{party.members.filter(m=>m.status==='joined').map(m=><div key={m.profileId}><Avatar id={m.profile?.avatar} size={38}/><span>{m.profile?.name}<small>{m.error||(!m.connected?'Reconnecting':m.ready?m.buffering?'Buffering':'Ready':'Loading video')}</small></span></div>)}</div>}
   {!party&&stats.duration<=0&&loadingAge>=7&&!showHelp&&<div className="opening-video" role="status"><Spinner/><span>{loadingAge>=18?'Taking longer than usual…':'Opening video…'}</span></div>}
   {waiting&&<div className="party-start" role="status"><p>{waitingText}</p>{local.phase==='blocked'&&local.failure==='start-failed'&&<Button tone="red" icon="play" disabled={api.status!=='Connected'} onClick={activate}>Retry playback</Button>}</div>}
   <div className="timeline"><span>{clock(positionNow)}</span><input aria-label="Playback position" type="range" min="0" max={stats.duration||1} step="1" value={Math.min(positionNow,stats.duration||1)} disabled={!canControl} onChange={e=>command('seek',{position:Number(e.target.value)})}/><span>{clock(stats.duration)}</span></div>
   <div className="playback-meta">{seekPreview!==null?<span className="seek-hint">Release to seek</span>:<FinishTime position={positionNow} duration={stats.duration}/>}</div>
   <div className="player-actions">
    <Button icon={playing?'pause':'play'} disabled={!canControl} aria-label={playing?'Pause':'Play'} onClick={()=>command(playing?'pause':'play')}/>
    <Button disabled={!canControl} onClick={()=>command('skip',{delta:-10})}>−10s</Button><Button disabled={!canControl} onClick={()=>command('skip',{delta:10})}>+10s</Button><Button icon="restart" disabled={!canControl} aria-label="Start over" onClick={()=>command('restart')}/>
    {title.media_type==='tv'&&<Button icon="list" title="Episodes" aria-label="Episodes" onClick={()=>setEpisodes(true)}/>}<Button icon="captions" title="Subtitles" aria-label="Subtitles" aria-pressed={stats.subtitles?.some(t=>t.selected)||false} onClick={()=>setSubtitlesOpen(true)}/><span className="spacer"/>
    <select aria-label={party?'Party source':'Playback source'} value={source} disabled={busy} onChange={e=>party?setSwitching(e.target.value):go(watchLink(title,{season,episode,source:e.target.value,position:lastConfirmed.current}))}>
     {SOURCES.filter(s=>!party||((desktop?desktopPartySupported(s.id):s.controls)&&api.sources.includes(s.id))).map(s=><option key={s.id} value={s.id}>Source {SOURCES.indexOf(s)+1} · {s.name}</option>)}
    </select>{(!desktop||nativeAutoHide&&playing&&!waiting)&&<Button onClick={()=>{root.current?.focus({preventScroll:true});setControls(false)}}>Hide controls</Button>}
   </div>
   <p className="player-note">{party?(playing?(desktop?'Playing on this computer':'Playing on this browser'):waiting?(desktop?'Waiting for this computer’s video':'Waiting for this browser’s video'):party.playing?'Starting party playback…':party.desiredPlaying?'Waiting for everyone’s video':'Party paused'):!desktop&&!src.controls?'Use the video’s own playback controls. This source does not offer remote browser controls.':!protocol.current?'Use the video’s controls while ANY waits for its control connection.':'Space: play / pause · Left / right: skip · Up / down: controls · Esc: hide controls, then leave'}</p>
   {showHelp&&<div className="playback-help"><p>{party||recovery?failureText:src.progress?'No playback status received yet. If the video is blank, try another source or reload the player.':'This source does not report playback to ANY. Automatic watch-history tracking is unavailable.'}</p><div className="actions"><Button icon="restart" onClick={reload}>Reload player</Button><Button icon="film" onClick={()=>root.current?.querySelector('select[aria-label$="source"]')?.focus()}>Try another source</Button>{!party&&<><a className="button" href={url.current} target="_blank" rel="noopener noreferrer">Open source ↗</a><Button onClick={()=>setConfirmed(true)}>Mark as watched</Button></>}</div></div>}
  </div>}
  {!desktop&&!controls&&!waiting&&<Button className="show-controls" onClick={()=>setControls(true)}>Show controls</Button>}
  {switching&&<Modal title="Change the party source?" onClose={()=>setSwitching('')}><p>Switch everyone to {sourceById(switching).name}. The party pauses and each player reloads at the same position. Everyone stays in the party.</p><Button tone="red" disabled={busy} onClick={async()=>{setBusy(true);try{await api.command('join',{partyId:party.id,source:switching});setSwitching('')}catch(e){onError(e.message)}finally{setBusy(false)}}}>Switch source for everyone</Button></Modal>}
  {subtitlesOpen&&<Modal title="Subtitles" onClose={()=>setSubtitlesOpen(false)}>{desktop?.subtitleControlVersion===1&&stats.subtitles?.length?<div className="subtitle-tracks"><Button aria-pressed={!stats.subtitles.some(t=>t.selected)} onClick={()=>{localStorage.setItem('any.subtitles','off');sendPlayer('subtitle',-1);setSubtitlesOpen(false)}}>Off</Button>{stats.subtitles.map(t=><Button key={t.index} icon={t.selected?'check':undefined} aria-pressed={t.selected} onClick={()=>{localStorage.setItem('any.subtitles',t.language||'');sendPlayer('subtitle',t.index);setSubtitlesOpen(false)}}>{t.label}</Button>)}</div>:<p className="muted">{desktop&&desktop.subtitleControlVersion!==1?'Update ANY Desktop to use its subtitle controls.':'This source has not exposed subtitle tracks to ANY. Use its own subtitle controls or try another source.'}</p>}</Modal>}
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
 if(api.guest)return <div className="page"><Empty title="Together uses a profile">Choose a profile to invite friends and join a party.</Empty></div>;
 return <div className="page"><p className="eyebrow">SAME FILM. SAME MOMENT.</p><h1>Together</h1><p className="page-subtitle">Invite another profile from any title. TV, desktop and web can join the same party.</p>{!api.parties.length?<Empty title="Your next movie night starts here">Open a film or series, select the friends icon and invite another profile.</Empty>:<div className="party-grid">{api.parties.map(p=>{const me=p.members.find(m=>m.profileId===api.profile),host=p.members.find(m=>m.profileId===p.ownerId),supported=desktop?desktopPartySupported(p.source):sourceById(p.source).controls;return <article className="party-card" key={p.id}><div className="party-art" style={{backgroundImage:`url("${images(p.title.backdrop_path,'w780')}")`}}><span className="pill">{me?.status==='invited'?'You’re invited':'Movie night'}</span></div><div className="party-copy"><h2>{p.title.title}</h2><p>With {host?.profile?.name||'your friends'}{p.title.media_type==='tv'?` · S${p.season} E${p.episode}`:''}</p><div className="party-avatars">{p.members.filter(m=>['joined','invited'].includes(m.status)).map(m=><span key={m.profileId} title={`${m.profile?.name} · ${m.status}`}><Avatar id={m.profile?.avatar} size={38}/></span>)}</div>{!supported&&<p className="muted">Join on web by switching everyone to a compatible source. The party stays together and opens paused.</p>}<div className="actions"><Button icon="people" tone="red" disabled={busy} onClick={()=>open(p)}>{me?.status==='invited'?'Join party':'Return to party'}</Button>{me?.status==='invited'&&<Button disabled={busy} onClick={()=>api.command('decline',{partyId:p.id}).catch(e=>onError(e.message))}>Decline</Button>}</div></div></article>})}</div>}
 {switching&&<Modal title={desktop?"Change source to join?":"Join this party on web?"} onClose={()=>setSwitching(null)}><p>Switch everyone from {sourceById(switching.source).name} to {sourceById(compatible||'vidfast').name}. Playback pauses at the current position while each player reloads. Your invitations and episode stay the same.</p>{!compatible&&<p>No compatible source is enabled on the backend. Retry the connection in Settings.</p>}<Button tone="red" disabled={busy||!compatible} onClick={()=>join(switching,false,compatible)}>Switch source & join</Button></Modal>}
 {transfer&&<Modal title="Move this profile here?" onClose={()=>setTransfer(null)}><p>This profile is watching on another device. Continuing here will disconnect that device from the party.</p><Button tone="red" disabled={busy} onClick={()=>join(transfer.party,true,transfer.source)}>Watch here</Button></Modal>}</div>
}
