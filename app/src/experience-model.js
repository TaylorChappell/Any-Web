const key=t=>`${t.media_type}:${t.id}`;
const jsonTitle=p=>{try{return JSON.parse(p.titleJson)}catch{return {}}};
export function titleFacts(t){
 if(t.any_facts)return t.any_facts;
 const clean=p=>({id:p.id,name:p.name,profile_path:p.profile_path||'',role:p.role||p.character||p.job||''});
 const releases=t.release_dates?.results||[],region=releases.find(r=>r.iso_3166_1==='GB')||releases.find(r=>r.iso_3166_1==='US'),dates=region?.release_dates||[];
 const ratings=t.content_ratings?.results||[],tvCert=ratings.find(r=>r.iso_3166_1==='GB'&&r.rating)||ratings.find(r=>r.iso_3166_1==='US'&&r.rating);
 const cert=[...dates].sort((a,b)=>(a.type===3?0:1)-(b.type===3?0:1)).find(r=>r.certification)?.certification;
 const date=type=>dates.filter(r=>r.type===type&&/^\d{4}-\d{2}-\d{2}/.test(r.release_date||'')).map(r=>r.release_date.slice(0,10)).sort()[0]||'';
 const last=t.last_episode_to_air,seasonCounts=Object.fromEntries((t.seasons||[]).filter(s=>s.season_number>0&&last&&s.season_number<=last.season_number).map(s=>[s.season_number,s.season_number===last.season_number?last.episode_number:s.episode_count]));
 return {votes:t.vote_count||0,language:t.original_language||'',certification:cert||tvCert?.rating||'',certificationRegion:cert?region.iso_3166_1:tvCert?.iso_3166_1||'',
  people:(t.credits?.cast||[]).filter(p=>p.id>0).slice(0,12).map(clean),directors:[...new Map([...(t.credits?.crew||[]).filter(p=>p.job==='Director'),...(t.created_by||[]).map(p=>({...p,role:'Creator'}))].map(p=>[p.id,clean(p)])).values()].slice(0,6),
  status:t.status||'',nextAirDate:t.next_episode_to_air?.air_date||'',seasonCounts,theatrical:date(3)||date(2),digital:date(4),releaseRegion:region?.iso_3166_1||'',collectionEpisodes:t.collection_episode_count||0,optional:!!t.collection_optional};
}
export function watched(t,library){
 const state=library.feedback.find(f=>f.key===key(t))?.watchState;
 if(state==='watched')return true;if(state==='unwatched')return false;
 const rows=library.progress.filter(p=>p.titleKey===key(t));
 if(t.media_type==='movie')return rows.some(p=>p.complete||p.position>0&&p.duration>0&&p.duration-p.position<=600);
 let facts=titleFacts(t);if(!Object.keys(facts.seasonCounts||{}).length&&rows.length)facts=titleFacts(jsonTitle(rows[0]));
 const season=t.collection_season||0,count=season?(t.any_facts?.collectionEpisodes||t.collection_episode_count||facts.seasonCounts?.[season]||0):Object.values(facts.seasonCounts||{}).reduce((a,b)=>a+b,0);
 return count>0&&new Set(rows.filter(p=>p.complete&&(season?p.season===season&&p.episode<=count:p.episode<=(facts.seasonCounts?.[p.season]||0))).map(p=>p.key)).size>=count;
}
export function remainingEpisodes(t,library){
 const counts=titleFacts(t).seasonCounts||{},total=Object.values(counts).reduce((a,b)=>a+b,0);
 if(!total)return null;if(watched(t,library))return 0;
 return Math.max(0,total-new Set(library.progress.filter(p=>p.titleKey===key(t)&&p.complete&&p.episode<=(counts[p.season]||0)).map(p=>p.key)).size);
}
export function ratingText(t){const votes=titleFacts(t).votes;return t.vote_average>0?`TMDB ${t.vote_average.toFixed(1)}${votes>0?` · ${votes.toLocaleString('en-GB')} votes`:''}`:'';}
export function finishesAt(position,duration,now=Date.now()){
 if(!Number.isFinite(position)||!Number.isFinite(duration)||duration<=0||position>=duration)return null;
 return 'Finishes at '+new Date(now+Math.max(0,duration-Math.max(0,position))*1000).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}
export const released=(t,today=new Date().toLocaleDateString('en-CA'))=>/^\d{4}-\d{2}-\d{2}$/.test(t.release_date||'')&&t.release_date<=today;
export function diversify(rows,excluded=[]){const seen=new Set(excluded);return rows.map(r=>({...r,titles:r.titles.filter(t=>seen.has(key(t))?false:(seen.add(key(t)),true))})).filter(r=>r.titles.length);}
export function collectionProgress(titles,library){return {watched:titles.filter(t=>watched(t,library)).length,total:titles.length,next:titles.find(t=>!watched(t,library)&&!library.feedback.some(f=>f.key===key(t)&&f.notInterested))};}
export function hideContinueFilm(p,now=Date.now()){
 if(!p.titleKey?.startsWith('movie:'))return false;
 const age=Math.max(0,now-p.updated);
 return p.position>0&&p.duration>0&&p.duration-p.position<=600||p.position<300&&age>=3*3600000||p.position>0&&p.duration>0&&p.duration-p.position<=1200&&age>=2*86400000;
}
export function playbackIssue({started,now=Date.now(),lastReport=now,lastAdvance=now,position=0,duration=0,playing=false,error=false}){
 if(error)return 'Playback interrupted';
 if(duration<=0&&now-started>=45000)return 'Video has not started';
 if(duration>0&&playing&&(now-lastReport>15000||now-lastAdvance>25000))return 'Playback stopped responding';
 return null;
}
