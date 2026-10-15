import React,{useEffect,useState} from 'react';
import {api} from './api.js';
import {images} from './model.js';
import {Button,Icon,Spinner,Empty} from './ui.jsx';
import {releaseDateLabel} from './release-model.js';
const go=path=>{location.hash=path};
export function SeriesBadge({title,anchor}) {
 const [,update]=useState(0);
 useEffect(()=>{if(title.media_type!=='tv')return;const changed=()=>update(n=>n+1);api.addEventListener('release-badges',changed);let observer;
  if(typeof IntersectionObserver==='function'&&anchor.current){observer=new IntersectionObserver(rows=>{if(rows.some(r=>r.isIntersecting))api.queueReleaseBadge(title.id)},{threshold:.5});observer.observe(anchor.current)}else api.queueReleaseBadge(title.id);
  return()=>{observer?.disconnect();api.removeEventListener('release-badges',changed)};
 },[title.id,title.media_type]);
 if(title.media_type!=='tv')return null;
 const personal=api.releases?.items?.find(i=>i.id===title.id),label=personal?(personal.label.startsWith('Season')?'New season':personal.count>1?'New episodes':'New episode'):api.releaseBadges.get(title.id)?.badge;
 return label?<span className="series-release-badge">{label}</span>:null;
}
export function ReleaseBell(){if(api.guest)return null;const count=api.releases?.unread||0;return <a className="release-bell" href="#/notifications" aria-label={`Notifications${count?`, ${count} unread`:''}`}><Icon name="bell"/>{count>0&&<b className="badge">{count>99?'99+':count}</b>}</a>}
export function SeriesAlertsButton({title,onError}) {const [busy,setBusy]=useState(false);const row=api.releases?.tracked?.find(r=>r.id===title.id);if(!row||api.guest)return null;return <Button icon={row.muted?'bell-off':'bell'} disabled={busy} aria-label={row.muted?'Unmute episode alerts':'Mute episode alerts'} title={row.muted?'Unmute episode alerts':'Mute episode alerts'} aria-pressed={!row.muted} onClick={async()=>{setBusy(true);try{await api.releaseAction({action:'mute',seriesId:title.id,muted:!row.muted})}catch(e){onError(e.message)}finally{setBusy(false)}}}/>}
export function Notifications({onError}) {
 const [manage,setManage]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{api.refreshReleases().catch(e=>setError(e.message))},[]);
 const feed=api.releases,items=feed?.items||[],tracked=feed?.tracked||[];
 async function action(body){setBusy(true);try{await api.releaseAction(body)}catch(e){onError(e.message)}finally{setBusy(false)}}
 return <div className="page release-page"><div className="page-heading"><h1>Notifications</h1><div className="actions">{!!feed?.unread&&<Button icon="check" disabled={busy} onClick={()=>action({action:'read-all'})}>Mark read</Button>}<Button icon={manage?'close':'bell'} aria-pressed={manage} onClick={()=>setManage(!manage)}>{manage?'Done':'Manage alerts'}</Button></div></div>
 {error&&<p className="error">{error}<Button onClick={()=>{setError('');api.refreshReleases().catch(e=>setError(e.message))}}>Retry</Button></p>}
 {!feed&&!error?<Spinner/>:manage?<><p className="muted">Shows you watch or save to My List. Alerts follow this profile.</p><div className="release-list">{tracked.map(row=><article key={row.id}><button className="release-open" onClick={()=>go('/tv/'+row.id)}><img src={images(row.title.poster_path,'w185')} alt=""/><strong>{row.title.title}</strong></button><Button icon={row.muted?'bell-off':'bell'} disabled={busy} aria-label={`${row.muted?'Unmute':'Mute'} ${row.title.title}`} aria-pressed={!row.muted} onClick={()=>action({action:'mute',seriesId:row.id,muted:!row.muted})}/></article>)}</div>{!tracked.length&&<Empty title="Follow your next series">Watch a show or add it to My List to get updates.</Empty>}</>:<>
 <div className="release-list">{items.map(item=><article key={item.id} className={item.unread?'unread':''}><button className="release-open" onClick={async()=>{try{if(item.unread)await api.releaseAction({action:'read',seriesId:item.id,event:item.event});go(`/tv/${item.id}?season=${item.season}`)}catch(e){onError(e.message)}}}><img src={images(item.title.poster_path,'w185')} alt=""/><span><strong>{item.title.title}</strong><span className="release-label">{item.label}</span><small>S{item.season} · E{item.episode} · {releaseDateLabel(item.airDate)}</small></span>{item.unread&&<i className="release-unread" aria-label="Unread"/>}</button><Button icon="bell-off" disabled={busy} aria-label={`Mute ${item.title.title}`} onClick={()=>action({action:'mute',seriesId:item.id,muted:true})}/></article>)}</div>
 {!items.length&&<Empty title={feed?.checking?'Checking your shows…':'You’re up to date'}>{feed?.checking?<Spinner/>:'New episodes and returning seasons from your shows appear here.'}</Empty>}<p className="fine">Air dates from TMDB. Playback availability can vary by source.</p></>}
 </div>;
}
