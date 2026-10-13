import React,{createContext,useContext,useState,useEffect} from 'react';
import {api} from './api.js';
import {titleOf,keyOf,latestProgress,feedbackValue,images,duration,releasedEpisode} from './model.js';
import {watched,titleFacts,finishesAt,ratingText} from './experience-model.js';
import {Button,Icon,Modal,Spinner,Empty} from './ui.jsx';
import {useAsync,Grid,go} from './catalogue.jsx';
import {Invite,watchLink} from './Details.jsx';

export const ExperienceContext=createContext(null);
export const useExperience=()=>useContext(ExperienceContext);
export async function resolveWatch(t,library=api.library){
 const full=titleOf(await api.tmdb(`${t.media_type}/${t.id}`),t.media_type),p=latestProgress(library,t);
 if(p?.position>0&&(t.media_type==='movie'||!p.complete)&&(!t.collection_season||p.season===t.collection_season))return {title:full,season:p.season,episode:p.episode,position:p.position};
 if(t.media_type==='movie')return {title:full,season:0,episode:0,position:0};
 const season=t.collection_season||full.season_numbers[0]||1,data=await api.tmdb(`tv/${t.id}/season/${season}`),episodes=(data.episodes||[]).filter(e=>releasedEpisode(e));
 const episode=episodes.find(e=>!library.progress.some(p=>p.titleKey===keyOf(t)&&p.season===season&&p.episode===e.episode_number&&p.complete))||episodes[0];
 if(!episode)throw Error('No aired episodes yet.');
 return {title:full,season,episode:episode.episode_number,position:0};
}
export async function toggleWatched(t){
 const old=api.library.feedback.find(f=>f.key===keyOf(t));
 await api.change('feedback',keyOf(t),feedbackValue(t,{watchState:watched(t,api.library)?'unwatched':'watched'},old));
}
export function ExperienceProvider({library,settings,onError,children}){
 const [quick,setQuick]=useState(null),[invite,setInvite]=useState(null),[busy,setBusy]=useState(false);
 useEffect(()=>{const close=()=>{setQuick(null);setInvite(null)};window.addEventListener('hashchange',close);return()=>window.removeEventListener('hashchange',close)},[]);
 const start=async(t,together=false)=>{if(busy)return;setBusy(true);try{const r=await resolveWatch(t);setQuick(null);if(together)setInvite(r);else go(watchLink(r.title,{...r,source:settings.source}))}catch(e){onError(e.message)}finally{setBusy(false)}};
 const t=quick,feedback=t&&library.feedback.find(f=>f.key===keyOf(t)),saved=t&&library.saved.some(p=>p.key===keyOf(t));
 return <ExperienceContext.Provider value={{open:setQuick,watched:t=>watched(t,library)}}>{children}
  {t&&<Modal title={t.title} onClose={()=>setQuick(null)}><div className="quick-actions"><img className="quick-poster" src={images(t.poster_path)||undefined} alt=""/><div><p className="muted">{t.release_date.slice(0,4)} · {t.media_type==='tv'?'Series':duration(t.runtime)||'Film'}</p><div className="quick-icons">
   <QuickIcon icon="play" label={latestProgress(library,t)?.position>0?'Resume':'Play'} disabled={busy} onClick={()=>start(t)}/>
   <QuickIcon icon={saved?'check':'plus'} label="My List" disabled={api.guest} onClick={()=>api.change('saved',keyOf(t),saved?null:{key:keyOf(t),titleJson:JSON.stringify(t),added:Date.now()})}/>
   <QuickIcon icon="watched" label="Watched" selected={watched(t,library)} disabled={api.guest} onClick={()=>toggleWatched(t)}/>
   <QuickIcon icon="up" label="Like" selected={feedback?.interested} disabled={api.guest} onClick={()=>api.change('feedback',keyOf(t),feedbackValue(t,{interested:!feedback?.interested,notInterested:false},feedback))}/>
   <QuickIcon icon="down" label="Dislike" selected={feedback?.notInterested} disabled={api.guest} onClick={()=>api.change('feedback',keyOf(t),feedbackValue(t,{notInterested:!feedback?.notInterested,interested:false},feedback))}/>
   <QuickIcon icon="people" label="Together" disabled={busy||api.guest} onClick={()=>start(t,true)}/>
  </div>{busy&&<Spinner/>}{api.guest&&<p className="fine">Guest · History and ratings stay untouched.</p>}</div></div></Modal>}
  {invite&&<Invite {...invite} onClose={()=>setInvite(null)} onError={onError}/>}
 </ExperienceContext.Provider>;
}
function QuickIcon({icon,label,selected=false,...props}){return <div><Button icon={icon} aria-label={label} title={label} aria-pressed={selected} className={selected?'selected':''} {...props}/><small>{label}</small></div>}
export function FinishTime({position=0,duration}){const [now,setNow]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[]);const value=finishesAt(position,duration,now);return value?<span className="finish-time">{value}</span>:null;}
export function MoreDetails({title,onClose}){
 const f=titleFacts(title),language=/^[a-z]{2,3}$/.test(f.language||'')?new Intl.DisplayNames(['en'],{type:'language'}).of(f.language):'';
 const open=p=>{onClose();go('/person/'+p.id)};
 return <Modal wide title={title.title} onClose={onClose}><div className="more-details"><p className="metadata">{[title.release_date.slice(0,4),duration(title.runtime),language,f.certification?`${f.certificationRegion} ${f.certification}`:'Certification unavailable'].filter(Boolean).join(' · ')}</p><p className="muted">{ratingText(title)}</p>
 {title.media_type==='movie'&&<div className="release-details"><p>{[f.theatrical&&`Cinema · ${f.theatrical}`,f.digital&&`Digital · ${f.digital}`,f.releaseRegion].filter(Boolean).join('  ·  ')||'Release details unavailable'}</p><small>Release dates do not confirm playback availability.</small></div>}
 {!!f.directors?.length&&<People label={title.media_type==='movie'?'Director':'Creators & directors'} people={f.directors} onPerson={open}/>}
 {!!f.people?.length&&<People label="Cast" people={f.people} onPerson={open}/>}
 {!f.directors?.length&&!f.people?.length&&<p className="muted">Credits unavailable.</p>}
 </div></Modal>;
}
export function People({label,people,onPerson}){return <section className="people-section"><h3>{label}</h3><div className="people-track">{people.map(p=><button className="person-card" key={p.id} onClick={()=>onPerson(p)}>{p.profile_path?<img src={images(p.profile_path,'w185')} loading="lazy" alt=""/>:<span className="person-placeholder"><Icon name="guest" size={38}/></span>}<strong>{p.name}</strong><small>{p.role}</small></button>)}</div></section>}
export function Person({id,library,sound}){
 const [unseen,setUnseen]=useState(false),[retry,setRetry]=useState(0),state=useAsync(async()=>{const [person,credits]=await Promise.all([api.tmdb('person/'+id),api.tmdb(`person/${id}/combined_credits`)]);const titles=[...new Map([...(credits.cast||[]),...(credits.crew||[]).filter(t=>t.job==='Director')].filter(t=>['movie','tv'].includes(t.media_type)&&!t.adult).map(t=>[keyOf(t),titleOf(t)])).values()].sort((a,b)=>b.release_date.localeCompare(a.release_date));return {person,titles}},[id,retry]);
 if(state.loading)return <div className="page-loader"><Spinner/></div>;if(state.error)return <Empty title="Credits unavailable">{state.error}<Button onClick={()=>setRetry(n=>n+1)}>Retry</Button></Empty>;
 const {person,titles}=state.data,rows=titles.filter(t=>!unseen||!watched(t,library));
 return <div className="page"><div className="person-heading">{person.profile_path&&<img src={images(person.profile_path,'w185')} alt=""/>}<div><h1>{person.name}</h1><Button icon="watched" aria-pressed={unseen} tone={unseen?'red':''} onClick={()=>setUnseen(v=>!v)}>{unseen?'Unwatched':'All titles'}</Button></div></div>{rows.length?<Grid titles={rows} sound={sound}/>:<Empty title="No titles match this filter"/>}</div>;
}
