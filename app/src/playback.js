export const SOURCES=[
 {id:'vidcore',name:'VidCore',base:'https://vidcore.io',prefix:'',controls:true,progress:true},
 {id:'vixsrc',name:'VixSrc',base:'https://vixsrc.to',prefix:''},
 {id:'vidking',name:'VidKing',base:'https://www.vidking.net',prefix:'/embed'},
 {id:'vidfast',name:'VidFast',base:'https://vidfast.vc',prefix:'',controls:true,progress:true},
 {id:'vidrock',name:'VidRock',base:'https://vidrock.net',prefix:'',progress:true},
 {id:'movish',name:'Movish',base:'https://movish.to',prefix:'/player',progress:true},
 {id:'vidsrc',name:'VidSrc',base:'https://vidsrc.mov',prefix:'/embed'},
 {id:'peachify',name:'Peachify',base:'https://peachify.top',prefix:'/embed'}
];
export const browserPartySource=sources=>['vidfast','vidcore'].find(id=>sources.includes(id));
export const sourceById=id=>SOURCES.find(s=>s.id===id)||SOURCES[5];
const vidfastOrigins=['pro','in','io','me','net','pm','xyz','vc','bz'].map(tld=>'https://vidfast.'+tld);
export const originsFor=s=>s.id==='vidfast'?vidfastOrigins:[s.base];
export function playerUrl(source,title,season=1,episode=1,position=0,party=false){
 const s=sourceById(source);if(!Number.isSafeInteger(title.id)||title.id<1||!['movie','tv'].includes(title.media_type))throw Error('Invalid title');
 if(!Number.isInteger(season)||season<0||!Number.isInteger(episode)||episode<1)throw Error('Invalid episode');
 const path=`${s.prefix}/${title.media_type}/${title.id}`+(title.media_type==='tv'?`/${season}/${episode}`:'');
 const url=new URL(s.base+path);const auto='true';for(const [k,v]of Object.entries({theme:'E50914',color:'E50914',primaryColor:'E50914',autoPlay:auto,autoplay:auto,autoNext:'false',nextButton:'false',autoplayNextEpisode:'false',nextEpisode:'false'}))url.searchParams.set(k,v);
 if(position>0&&['vidfast','vidcore','vixsrc'].includes(s.id))url.searchParams.set('startAt',String(Math.floor(position)));return url.href;
}
/** Only accept the current iframe, a documented origin and the expected title/episode. */
export function parsePlayerEvent(event,iframeWindow,source,title,season,episode){
 const s=sourceById(source);if(event.source!==iframeWindow||!originsFor(s).includes(event.origin))return null;
 let body=event.data;if(typeof body==='string'){if(body.length>32768)return null;try{body=JSON.parse(body)}catch{return null}}if(!body||typeof body!=='object')return null;
 const movish=s.id==='movish'&&body.type==='movish:progress';if(!movish&&body.type!=='PLAYER_EVENT')return null;
 const d=movish?body:body.data;if(!d||Number(d.tmdbId??d.mtmdbId)!==title.id)return null;
 if(!movish&&d.mediaType!==title.media_type)return null;
 if(title.media_type==='tv'&&(Number(d.season)!==season||Number(d.episode)!==episode))return null;
 if(!Number.isFinite(d.currentTime)||!Number.isFinite(d.duration)||d.duration<0||d.duration>172800||d.currentTime<0||d.currentTime>d.duration+5)return null;
 const kind=movish?'timeupdate':d.event;if(!['play','pause','seeked','ended','timeupdate','playerstatus'].includes(kind))return null;
 return {event:kind,position:Math.min(d.currentTime,d.duration),duration:d.duration,playing:typeof d.playing==='boolean'?d.playing:kind==='play'?true:kind==='pause'||kind==='ended'?false:undefined,controllable:!!s.controls&&kind==='playerstatus',mediaLoaded:d.duration>0,origin:event.origin};
}
export function expectedPosition(p,now){return Math.min(p.duration||172800,Math.max(0,p.position+(p.playing?Math.max(0,now-p.anchor)/1000:0)))}
/** Readiness requires real playback followed by an acknowledged pause at the
 * room position. A metadata response alone does not prove play() worked. */
export class PartySync {
 constructor({sendPlayer,sendStatus,command,now=Date.now}) {
  Object.assign(this,{sendPlayer,sendStatus,command,now,party:null});this.reset();
 }
 reset() {
  Object.assign(this,{sample:null,protocol:false,ready:false,primed:false,phase:'loading',
   suppressUntil:0,lastMove:0,lastControl:0,lastSeek:0,lastStatus:null,lastStatusKey:'',
   lastDesired:null,playSince:null,activationUntil:0,alignmentUntil:0,loadingSince:null,failure:null,finished:false});
 }
 update(p) {if(this.party?.epoch!==p.epoch)this.reset();this.party=p;}
 control(command,time) {
  this.suppressUntil=this.now()+1800;this.lastControl=this.now();
  if(command==='seek')this.lastSeek=this.now();
  this.sendPlayer(command,command==='seek'?Math.max(0,Math.floor(time)):time);
 }
 activate() {
  this.ready=false;this.primed=false;this.failure=null;
  this.phase=this.protocol?'starting':'loading';this.loadingSince=this.now();this.activationUntil=this.now()+20000;
  this.report(true,true);this.control('play');
 }
 report(connected=true,force=false) {
  if(!this.party||!connected)return;
  const now=this.now(),s=this.sample;
  const ready=!!(this.ready&&s&&now-s.received<6000);
  const buffering=this.phase==='blocked';
  const key=[ready,buffering,this.protocol].join(':');
  if(force||key!==this.lastStatusKey||this.lastStatus===null||now-this.lastStatus>=1800) {
   this.lastStatus=now;this.lastStatusKey=key;
   this.sendStatus({type:'status',partyId:this.party.id,epoch:this.party.epoch,
    position:s?.position||0,duration:s?.duration||0,canControl:this.protocol,ready,buffering});
  }
 }
 event(data) {
  const now=this.now(),old=this.sample,hadProtocol=this.protocol,playing=data.playing??old?.playing??false;
  this.sample={...data,playing,received:now};this.protocol ||= !!data.controllable;
  if(!this.party)return;
  if(this.ready&&data.duration===0){this.block('no-media');this.report(true,true);return;}
  const elapsed=old?(now-old.received)/1000:0,advance=old?data.position-old.position:0;
  // A seek, repeated status or a guessed room clock is not evidence of playback.
  const moved=data.duration>0&&playing&&old?.playing&&elapsed>0&&elapsed<6&&advance>.1&&
   advance<=elapsed*2+1&&data.event!=='seeked'&&now-this.lastSeek>1000;
  if(moved)this.lastMove=now;
  if(!this.ready) {
   if(this.primed) {
    if(this.protocol&&data.duration>0&&data.playable!==false&&data.playing===false&&Math.abs(data.position-expectedPosition(this.party,now))<=1.5) {
     this.ready=true;this.phase='ready';this.lastDesired=null;this.report(true,true);
    }
   } else {
    // Start automatically when the provider answers. Joining is the user's
    // playback action; no second ANY startup button is needed.
    if(this.protocol&&(this.phase==='loading'||this.phase==='blocked'&&
      (this.failure==='no-response'&&!hadProtocol||this.failure==='no-media'&&!old?.duration&&data.duration>0)))this.activate();
    else if(playing&&this.phase!=='starting'&&(this.phase!=='blocked'||data.event==='play'||moved)) {this.failure=null;this.phase='starting';this.activationUntil=now+20000;}
    if(this.protocol&&moved) {
     this.primed=true;this.phase='aligning';this.alignmentUntil=now+12000;
     this.control('pause');
    }
   }
   return; // Initial activation and alignment must never control the whole room.
  }
  if(data.event==='ended'&&!this.finished) {
   this.finished=true;this.command('finished',{position:data.position,duration:data.duration});return;
  }
  if(now<this.suppressUntil||!old)return;
  if(data.event==='play'&&!this.party.playing)this.command('play',{});
  else if(data.event==='pause'&&this.party.playing)this.command('pause',{});
  else if(data.event==='seeked'&&Math.abs(data.position-expectedPosition(this.party,now))>2)this.command('seek',{position:data.position});
 }
 block(reason='stalled') {
  this.failure=reason;this.ready=false;this.primed=false;this.phase='blocked';this.playSince=null;this.lastDesired=null;
  this.control('pause');
 }
 tick(connected=true) {
  const p=this.party;if(!p)return;
  const now=this.now(),sample=this.sample,fresh=sample&&now-sample.received<6000;
  const desired=!!(p.playing&&now>=p.anchor);
  if(!connected) {
   if(this.phase!=='disconnected')this.block();this.phase='disconnected';return;
  }
  if(this.phase==='disconnected'){this.phase='loading';this.loadingSince=now;this.failure=null;}
  if(this.ready&&!fresh)this.block();
  if(!this.ready) {
   if(this.primed) {
    if(now>this.alignmentUntil)this.block('alignment');
    else if(now-this.lastControl>2000) {
     if(sample?.playing)this.control('pause');
     else if(sample&&Math.abs(sample.position-expectedPosition(p,now))>1.5)this.control('seek',expectedPosition(p,now));
    }
   } else if(this.phase==='loading') {
    this.loadingSince??=now;
    if(now-this.loadingSince>45000)this.block('no-response');
   } else if(this.phase==='starting') {
    if(now>this.activationUntil)this.block(sample?.duration>0?'start-failed':'no-media');
    else if(now-this.lastControl>=2500&&!sample?.playing)this.control('play');
   }
   this.report();return;
  }
  if(desired) {
   this.playSince??=now;
   // Keep the failure latched after the server pauses. Otherwise a paused
   // getStatus response would mark the blocked player ready and loop forever.
   if(now-this.playSince>5000&&now-this.lastMove>4500) {
    this.block();this.report(true,true);return;
   }
  } else this.playSince=null;
  const target=expectedPosition(p,now),local=sample.position+(sample.playing?Math.max(0,now-sample.received)/1000:0);
  if(Math.abs(target-local)>1.5&&now-this.lastSeek>3000)this.control('seek',target);
  if(this.lastDesired!==desired||sample.playing!==desired&&now-this.lastControl>2500) {
   this.control(desired?'play':'pause');this.lastDesired=desired;
  }
  this.report();
 }
 view() {
  const playing=!!(this.ready&&this.sample?.playing&&this.now()-this.lastMove<4500);
  return {phase:playing?'playing':this.phase,ready:this.ready,playing,failure:this.failure};
 }
}
