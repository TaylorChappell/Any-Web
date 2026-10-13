import React,{useEffect,useRef,useState} from 'react';
import {api} from './api.js';
import {Button} from './ui.jsx';
let youtube;
function loadYouTube(){if(window.YT?.Player)return Promise.resolve(window.YT);if(youtube)return youtube;youtube=new Promise((resolve,reject)=>{const old=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{old?.();resolve(window.YT)};const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{youtube=null;reject(Error('Trailer unavailable'))};document.head.append(script);setTimeout(()=>{if(!window.YT?.Player){youtube=null;reject(Error('Trailer unavailable'))}},12000)});return youtube}
export function Trailer({title,sound=true,delay=0,interactive=false}){
 const mount=useRef(),player=useRef(),[state,setState]=useState('waiting'),[video,setVideo]=useState(null);
 useEffect(()=>{
  let cancelled=false,timer,poll,reportedPlaying=false,initialTime=null;const deadline=Date.now()+delay;setState('waiting');setVideo(null);
  (async()=>{try{
   const data=await api.tmdb(`${title.media_type}/${title.id}/videos`),videos=(data.results||[]).filter(v=>v.site==='YouTube'&&/^[\w-]{11}$/.test(v.key)&&['Trailer','Teaser'].includes(v.type));
   videos.sort((a,b)=>Number(b.official)-Number(a.official)||Number(b.type==='Trailer')-Number(a.type==='Trailer'));
   const key=videos[0]?.key;if(!key)throw Error();if(cancelled)return;setVideo(key);
   const YT=await loadYouTube();if(cancelled||!mount.current)return;const target=document.createElement('div');mount.current.replaceChildren(target);
   player.current=new YT.Player(target,{host:'https://www.youtube-nocookie.com',videoId:key,playerVars:{autoplay:0,controls:interactive?1:0,playsinline:1,rel:0,origin:location.origin},events:{
    onReady:e=>{if(cancelled)return;if(!sound)e.target.mute();else e.target.unMute();setState('ready');timer=setTimeout(()=>{if(!cancelled)e.target.playVideo()},Math.max(0,deadline-Date.now()))},
    onStateChange:e=>{if(cancelled)return;reportedPlaying=e.data===1;if(e.data===0)setState('ended')},
    onError:()=>{if(!cancelled)setState('error')}
   }});
   poll=setInterval(()=>{if(cancelled||!reportedPlaying)return;const time=Number(player.current?.getCurrentTime?.());if(!Number.isFinite(time))return;if(initialTime===null)initialTime=time;else if(time-initialTime>.05)setState('playing')},250);
  }catch{if(!cancelled)setState('error')}})();
  return()=>{cancelled=true;clearTimeout(timer);clearInterval(poll);player.current?.destroy();player.current=null};
 },[title.id,title.media_type,sound,delay,interactive]);
 return <div className={`trailer ${state==='playing'?'playing':''} ${interactive?'interactive':''}`}><div className="trailer-video" ref={mount}/>{interactive&&!video&&<p className="trailer-message">{state==='error'?'No trailer is available right now.':'Loading trailer…'}</p>}{interactive&&video&&state!=='playing'&&<div className="trailer-action">{state==='error'?<a target="_blank" rel="noopener noreferrer" href={`https://www.youtube.com/watch?v=${video}`}>Watch trailer on YouTube ↗</a>:<Button icon="play" onClick={e=>{e.stopPropagation();player.current?.unMute();player.current?.playVideo()}}>Play trailer</Button>}</div>}</div>;
}
