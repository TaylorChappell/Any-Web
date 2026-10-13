import test from 'node:test';import assert from 'node:assert/strict';
import {titleFacts,watched,remainingEpisodes,ratingText,finishesAt,diversify,collectionProgress,hideContinueFilm,playbackIssue} from '../src/experience-model.js';
const film={id:1,media_type:'movie',title:'Film',vote_average:7.8,vote_count:12400},lib=()=>({saved:[],progress:[],feedback:[]});
test('facts preserve missing metadata and label the regional certification and distinct release types',()=>{
 const f=titleFacts({...film,release_dates:{results:[{iso_3166_1:'GB',release_dates:[{type:3,certification:'15',release_date:'2026-01-01T00:00:00Z'},{type:4,certification:'',release_date:'2026-03-01T00:00:00Z'}]}]}});
 assert.equal(f.certification,'15');assert.equal(f.certificationRegion,'GB');assert.equal(f.theatrical,'2026-01-01');assert.equal(f.digital,'2026-03-01');assert.equal(f.language,'');assert.equal(titleFacts({}).certification,'');assert.equal(ratingText(film),'TMDB 7.8 · 12,400 votes');assert.equal(ratingText({vote_average:0}),'');
});
test('manual watched/unwatched overrides history without changing the saved position',()=>{
 const l=lib();l.progress.push({key:'movie:1:0:0',titleKey:'movie:1',position:7100,duration:7200});assert.equal(watched(film,l),true);
 l.feedback.push({key:'movie:1',watchState:'unwatched'});assert.equal(watched(film,l),false);assert.equal(l.progress[0].position,7100);
 l.feedback[0].watchState='watched';assert.equal(watched(film,l),true);
});
test('series progress counts aired episodes only, and collection progress can skip disliked entries',()=>{
 const t={id:2,media_type:'tv',seasons:[{season_number:1,episode_count:4},{season_number:2,episode_count:10}],last_episode_to_air:{season_number:2,episode_number:2}},l=lib();
 assert.equal(remainingEpisodes(t,l),6);l.progress=[{key:'tv:2:1:1',titleKey:'tv:2',season:1,episode:1,complete:true},{key:'tv:2:0:1',titleKey:'tv:2',season:0,episode:1,complete:true}];assert.equal(remainingEpisodes(t,l),5);
 l.feedback=[{key:'movie:1',notInterested:true}];assert.equal(collectionProgress([film,t],l).next.id,2);
});
test('finish time and playback failure timers do not fabricate metadata or confuse pause with a stall',()=>{
 assert.equal(finishesAt(10,0),null);assert.equal(finishesAt(10,NaN),null);assert.equal(finishesAt(100,100),null);
 const now=new Date(2026,0,1,20,0).getTime();assert.equal(finishesAt(60,1860,now),'Finishes at 20:30');
 assert.equal(playbackIssue({started:0,now:44999}),null);assert.equal(playbackIssue({started:0,now:45000}),'Video has not started');
 assert.equal(playbackIssue({started:0,now:50000,duration:7200,playing:false,lastAdvance:0}),null);assert.equal(playbackIssue({started:0,now:50000,duration:7200,playing:true,lastAdvance:1000}),'Playback stopped responding');
});
test('home deduplication is stable and stale Continue watching entries hide without deletion',()=>{
 const rows=diversify([{name:'A',titles:[film]},{name:'B',titles:[film,{...film,id:2}]}]);assert.deepEqual(rows.map(r=>r.titles.map(t=>t.id)),[[1],[2]]);
 const p={titleKey:'movie:1',position:120,duration:7200,updated:100};assert.equal(hideContinueFilm(p,100+3*3600000),true);assert.equal(p.position,120);
 assert.equal(hideContinueFilm({...p,titleKey:'tv:1'},100+3*3600000),false);
});
