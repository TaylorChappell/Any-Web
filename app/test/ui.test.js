import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {mkdir,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

test('web flow connects from the build variable without an access-code screen, selects shared profiles, searches, saves and rates a title',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://taylorchappell.github.io/Any-Web/#/home',pretendToBeVisual:true});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,location:dom.window.location,EventTarget:dom.window.EventTarget,Event:dom.window.Event,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true,matchMedia:()=>({matches:false})});window.scrollTo=()=>{};
 const requests=[],profile={id:'profile-one',name:'Taylor',avatar:0},library={saved:[],progress:[],feedback:[]};let selected=false,parties=[];
 const film={id:550,title:'Test Film',media_type:'movie',overview:'A test description.',poster_path:'/poster.jpg',backdrop_path:'/backdrop.jpg',release_date:'2025-01-01',vote_average:8.2,runtime:120,genres:[{id:18,name:'Drama'}],recommendations:{results:[]},videos:{results:[]},credits:{cast:[]}};
 globalThis.fetch=async(url,init={})=>{const u=new URL(url),body=init.body?JSON.parse(init.body):null;requests.push({path:u.pathname,headers:init.headers,body});let data={};
  if(u.pathname.endsWith('/devices'))data={id:'device-one',token:'test-device-session'};
  else if(u.pathname.endsWith('/bootstrap')||u.pathname.endsWith('/profiles'))data={profiles:[profile],mapping:{}};
  else if(u.pathname.endsWith('/session')){selected=true;data={profileId:profile.id}}
  else if(u.pathname.endsWith('/library/changes')){for(const c of body.changes){library[c.collection]=[...library[c.collection].filter(v=>v.key!==c.key),...(c.value?[c.value]:[])]}data={accepted:body.changes.map(c=>c.id)}}
  else if(u.pathname.endsWith('/library'))data=library;
  else if(u.pathname.endsWith('/parties'))data={parties,sources:['vidfast']};
  else if(u.pathname.endsWith('/commands')){if(body.action==='join'){parties[0]={...parties[0],source:body.source||parties[0].source,epoch:2,members:parties[0].members.map(m=>m.profileId===profile.id?{...m,status:'joined',onThisDevice:true}:m)}}data={partyId:parties[0]?.id};}
  else if(u.pathname.endsWith('/live-ticket'))data={ticket:'test-ticket'};
  else if(u.pathname.includes('/v1/collections/mcu'))data={id:-1,name:'Marvel Cinematic Universe',parts:[{...film,collection_category:'film'}],missing_count:0};
  else if(u.pathname.includes('/v1/tmdb/'))data=u.pathname.match(/movie\/\d+$/)?{...film,id:Number(u.pathname.split('/').at(-1))}:u.pathname.includes('/videos')?{results:[]}:u.pathname.includes('genre/')?{genres:[{id:18,name:'Drama'}]}:u.pathname.includes('collection/')?{id:Number(u.pathname.split('/').at(-1)),name:'Test collection',parts:[film]}:{results:[film],total_pages:1};
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}})
 };
 class FakeSocket{constructor(){FakeSocket.latest=this;this.readyState=1;setTimeout(()=>{this.onopen?.();this.onmessage?.({data:JSON.stringify({type:'snapshot',serverNow:Date.now(),profiles:[profile],parties:[],sources:['vidfast'],online:[]})})},0)}send(){}close(){this.readyState=3}}
 globalThis.WebSocket=FakeSocket;
 const out=resolve('node_modules/.cache/any-ui-test.mjs');await mkdir(resolve('node_modules/.cache'),{recursive:true});await build({entryPoints:['src/main.jsx'],outfile:out,bundle:true,platform:'browser',format:'esm',external:['react','react-dom','react-dom/client'],loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"./"','import.meta.env.VITE_ANY_API_TOKEN':JSON.stringify('test'.repeat(10))}});
 const wait=async predicate=>{for(let i=0;i<60;i++){await act(async()=>{await new Promise(r=>setTimeout(r,10))});if(predicate())return}assert.fail('Expected UI state not reached: '+document.body.textContent.slice(0,800))};
 let app;await act(async()=>{app=await import(pathToFileURL(out).href)});t.after(async()=>{await act(()=>app.appRoot.unmount());dom.window.close();await rm(out,{force:true})}); await wait(()=>document.querySelector('.profile-tile'));
 assert.equal(requests.find(r=>r.path.endsWith('/devices')).headers.Authorization,'Bearer '+'test'.repeat(10));
 assert.equal(document.querySelector('#access-code'),null);assert.equal(document.querySelector('input[type=password]'),null);
 assert.equal(localStorage.getItem('any.device').includes('testtest'),false,'only the device session is retained in storage');
 await act(async()=>document.querySelector('.profile-tile').click());await wait(()=>document.querySelector('.hero'));assert.equal(selected,true);
 await act(async()=>document.querySelector('.collection-banner button').click());await wait(()=>document.querySelector('[aria-label="Explore Marvel Cinematic Universe"]'));
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
 await act(async()=>join.click());await wait(()=>document.querySelector('[aria-label="Join this party on web?"]'));
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Switch source & join')).click());await wait(()=>document.querySelector('.player-page'));
 assert.ok(requests.some(r=>r.body?.action==='join'&&r.body.source==='vidfast'));
 await act(async()=>{location.hash='/search';window.dispatchEvent(new window.HashChangeEvent('hashchange'))});await wait(()=>document.querySelector('.search-page input'));
 const search=document.querySelector('.search-page input');await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(search,'Test');search.dispatchEvent(new window.Event('input',{bubbles:true}));search.dispatchEvent(new window.Event('change',{bubbles:true}))});
 await act(async()=>document.querySelector('.search-page form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));await wait(()=>document.querySelector('.search-page .poster-grid'));assert.notEqual(document.activeElement,search);
 assert.equal(document.querySelectorAll('.search-page .poster-card').length,1);assert.equal(document.querySelectorAll('.card-preview').length,0);
 assert.ok(requests.filter(r=>r.path.includes('/tmdb/')).every(r=>r.headers.Authorization==='Device test-device-session'));
 assert.ok(requests.filter(r=>r.path.includes('/library')).every(r=>r.headers['X-Any-Profile']===profile.id));
 // Unmount to stop live connection timers, then release the DOM.
 await act(async()=>{location.hash='/profiles';window.dispatchEvent(new window.HashChangeEvent('hashchange'))});
 await act(()=>app.appRoot.unmount());
});
