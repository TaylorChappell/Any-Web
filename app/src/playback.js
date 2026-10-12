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
 const url=new URL(s.base+path);const auto=String(!party);for(const [k,v]of Object.entries({theme:'E50914',color:'E50914',primaryColor:'E50914',autoPlay:auto,autoplay:auto,autoNext:'false',nextButton:'false',autoplayNextEpisode:'false',nextEpisode:'false'}))url.searchParams.set(k,v);
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
 if(!Number.isFinite(d.currentTime)||!Number.isFinite(d.duration)||d.duration<=0||d.duration>172800||d.currentTime<0||d.currentTime>d.duration+5)return null;
 const kind=movish?'timeupdate':d.event;if(!['play','pause','seeked','ended','timeupdate','playerstatus'].includes(kind))return null;
 return {event:kind,position:Math.min(d.currentTime,d.duration),duration:d.duration,playing:typeof d.playing==='boolean'?d.playing:kind==='play'?true:kind==='pause'||kind==='ended'?false:undefined,controllable:!!s.controls&&kind==='playerstatus',origin:event.origin};
}
export function expectedPosition(p,now){return Math.min(p.duration||172800,Math.max(0,p.position+(p.playing?Math.max(0,now-p.anchor)/1000:0)))}
/** Server owns the timeline. Never infer readiness just from iframe load. */
export class PartySync {
 constructor({sendPlayer,sendStatus,command,now=Date.now}){this.sendPlayer=sendPlayer;this.sendStatus=sendStatus;this.command=command;this.now=now;this.party=null;this.sample=null;this.ready=false;this.suppressUntil=0;this.lastMove=now();this.lastControl=0;this.lastSeek=0;this.lastStatus=0;this.lastDesired=null;this.failed=false;this.finished=false;}
 update(p){if(this.party?.epoch!==p.epoch){this.sample=null;this.ready=false;this.lastDesired=null;this.finished=false;this.lastMove=this.now()}this.party=p}
 control(command,time){this.suppressUntil=this.now()+1800;this.lastControl=this.now();this.sendPlayer(command,time)}
 event(data){const now=this.now(),old=this.sample;if(!old||Math.abs(data.position-old.position)>.2)this.lastMove=now;this.sample={...data,playing:data.playing??old?.playing??false,received:now};this.ready=this.ready||data.controllable;
  if(!this.party||!this.ready)return;
  if(data.event==='ended'&&!this.finished){this.finished=true;this.command('finished',{position:data.position,duration:data.duration});return}
  if(now<this.suppressUntil||!old)return;
  if(data.event==='play'&&!this.party.playing)this.command('play',{});
  else if(data.event==='pause'&&this.party.playing)this.command('pause',{});
  else if(data.event==='seeked'&&Math.abs(data.position-expectedPosition(this.party,now))>2)this.command('seek',{position:data.position});
 }
 tick(connected=true){const p=this.party;if(!p)return;const now=this.now(),sample=this.sample,fresh=sample&&now-sample.received<6000;const ready=!!(connected&&fresh&&this.ready),desired=!!(p.playing&&now>=p.anchor);
  if(!connected){if(sample?.playing)this.control('pause');return}
  const buffering=ready&&desired&&now-this.lastMove>4500&&now-this.lastSeek>4500;
  if(now-this.lastStatus>=1800){this.lastStatus=now;this.sendStatus({type:'status',partyId:p.id,epoch:p.epoch,position:sample?.position||0,duration:sample?.duration||0,canControl:this.ready,ready,buffering})}
  if(!ready){if(this.lastDesired!==false){this.control('pause');this.lastDesired=false}return}
  const target=expectedPosition(p,now),local=sample.position+(sample.playing?Math.max(0,now-sample.received)/1000:0);
  if(Math.abs(target-local)>1.5&&now-this.lastSeek>3000){this.control('seek',target);this.lastSeek=now;this.lastMove=now}
  if(this.lastDesired!==desired||sample.playing!==desired&&now-this.lastControl>2500){this.control(desired?'play':'pause');this.lastDesired=desired}
 }
}
