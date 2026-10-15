import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {mkdir,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

for(const native of [false,true])test((native?'desktop':'web')+' flow connects from the build variable without an access-code screen, selects shared profiles, searches, saves and rates a title',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://taylorchappell.github.io/Any-Web/#/home',pretendToBeVisual:true});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,location:dom.window.location,EventTarget:dom.window.EventTarget,Event:dom.window.Event,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true,matchMedia:()=>({matches:false})});window.scrollTo=()=>{};
 const nativeCommands=[],nativeOpens=[],nativeEvents=new Set(),nativeKeys=new Set(),nativeBounds=[];
 if(native){globalThis.ResizeObserver=class{observe(){}disconnect(){}};window.anyDesktop={protocolVersion:1,heldSeekVersion:1,playbackLayoutVersion:1,version:'0.3.2',openPlayer:async input=>{nativeOpens.push(input);return {session:input.session}},closePlayer:async()=>{},playerCommand:async input=>{nativeCommands.push(input);return true},setPlayerBounds:async input=>{nativeBounds.push(input);return true},fullscreen:async()=>true,onPlayerEvent:cb=>{nativeEvents.add(cb);return()=>nativeEvents.delete(cb)},onPlayerKey:cb=>{nativeKeys.add(cb);return()=>nativeKeys.delete(cb)}};}
 if(native){const updates=new Set();let updateState={status:'idle',currentVersion:'0.3.1'};const change=s=>{updateState={...updateState,...s};updates.forEach(cb=>cb(updateState));return updateState};Object.assign(window.anyDesktop,{updateStatus:async()=>updateState,onUpdate:cb=>{updates.add(cb);return()=>updates.delete(cb)},checkForUpdates:async()=>change({status:'available',version:'0.3.2'}),downloadUpdate:async()=>change({status:'downloaded'}),installUpdate:async()=>change({status:'installing'})});}
 const liveMessages=[],requests=[],profile={id:'profile-one',name:'Taylor',avatar:0},library={saved:[],progress:[],feedback:[]};let selected=false,parties=[],joinedHousehold=native;
 let noticeRead=false,alertsMuted=false,releaseSeason;
 const releaseTitle={id:777,media_type:'tv',title:'Test Series',poster_path:'/poster.jpg'};
 const releaseFeed=()=>({items:alertsMuted?[]:[{id:777,event:'777:1:2:2026-10-15',title:releaseTitle,label:'New episode',count:1,season:1,episode:2,airDate:'2026-10-15',unread:!noticeRead}],tracked:[{id:777,title:releaseTitle,muted:alertsMuted}],unread:noticeRead||alertsMuted?0:1});
 const film={id:550,title:'Test Film',media_type:'movie',overview:'A test description.',poster_path:'/poster.jpg',backdrop_path:'/backdrop.jpg',release_date:'2025-01-01',vote_average:8.2,runtime:120,genres:[{id:18,name:'Drama'}],recommendations:{results:[]},videos:{results:[]},credits:{cast:[{id:900,name:'Test Actor',profile_path:'/actor.jpg',character:'Lead'}],crew:[{id:901,name:'Test Director',job:'Director',profile_path:'/director.jpg'}]},vote_count:12400,original_language:'en'};
 globalThis.fetch=async(url,init={})=>{const u=new URL(url),body=init.body?JSON.parse(init.body):null;requests.push({path:u.pathname,headers:init.headers,body});let data={};
  if(u.pathname.endsWith('/devices'))data={id:'device-one',token:'test-device-session'};
  else if(u.pathname.endsWith('/household/join')){assert.equal(body.code,'0042');joinedHousehold=true;data={device:{id:'device-one',token:'rotated-token'},profiles:[profile],household:{id:'home',code:'0042'}}}
  else if(u.pathname.endsWith('/bootstrap')||u.pathname.endsWith('/profiles'))data={profiles:joinedHousehold?[profile]:[],mapping:{},household:joinedHousehold?{id:'home',code:'0042'}:null};
  else if(u.pathname.endsWith('/session')){selected=true;data={profileId:profile.id}}
  else if(u.pathname.endsWith('/library/changes')){for(const c of body.changes){library[c.collection]=[...library[c.collection].filter(v=>v.key!==c.key),...(c.value?[c.value]:[])]}data={accepted:body.changes.map(c=>c.id)}}
  else if(u.pathname.endsWith('/library'))data=library;
  else if(u.pathname.endsWith('/releases')){if(body?.action==='read'||body?.action==='read-all')noticeRead=true;if(body?.action==='mute')alertsMuted=body.muted;data=releaseFeed()}
  else if(u.pathname.endsWith('/releases/catalogue'))data={items:[{id:777,badge:'New episode'}]};
  else if(u.pathname.endsWith('/parties'))data={parties,sources:['vidfast']};
  else if(u.pathname.endsWith('/commands')){if(body.action==='join'){parties[0]={...parties[0],source:body.source||parties[0].source,epoch:2,members:parties[0].members.map(m=>m.profileId===profile.id?{...m,status:'joined',onThisDevice:true}:m)}}data={partyId:parties[0]?.id};}
  else if(u.pathname.endsWith('/live-ticket'))data={ticket:'test-ticket'};
  else if(u.pathname.includes('/v1/collections/mcu'))data={id:-1,name:'Marvel Cinematic Universe',parts:[{...film,collection_category:'film'}],missing_count:0};
  else if(u.pathname.endsWith('/tonight'))data={titles:[{...film,tonight_reason:'120 minutes · Picked for your profiles'}]};
  else if(u.pathname.endsWith('/tv/777'))data={...film,id:777,media_type:'tv',title:'Test Series',status:'Canceled',next_episode_to_air:{air_date:'2099-10-23'},seasons:[{season_number:1},{season_number:2}]};
  else if(u.pathname.includes('/tv/777/season/')){if(u.pathname.endsWith('/2'))await new Promise(resolve=>{releaseSeason=resolve});data={episodes:[{id:1,episode_number:1,name:'Episode one',air_date:u.pathname.endsWith('/1')?'2020-01-01':'2099-01-01'},{id:2,episode_number:2,name:'Episode two',air_date:u.pathname.endsWith('/1')?'2020-01-02':'2099-01-02'},{id:3,episode_number:3,name:'Coming soon',air_date:'2099-10-23'},{id:4,episode_number:4,name:'Unannounced',air_date:null}]};}
  else if(u.pathname.endsWith('/person/900/combined_credits'))data={cast:[film],crew:[]};
  else if(u.pathname.endsWith('/person/900'))data={id:900,name:'Test Actor',profile_path:'/actor.jpg'};
  else if(u.pathname.includes('/v1/tmdb/'))data=u.pathname.match(/movie\/\d+$/)?{...film,id:Number(u.pathname.split('/').at(-1))}:u.pathname.includes('/videos')?{results:[]}:u.pathname.includes('genre/')?{genres:[{id:18,name:'Drama'}]}:u.pathname.includes('collection/')?{id:Number(u.pathname.split('/').at(-1)),name:'Test collection',parts:[film]}:{results:[film],total_pages:1};
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}})
 };
 class FakeSocket{constructor(){FakeSocket.latest=this;this.readyState=1;setTimeout(()=>{this.onopen?.();this.onmessage?.({data:JSON.stringify({type:'snapshot',serverNow:Date.now(),profiles:[profile],parties:[],sources:['vidfast'],online:[]})})},0)}send(value){liveMessages.push(JSON.parse(value))}close(){this.readyState=3}}
 globalThis.WebSocket=FakeSocket;
 const out=resolve('node_modules/.cache/any-ui-'+(native?'native':'web')+'-test.mjs');await mkdir(resolve('node_modules/.cache'),{recursive:true});await build({entryPoints:['src/main.jsx'],outfile:out,bundle:true,platform:'browser',format:'esm',external:['react','react-dom','react-dom/client'],loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"./"','import.meta.env.VITE_ANY_API_TOKEN':JSON.stringify('test'.repeat(10))}});
 const wait=async predicate=>{for(let i=0;i<60;i++){await act(async()=>{await new Promise(r=>setTimeout(r,10))});if(predicate())return}assert.fail('Expected UI state not reached: '+document.body.textContent.slice(0,800))};
 let app;await act(async()=>{app=await import(pathToFileURL(out).href)});t.after(async()=>{await act(()=>app.appRoot.unmount());dom.window.close();await rm(out,{force:true})}); if(!native){await wait(()=>document.querySelector('.household-code-input'));await act(()=>{const input=document.querySelector('.household-code-input');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'0042');input.dispatchEvent(new window.Event('input',{bubbles:true}));input.dispatchEvent(new window.Event('change',{bubbles:true}))});await act(()=>document.querySelector('.household-card form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));}await wait(()=>document.querySelector('.profile-tile'));
 assert.equal(requests.find(r=>r.path.endsWith('/devices')).headers.Authorization,'Bearer '+'test'.repeat(10));
 assert.equal(document.querySelector('#access-code'),null);assert.equal(document.querySelector('input[type=password]'),null);
 assert.equal(localStorage.getItem('any.device').includes('testtest'),false,'only the device session is retained in storage');
 await act(async()=>document.querySelector('.profile-tile').click());await wait(()=>document.querySelector('.hero'));assert.equal(selected,true);
 await wait(()=>document.querySelector('.release-bell .badge'));
 await act(async()=>document.querySelector('.release-bell').click());await wait(()=>document.querySelector('.release-list .unread'));
 assert.match(document.querySelector('.release-list').textContent,/New episode/);
 await act(async()=>document.querySelector('.release-open').click());await wait(()=>document.querySelector('.episode-section'));
 assert.match(location.hash,/tv\/777\?season=1/);assert.equal(noticeRead,true);assert.equal(document.querySelector('.release-bell .badge'),null);
 await wait(()=>document.querySelectorAll('.episode').length===4);
 assert.equal(document.querySelector('.series-status').textContent,'Series cancelled');
 assert.equal(document.querySelector('.series-status').previousElementSibling.className,'credit-facts');
 assert.equal(document.querySelector('.detail-information .series-status'),null);
 assert.ok(document.querySelector('.episode-section').compareDocumentPosition(document.querySelector('.people-section'))&window.Node.DOCUMENT_POSITION_FOLLOWING,'cast follows episodes');
 const upcoming=[...document.querySelectorAll('.episode')].find(e=>e.textContent.includes('Coming soon'));assert.equal(upcoming.disabled,true);assert.match(upcoming.textContent,/Releases 23 Oct 2099/);
 assert.match([...document.querySelectorAll('.episode')].find(e=>e.textContent.includes('Unannounced')).textContent,/Date to be announced/);
 await act(()=>{const select=document.querySelector('[aria-label="Season"]');select.value='2';select.dispatchEvent(new window.Event('change',{bubbles:true}))});await wait(()=>releaseSeason);
 assert.equal([...document.querySelectorAll('.detail-actions button')].find(b=>b.textContent.trim()==='Play').disabled,true,'changing season must block Play while the new episodes load');
 await act(async()=>releaseSeason());await wait(()=>document.querySelector('.episode')?.textContent.includes('Releases'));
 assert.equal([...document.querySelectorAll('.detail-actions button')].find(b=>b.textContent.trim()==='Play').disabled,true);
 await act(async()=>document.querySelector('.release-bell').click());await wait(()=>document.querySelector('.release-page'));
 await act(async()=>[...document.querySelectorAll('.release-page button')].find(b=>b.textContent.includes('Manage alerts')).click());
 await act(async()=>document.querySelector('[aria-label="Mute Test Series"]').click());await wait(()=>document.querySelector('[aria-label="Unmute Test Series"]'));assert.equal(alertsMuted,true);
 await act(async()=>document.querySelector('[aria-label="Unmute Test Series"]').click());await wait(()=>document.querySelector('[aria-label="Mute Test Series"]'));assert.equal(alertsMuted,false);
 assert.ok(requests.filter(r=>r.path.endsWith('/releases')&&r.body).every(r=>r.headers['X-Any-Profile']===profile.id));
 await act(async()=>{location.hash='/home';window.dispatchEvent(new window.HashChangeEvent('hashchange'))});await wait(()=>document.querySelector('.hero'));
 await act(async()=>[...document.querySelectorAll('.franchise-shelf button')].find(b=>b.textContent.trim()==='View all').click());await wait(()=>document.querySelector('[aria-label="Explore Marvel Cinematic Universe"]'));
 await act(async()=>document.querySelector('[aria-label="Explore Marvel Cinematic Universe"]').click());await wait(()=>document.querySelector('.collection-detail'));
 assert.equal(document.querySelector('.collection-detail h1').textContent,'Marvel Cinematic Universe');
 assert.equal(document.querySelectorAll('.collection-order').length,1);
 await act(async()=>{location.hash='/collections';window.dispatchEvent(new window.HashChangeEvent('hashchange'))});await wait(()=>document.querySelector('.collections-grid'));
 await act(async()=>document.querySelector('[aria-label="Explore Test collection"]').click());await wait(()=>document.querySelector('.collection-detail'));
 assert.equal(document.querySelector('.collection-detail h1').textContent,'Test collection');
 await act(async()=>{location.hash='/movie/550';window.dispatchEvent(new window.HashChangeEvent('hashchange'))});await wait(()=>document.querySelector('[aria-label="Add to My List"]'));
 await act(async()=>document.querySelector('[aria-label="Add to My List"]').click());await wait(()=>library.saved.length===1);assert.equal(library.saved[0].key,'movie:550');
 await act(async()=>document.querySelector('[aria-label="Thumbs up"]').click());await wait(()=>library.feedback.length===1);assert.equal(library.feedback[0].interested,true);
 await act(async()=>document.querySelector('[aria-label="Watch trailer"]').click());await wait(()=>document.querySelector('.manual-trailer'));
 assert.equal(document.querySelector('[aria-label="Watch trailer"]').textContent.trim(),'');
 await act(async()=>document.querySelector('[aria-label="Close"]').click());assert.equal(document.querySelector('.manual-trailer'),null);
 parties=[{id:'party-one',title:film,source:'movish',season:0,episode:0,position:42,duration:0,epoch:1,playing:false,anchor:Date.now(),ownerId:'profile-two',members:[{profileId:profile.id,status:'invited',profile},{profileId:'profile-two',status:'joined',profile:{name:'Friend'}}]}];
 await act(async()=>{FakeSocket.latest.onmessage({data:JSON.stringify({type:'snapshot',profiles:[profile],parties,sources:['vidfast'],online:[]})});location.hash='/together';window.dispatchEvent(new window.HashChangeEvent('hashchange'))});await wait(()=>document.querySelector('.party-card'));
 const join=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Join party'));assert.equal(join.disabled,false);
 await act(async()=>join.click());
 if(!native){await wait(()=>document.querySelector('[aria-label="Join this party on web?"]'));await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Switch source & join')).click());}
 await wait(()=>document.querySelector('.player-page'));
 assert.ok(requests.some(r=>r.body?.action==='join'&&(native?!r.body.source:r.body.source==='vidfast')));
 const nativeID=nativeOpens.at(-1)?.session,frame=document.querySelector('.video-stage iframe'),playerCommands=[];if(frame)frame.contentWindow.postMessage=(...v)=>playerCommands.push(v);
 if(native){assert.equal(frame,null);assert.equal(nativeOpens.at(-1).source,'movish');}
 const playerEvent=patch=>native?[...nativeEvents].forEach(cb=>cb({session:nativeID,kind:'status',data:{event:'playerstatus',position:patch.currentTime??42,duration:7200,playing:patch.playing??false,playable:true,controllable:true}})):window.dispatchEvent(new window.MessageEvent('message',{source:frame.contentWindow,origin:'https://vidfast.vc',data:{type:'PLAYER_EVENT',data:{event:'playerstatus',currentTime:42,duration:7200,playing:false,tmdbId:550,mediaType:'movie',...patch}}}));
 parties[0]={...parties[0],playing:true,duration:7200,anchor:Date.now()-60000};
 await act(async()=>{FakeSocket.latest.onmessage({data:JSON.stringify({type:'snapshot',profiles:[profile],parties,sources:['vidfast','vidcore'],online:[]})})});
 assert.equal(document.querySelector('.timeline input').value,'0','room clock must not masquerade as local video');
 assert.equal(document.querySelector('[aria-label="Pause"]'),null,'no pause icon for a video that never started');
 const partyPlaysBefore=requests.filter(r=>r.body?.action==='play').length;
 await act(async()=>playerEvent({}));assert.equal(document.querySelector('.timeline input').value,'42');
 assert.equal(document.querySelector('[aria-label="Play"]').disabled,true,'metadata is insufficient readiness');
 assert.equal([...document.querySelectorAll('button')].some(b=>b.textContent.includes('Start video on this browser')),false);
 if(frame)assert.equal(new URL(frame.src).searchParams.get('autoPlay'),'true');
 if(native)assert.equal(nativeCommands.at(-1).command,'play');else{assert.equal(playerCommands.at(-1)[0].command,'play');assert.equal(playerCommands.at(-1)[1],'https://vidfast.vc');}
 assert.equal(requests.filter(r=>r.body?.action==='play').length,partyPlaysBefore,'unlock does not start everyone');
 assert.equal(liveMessages.filter(m=>m.type==='status').at(-1).ready,false);
 // A frozen provider returns status but ignores play; after the startup deadline
 // a fresh status cannot hide the actionable error.
 const realDateNow=Date.now;Date.now=()=>realDateNow()+22000;
 try{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1100))});assert.ok(document.querySelector('.playback-help'))}finally{Date.now=realDateNow}
 assert.match(document.querySelector('.playback-help').textContent,/playback did not advance/);
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Reload player').click());
 if(native)assert.notEqual(nativeOpens.at(-1).session,nativeID,'reload creates a fresh native session');else assert.notEqual(document.querySelector('.video-stage iframe'),frame,'reload mounts a new source window');
 await act(async()=>playerEvent({playing:true,currentTime:500}));
 assert.equal(document.querySelector('.timeline input').value,'0','old iframe messages are ignored after reload');
 assert.equal(liveMessages.filter(m=>m.type==='status').at(-1).ready,false);
 await act(async()=>{const select=document.querySelector('[aria-label="Party source"]');select.value='vidcore';select.dispatchEvent(new window.Event('change',{bubbles:true}))});
 assert.ok(document.querySelector('[aria-label="Change the party source?"]'));
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Switch source for everyone').click());
 await wait(()=>native?nativeOpens.at(-1)?.source==='vidcore':document.querySelector('.video-stage iframe')?.src.includes('vidcore.io'));
 assert.ok(requests.some(r=>r.body?.action==='join'&&r.body.source==='vidcore'));

 if(native){
  await act(async()=>{location.hash='/watch/movie/550?source=movish';window.dispatchEvent(new window.HashChangeEvent('hashchange'))});await wait(()=>nativeOpens.at(-1)?.party===false);
  const session=nativeOpens.at(-1).session;
  const soloStatus=playing=>{for(const cb of nativeEvents)cb({session,kind:'status',data:{event:'playerstatus',position:15,duration:7200,playing,playable:true,controllable:true}})};
  await act(async()=>soloStatus(true));
  const seekCount=()=>nativeCommands.filter(c=>c.command==='seek').length,beforeSeek=seekCount();
  await act(async()=>{for(const cb of nativeKeys)cb({session,key:'ArrowRight',type:'keydown',repeat:false})});
  assert.equal(document.querySelector('.timeline input').value,'25');assert.equal(seekCount(),beforeSeek,'holding only moves the preview');
  await act(async()=>{for(const cb of nativeKeys)cb({session,key:'ArrowRight',type:'keyup'})});
  assert.equal(seekCount(),beforeSeek+1);assert.equal(nativeCommands.filter(c=>c.command==='seek').at(-1).time,25);
  await act(async()=>{for(const cb of nativeKeys)cb({session,key:'ArrowLeft',type:'keydown',repeat:false});for(const cb of nativeKeys)cb({session,type:'cancel'});for(const cb of nativeKeys)cb({session,key:'ArrowLeft',type:'keyup'})});
  assert.equal(seekCount(),beforeSeek+1,'window blur cancels an uncommitted seek');
  const range=document.querySelector('.timeline input');
  await act(async()=>range.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true})));
  assert.equal(seekCount(),beforeSeek+1);
  await act(async()=>range.dispatchEvent(new window.KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true,cancelable:true})));
  assert.equal(seekCount(),beforeSeek+2,'focused timeline keys also commit only on release');

  await act(async()=>{await new Promise(r=>setTimeout(r,3200))});
  assert.ok(document.querySelector('.desktop-player.cinema-mode'),'active playback hides idle controls');
  assert.equal(document.querySelector('.player-top'),null);assert.equal(nativeBounds.at(-1).fillWindow,true);
  await act(async()=>{for(const cb of nativeEvents)cb({session:'stale-session',kind:'pointer'})});assert.ok(document.querySelector('.cinema-mode'),'stale native events cannot reveal controls');
  await act(async()=>{for(const cb of nativeEvents)cb({session,kind:'pointer'})});
  assert.ok(document.querySelector('.player-top'));assert.equal(nativeBounds.at(-1).fillWindow,false);
  await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Hide controls').click());assert.ok(document.querySelector('.cinema-mode'));
  await act(async()=>soloStatus(false));assert.ok(document.querySelector('.player-top'),'pause restores controls');assert.equal(nativeBounds.at(-1).fillWindow,false);
 }
 if(native){
  await act(async()=>{location.hash='/settings';window.dispatchEvent(new window.HashChangeEvent('hashchange'))});await wait(()=>document.querySelector('.settings-page'));
  const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label);
  await act(async()=>button('Check for updates').click());await wait(()=>button('Download update'));
  await act(async()=>button('Download update').click());await wait(()=>button('Restart and install'));
  await act(async()=>button('Restart and install').click());assert.ok(document.body.textContent.includes('Restarting to install'));
 }
 if(native){
  await act(async()=>{location.hash='/watch/tv/777?s=1&e=1&source=movish';window.dispatchEvent(new window.HashChangeEvent('hashchange'))});await wait(()=>nativeOpens.at(-1)?.id===777);
  const session=nativeOpens.at(-1).session;
  const status=position=>{for(const cb of nativeEvents)cb({session,kind:'status',data:{event:'playerstatus',position,duration:1800,playing:true,playable:true,controllable:true}})};
  await act(async()=>status(1499));assert.equal(document.querySelector('.next-episode-panel'),null);
  await act(async()=>status(1500));await wait(()=>document.querySelector('.next-episode-panel button'));
  const next=document.querySelector('.next-episode-panel button');assert.equal(document.activeElement,next);assert.equal(next.textContent.trim(),'Next episode');assert.equal(nativeBounds.at(-1).fillWindow,false,'native video leaves room for the next-episode button');
  const before=nativeOpens.length;
  await act(async()=>{for(const cb of nativeKeys)cb({session,key:'ArrowLeft'})});assert.notEqual(document.activeElement,next);
  await act(async()=>{for(const cb of nativeKeys)cb({session,key:'Enter'})});assert.equal(nativeOpens.length,before,'OK after moving away controls playback, not next episode');
  await act(async()=>{next.focus();for(const cb of nativeKeys)cb({session,key:'Enter'})});await wait(()=>nativeOpens.at(-1)?.episode===2);
  assert.equal(library.progress.find(p=>p.key==='tv:777:1:1').position,1500);assert.equal(library.progress.find(p=>p.key==='tv:777:1:1').complete,true);
 }
 await act(async()=>{location.hash='/tonight';window.dispatchEvent(new window.HashChangeEvent('hashchange'))});await wait(()=>document.querySelector('.tonight-page'));
 assert.equal(document.querySelector('.tonight-options .choice-chip').getAttribute('aria-pressed'),'true');
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Find our films').click());await wait(()=>document.querySelector('.tonight-results'));
 assert.match(document.querySelector('.tonight-results').textContent,/120 minutes/);
 await act(async()=>{location.hash='/search';window.dispatchEvent(new window.HashChangeEvent('hashchange'))});await wait(()=>document.querySelector('.search-page input'));
 const search=document.querySelector('.search-page input');await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(search,'Test');search.dispatchEvent(new window.Event('input',{bubbles:true}));search.dispatchEvent(new window.Event('change',{bubbles:true}))});
 await wait(()=>document.querySelector('.search-page .poster-grid'));assert.equal(document.activeElement,search,'live results retain typing focus');
 await act(async()=>document.querySelector('.search-page form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));await wait(()=>document.querySelector('.search-page .poster-grid'));assert.notEqual(document.activeElement,search);
 assert.equal(document.querySelectorAll('.search-page .poster-card').length,1);assert.equal(document.querySelectorAll('.card-preview').length,0);
 assert.ok(requests.filter(r=>r.path.includes('/tmdb/')).every(r=>r.headers.Authorization===(native?'Device test-device-session':'Device rotated-token')));
 assert.ok(requests.filter(r=>r.path.includes('/library')).every(r=>r.headers['X-Any-Profile']===profile.id));
 const poster=document.querySelector('.search-page .poster-card');await act(async()=>{poster.focus();poster.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,520))});await wait(()=>document.querySelector('.quick-actions'));
 await act(async()=>poster.dispatchEvent(new window.KeyboardEvent('keyup',{key:'Enter',bubbles:true,cancelable:true})));assert.ok(location.hash.startsWith('#/search'),'long press does not also open the title');
 await act(async()=>document.querySelector('.quick-actions [aria-label="Watched"]').click());await wait(()=>library.feedback.find(f=>f.key==='movie:550')?.watchState==='watched');
 await act(async()=>document.querySelector('[aria-label="Close"]').click());assert.equal(document.activeElement,poster,'quick action dismissal restores poster focus');assert.ok(document.querySelector('.watched-badge'));
 await act(async()=>poster.click());await wait(()=>document.querySelector('.detail-actions'));
 await wait(()=>document.querySelector('.inline-credits .person-card'));assert.ok(document.querySelector('.metadata').textContent.includes('12,400 votes'));assert.equal(document.querySelector('[aria-label="More details"]'),null);
 await act(async()=>[...document.querySelectorAll('.person-card')].find(p=>p.textContent.includes('Test Actor')).click());await wait(()=>document.querySelector('.person-heading'));assert.equal(document.querySelectorAll('.poster-card').length,1);
 await act(async()=>[...document.querySelectorAll('.person-heading button')][0].click());assert.equal(document.querySelectorAll('.poster-card').length,0,'unwatched actor filter honours manual watched state');
 // Unmount to stop live connection timers, then release the DOM.
 await act(async()=>{location.hash='/profiles';window.dispatchEvent(new window.HashChangeEvent('hashchange'))});
 await act(()=>app.appRoot.unmount());
});
