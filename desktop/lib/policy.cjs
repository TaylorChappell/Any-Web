'use strict';
const UI_ORIGIN='https://anymovies.fun';
const SOURCES={
 movish:{origins:['https://movish.to'],prefix:'/player'},
 vidfast:{origins:['vc','pro','in','io','me','net','pm','xyz','bz'].map(t=>'https://vidfast.'+t),prefix:''},
 vidcore:{origins:['https://vidcore.io'],prefix:''},
 vixsrc:{origins:['https://vixsrc.to'],prefix:''},
 vidking:{origins:['https://www.vidking.net'],prefix:'/embed'},
 vidrock:{origins:['https://vidrock.net'],prefix:''},
 vidsrc:{origins:['https://vidsrc.mov'],prefix:'/embed'},
 peachify:{origins:['https://peachify.top'],prefix:'/embed'}
};
function trustedUI(value){try{const u=new URL(value);return u.origin===UI_ORIGIN&&!u.username&&!u.password}catch{return false}}
function specification(input){
 if(!input||!SOURCES[input.source]||!['movie','tv'].includes(input.type)||!Number.isSafeInteger(input.id)||input.id<1)throw Error('Invalid title or source');
 if(!Number.isInteger(input.season)||input.season<0||input.season>1000||!Number.isInteger(input.episode)||input.episode<1||input.episode>10000)throw Error('Invalid episode');
 if(!Number.isFinite(input.position)||input.position<0||input.position>172800||typeof input.party!=='boolean'||typeof input.session!=='string'||!/^[a-zA-Z0-9-]{12,80}$/.test(input.session))throw Error('Invalid playback request');
 const source=SOURCES[input.source],path=`${source.prefix}/${input.type}/${input.id}`+(input.type==='tv'?`/${input.season}/${input.episode}`:'');
 const u=new URL(source.origins[0]+path);
 for(const [k,v]of Object.entries({autoPlay:'true',autoplay:'true',theme:'E50914',color:'E50914',autoNext:'false',autonext:'false',nextButton:'false',autoplayNextEpisode:'false',nextEpisode:'false'}))u.searchParams.set(k,v);
 if(input.position>0&&['vidfast','vidcore','vixsrc'].includes(input.source))u.searchParams.set('startAt',String(Math.floor(input.position)));
 return {source:input.source,id:input.id,type:input.type,season:input.season,episode:input.episode,start:input.position,party:input.party,session:input.session,path,origins:source.origins,url:u.href};
}
function allowedPlayerURL(value,spec){try{const u=new URL(value);return !u.username&&!u.password&&spec.origins.includes(u.origin)&&u.pathname===spec.path}catch{return false}}
function playerCommand(input){
 if(!input||!['play','pause','seek','getStatus'].includes(input.command))throw Error('Invalid playback command');
 if(input.command==='seek'&&(!Number.isFinite(input.time)||input.time<0||input.time>172800))throw Error('Invalid position');
 return {command:input.command,...(input.command==='seek'?{time:input.time}:{})};
}
function bounds(input,size){
 if(!input||!['x','y','width','height'].every(k=>Number.isFinite(input[k]))||typeof input.visible!=='boolean')throw Error('Invalid player bounds');
 const x=Math.max(0,Math.min(size[0],Math.round(input.x))),y=Math.max(0,Math.min(size[1],Math.round(input.y)));
 return {x,y,width:Math.max(0,Math.min(size[0]-x,Math.round(input.width))),height:Math.max(0,Math.min(size[1]-y,Math.round(input.height)))};
}
function validSample(s){return s&&typeof s==='object'&&['play','pause','seeked','ended','timeupdate','playerstatus'].includes(s.event)&&Number.isFinite(s.position)&&Number.isFinite(s.duration)&&s.duration>=0&&s.duration<=172800&&s.position>=0&&s.position<=s.duration+2&&typeof s.playing==='boolean'&&typeof s.playable==='boolean'&&typeof s.controllable==='boolean'}
module.exports={UI_ORIGIN,SOURCES,trustedUI,specification,allowedPlayerURL,playerCommand,bounds,validSample};
