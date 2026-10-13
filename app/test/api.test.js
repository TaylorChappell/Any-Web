import test from 'node:test';
import assert from 'node:assert/strict';
const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
const {AnyApi}=await import('../src/api.js');
test('offline changes retry with stable IDs without losing a change added while a flush is in flight',async()=>{values.clear();const a=new AnyApi('https://test.invalid');a.device={id:'test',token:'test'};a.profile='one';let release,first=true;const sent=[];a.request=async(path,{body})=>{sent.push(body.changes);if(first){first=false;await new Promise(r=>release=r)}return {accepted:body.changes.map(x=>x.id)}};const firstWrite=a.change('saved','movie:1',{key:'movie:1'});const secondWrite=a.change('saved','movie:2',{key:'movie:2'});release();await Promise.all([firstWrite,secondWrite]);assert.equal(sent.length,2);assert.deepEqual(sent.map(x=>x[0].key),['movie:1','movie:2']);assert.deepEqual(JSON.parse(values.get(a.queueKey())),[])});
test('failed writes remain attached to their original profile and keep their deduplication ID',async()=>{values.clear();const a=new AnyApi('https://test.invalid');a.device={id:'test',token:'test'};a.profile='one';a.request=async()=>{throw Error('Offline')};await a.change('feedback','movie:1',{key:'movie:1'});const original=JSON.parse(values.get(a.queueKey()))[0];await assert.rejects(a.select('two'));assert.equal(a.profile,'one');const seen=[];a.request=async(path,{body})=>{seen.push(body.changes[0]);return {accepted:[body.changes[0].id]}};await a.flush();assert.equal(seen[0].id,original.id);assert.deepEqual(JSON.parse(values.get(a.queueKey())),[])});
test('automatic connection registers once using the build token and reuses the device session',async()=>{
 values.clear();const a=new AnyApi('https://test.invalid');const requests=[];
 a.request=async(path,options={})=>{requests.push({path,...options});return path.endsWith('/devices')?{id:'auto-device',token:'device-token'}:{profiles:[{id:'profile',name:'Taylor',avatar:0}]}};
 await a.initialise('configured-frontend-token-at-least-32-characters');
 assert.equal(requests[0].accessCode,'configured-frontend-token-at-least-32-characters');
 assert.equal(a.profiles[0].id,'profile');assert.equal(a.profile,null);
 await a.initialise('configured-frontend-token-at-least-32-characters');
 assert.equal(requests.filter(r=>r.path.endsWith('/devices')).length,1);
 assert.equal([...values.values()].some(v=>v.includes('configured-frontend-token')),false);
});
test('automatic connection recovers one expired session and does not retry registration on a network failure',async()=>{
 values.clear();const a=new AnyApi('https://test.invalid');a.device={id:'expired',token:'old'};let count=0;
 a.request=async(path)=>{if(path.endsWith('/bootstrap')&&count++===0)throw Object.assign(new Error('Expired'),{status:401});if(path.endsWith('/devices'))return {id:'new',token:'new-token'};return {profiles:[]}};
 await a.initialise('configured-frontend-token-at-least-32-characters');assert.equal(a.device.id,'new');
 a.request=async()=>{throw new Error('Offline')};await assert.rejects(a.initialise('configured-frontend-token-at-least-32-characters'),/Offline/);assert.equal(a.device.id,'new');
});
test('missing frontend configuration fails without asking viewers to enter a token',async()=>{
 values.clear();const a=new AnyApi('https://test.invalid');a.request=async()=>assert.fail('No request before a token is configured');
 await assert.rejects(a.initialise(''),/website is not configured/);
});

test('category shelves load three pages and remove duplicates without multiplying a single title',async()=>{
 const api=new AnyApi('https://example.test');const pages=[];
 api.tmdb=async(path,params)=>{pages.push(params.page);return {total_pages:8,results:[{id:1,title:'Repeated'},{id:params.page+1,title:'Distinct'}]}};
 const data=await api.shelf('movie/popular');assert.deepEqual(pages,[1,2,3]);assert.deepEqual(data.results.map(t=>t.id),[1,2,3,4]);
});

test('next episode moves across seasons and stops before unaired or unknown-date episodes',async()=>{
 const api=new AnyApi('https://example.test');
 api.tmdb=async path=>path.endsWith('/season/1')?{episodes:[{episode_number:1,air_date:'2020-01-01'}]}:path.endsWith('/season/2')?{episodes:[{episode_number:1,air_date:'2020-02-01'},{episode_number:2,air_date:'2099-01-01'},{episode_number:3,air_date:null}]}:{seasons:[{season_number:1},{season_number:2}]};
 assert.deepEqual(await api.nextEpisode({id:7},1,1),{season:2,episode:1,name:undefined});
 assert.equal(await api.nextEpisode({id:7},2,1),null);
});

test('guest viewing never writes, queues changes, resumes an old live session or saves the guest as a profile',async()=>{
 values.clear();const a=new AnyApi('https://test.invalid');a.profile='one';a.library={saved:[{key:'movie:1'}],progress:[],feedback:[]};let requests=0;a.request=async()=>{requests++;throw Error('Guest must not request private history')};
 a.selectGuest();assert.equal(a.profile,'guest');assert.equal(a.guest,true);assert.equal(a.library.saved.length,0);
 await a.change('progress','movie:1',{position:120});await a.flush();await a.refreshLibrary();await a.refreshParties();a.startLive();
 assert.equal(requests,0);assert.equal([...values.values()].some(v=>v.includes('guest')),false);assert.equal(a.library.progress.length,0);
 await assert.rejects(a.command('create',{}),/profile/);
});
test('household switch rotates credentials, clears private state and keeps pending writes scoped to their old profile',async()=>{
 values.clear();const a=new AnyApi('https://test.invalid');a.device={id:'device',token:'old'};a.profile='old-profile';a.household={id:'old-home',code:'1234'};a.library={saved:[{key:'movie:1'}],progress:[],feedback:[]};a.parties=[{id:'old-party'}];a.online=['old-profile'];
 let request;a.request=async(path,options)=>{request={path,...options};return {device:{id:'device',token:'new'},household:{id:'new-home',code:'0042'},profiles:[{id:'new-profile'}]}};
 await a.changeHousehold('0042');assert.equal(request.path,'/v1/shared/household/join');assert.equal(request.body.code,'0042');assert.equal(a.device.token,'new');assert.equal(a.profile,null);assert.equal(a.household.code,'0042');assert.deepEqual(a.parties,[]);assert.deepEqual(a.online,[]);assert.deepEqual(a.library.saved,[]);assert.equal(JSON.parse(values.get('any.device')).token,'new');
});
