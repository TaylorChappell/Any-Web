import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseToday,releaseDateLabel,episodeReleaseLabel} from '../src/release-model.js';
import {releasedEpisode} from '../src/model.js';
const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
const {AnyApi}=await import('../src/api.js');
test('episode dates respect London midnight, invalid dates and announced future releases',()=>{
 const now=Date.parse('2026-10-15T23:30:00Z');assert.equal(releaseToday(now),'2026-10-16');assert.equal(releaseDateLabel('2026-10-17',now),'Tomorrow');assert.equal(episodeReleaseLabel({air_date:'2026-10-17'},now),'Releases Tomorrow');assert.equal(episodeReleaseLabel({air_date:'2026-10-16'},now),'Aired today');assert.equal(releaseDateLabel('2026-02-30',now),'Date to be announced');assert.equal(releasedEpisode({episode_number:1,air_date:'2026-02-30'},'2026-10-15'),false);
});
test('late notification responses cannot restore a previous household or overwrite a read action',async()=>{
 const a=new AnyApi();a.device={token:'old'};a.household={id:'one'};a.profile='one';let resolve;
 a.request=()=>new Promise(r=>resolve=r);const old=a.refreshReleases();a.profile='two';a.device={token:'new'};resolve({items:[{id:9}],unread:1});await old;assert.equal(a.releases,null);
 a.profile='one';let getResolve;a.request=(path,options)=>options?.method==='POST'?Promise.resolve({items:[],unread:0}):new Promise(r=>getResolve=r);
 const pending=a.refreshReleases();await a.releaseAction({action:'read-all'});getResolve({items:[{id:9}],unread:1});await pending;assert.equal(a.releases.unread,0);
});
test('guest release activity neither reads profile notifications nor changes mute state',async()=>{
 const a=new AnyApi();a.selectGuest();a.request=()=>assert.fail('No private request for a guest');await a.refreshReleases();await assert.rejects(a.releaseAction({action:'read-all'}),/profile/);assert.equal(a.releases,null);
});
test('visible-series badges use one bounded batch and share their cache',async()=>{
 const a=new AnyApi();a.household={id:'home'};const paths=[];a.request=async path=>{paths.push(path);return {items:[{id:1,badge:'New season'},{id:2,badge:'New episode'}]}};
 a.queueReleaseBadge(1);a.queueReleaseBadge(2);a.queueReleaseBadge(1);clearTimeout(a.releaseBadgeTimer);a.releaseBadgeTimer=null;await a.loadReleaseBadges();assert.equal(paths.length,1);assert.match(paths[0],/ids=1,2$/);assert.equal(a.releaseBadges.get(1).badge,'New season');a.queueReleaseBadge(1);assert.equal(a.releaseBadgeQueue.size,0);
});
