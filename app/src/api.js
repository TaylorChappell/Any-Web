import {releasedEpisode} from './model.js';
export const BACKEND='https://any-production-8ce3.up.railway.app';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
export class AnyApi extends EventTarget {
 constructor(base=BACKEND){super();this.base=base;this.device=read('any.device',null);this.profile=read('any.profile',null);this.library={saved:[],progress:[],feedback:[]};this.profiles=[];this.parties=[];this.sources=[];this.online=[];this.status='Connecting';this.offset=0;this.cache=new Map();this.metadataActive=0;this.metadataQueue=[];this.generation=0;this.retries=0;this.guest=false;}
 notify(){this.dispatchEvent(new Event('change'))}
 async initialise(configuredToken){
  if(this.device){
   try{return await this.bootstrap()}catch(error){if(error.status!==401)throw error;this.stopLive();this.device=null;this.profile=null;localStorage.removeItem('any.device');localStorage.removeItem('any.profile')}
  }
  const token=typeof configuredToken==='string'?configuredToken.trim():'';
  if(token.length<32||/^(replace_with_|your_)/i.test(token))throw new Error('This website is not configured yet. Please contact the owner.');
  try{return await this.connect(token)}catch(error){if(error.status===401)throw new Error('This website’s connection settings need updating. Please contact the owner.');throw error}
 }
 async request(path,{method='GET',body,accessCode,signal}={}){
  let response;try{response=await fetch(this.base+path,{method,signal:signal??AbortSignal.timeout(18000),headers:{Authorization:accessCode?'Bearer '+accessCode:'Device '+(this.device?.token??''),...(this.profile?{'X-Any-Profile':this.profile}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})}catch(e){throw new Error(e.name==='TimeoutError'?'The backend took too long. Please try again.':'Could not connect. Check your internet connection.')}
  const value=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(value.error||`Request failed (${response.status})`);error.status=response.status;throw error}return value;
 }
 async connect(code){this.device=await this.request('/v1/shared/devices',{method:'POST',body:{},accessCode:code.trim()});write('any.device',this.device);this.profile=null;write('any.profile',null);return this.bootstrap()}
 async bootstrap(){if(!this.device)return;const data=await this.request('/v1/shared/bootstrap',{method:'POST',body:{profiles:[]}});this.profiles=data.profiles;if(this.profile&&this.profiles.some(p=>p.id===this.profile))await this.select(this.profile);else this.profile=null;this.notify()}
 async refreshProfiles(){this.profiles=(await this.request('/v1/shared/profiles')).profiles;this.notify()}
 async editProfile(profile,body){await this.request('/v1/shared/profiles'+(profile?'/'+profile.id:''),{method:profile?'PUT':'POST',body});await this.refreshProfiles()}
 async deleteProfile(id){await this.request('/v1/shared/profiles/'+id,{method:'DELETE'});if(id===this.profile){this.stopLive();this.profile=null;write('any.profile',null);this.library={saved:[],progress:[],feedback:[]}}await this.refreshProfiles()}
 selectGuest(){this.stopLive();this.guest=true;this.profile="guest";this.library={saved:[],progress:[],feedback:[]};this.parties=[];this.status="Guest";this.notify()}
 async select(id){if(this.profile&&this.profile!==id)await this.flush();this.stopLive();await this.request('/v1/shared/session',{method:'POST',body:{profileId:id}});this.guest=false;this.profile=id;write('any.profile',id);await this.flush();await this.refreshLibrary();await this.refreshParties();this.notify();this.startLive()}
 queueKey(){return `any.outbox.${this.device?.id}.${this.profile}`}
 async change(collection,key,value,clear=false){if(this.guest)return;const pending=read(this.queueKey(),[]);pending.push({id:crypto.randomUUID(),collection,key,value,clear});write(this.queueKey(),pending);const items=this.library[collection];this.library={...this.library,[collection]:clear?[]:[...items.filter(x=>x.key!==key),...(value?[value]:[])]};this.notify();try{await this.flush()}catch{this.status='Changes saved on this device. Waiting to sync.';this.notify()}}
 async flush(){if(this.guest||!this.device||!this.profile)return;if(this.flushing){await this.flushing;return this.flush()}const key=this.queueKey(),pending=read(key,[]);if(!pending.length)return;this.flushing=(async()=>{for(let i=0;i<pending.length;i+=100){const result=await this.request('/v1/shared/library/changes',{method:'POST',body:{changes:pending.slice(i,i+100)}});const accepted=new Set(result.accepted);write(key,read(key,[]).filter(x=>!accepted.has(x.id)))}})();try{await this.flushing}finally{this.flushing=null}}
 async refreshLibrary(){if(this.guest)return;const id=this.profile;const data=await this.request('/v1/shared/library');if(id!==this.profile||this.guest)return;for(const c of read(this.queueKey(),[]))data[c.collection]=c.clear?[]:[...data[c.collection].filter(x=>x.key!==c.key),...(c.value?[c.value]:[])];this.library=data;this.notify()}
 async metadataSlot(work){if(this.metadataActive>=6)await new Promise(resolve=>this.metadataQueue.push(resolve));else this.metadataActive++;try{return await work()}finally{if(this.metadataQueue.length)this.metadataQueue.shift()();else this.metadataActive--}}
 async tmdb(path,params={}){const key=path+'?'+new URLSearchParams({language:'en-GB',...params});let hit=this.cache.get(key);if(hit&&hit.expires>Date.now())return hit.promise;const promise=this.metadataSlot(()=>this.request('/v1/tmdb/'+key)).catch(e=>{this.cache.delete(key);throw e});this.cache.set(key,{expires:Date.now()+600000,promise});if(this.cache.size>180)this.cache.delete(this.cache.keys().next().value);return promise}
 async shelf(path,params={},pages=3){const first=await this.tmdb(path,{...params,page:params.page||1});const start=Number(params.page)||1;const extra=await Promise.allSettled(Array.from({length:Math.max(0,Math.min(pages-1,(first.total_pages||1)-start))},(_,i)=>this.tmdb(path,{...params,page:start+i+1})));return {...first,results:[...new Map([...first.results,...extra.flatMap(r=>r.status==='fulfilled'?r.value.results:[])].filter(t=>!t.adult).map(t=>[(t.media_type||'')+':'+t.id,t])).values()]}}
 async nextEpisode(title,season,episode){
  const current=await this.tmdb(`tv/${title.id}/season/${season}`);
  const next=(current.episodes||[]).filter(e=>e.episode_number>episode&&releasedEpisode(e)).sort((a,b)=>a.episode_number-b.episode_number)[0];
  if(next)return {season,episode:next.episode_number,name:next.name};
  const series=title.season_numbers?.length?{seasons:title.season_numbers.map(n=>({season_number:n}))}:await this.tmdb(`tv/${title.id}`);
  for(const s of (series.seasons||[]).filter(s=>s.season_number>season).sort((a,b)=>a.season_number-b.season_number)){
   const data=await this.tmdb(`tv/${title.id}/season/${s.season_number}`);
   const e=(data.episodes||[]).filter(e=>releasedEpisode(e)).sort((a,b)=>a.episode_number-b.episode_number)[0];
   if(e)return {season:s.season_number,episode:e.episode_number,name:e.name};
  }
  return null;
 }
 async refreshParties(){if(this.guest)return [];const data=await this.request('/v1/shared/parties');this.parties=data.parties||[];this.sources=data.sources||this.sources;this.notify();return this.parties}
 async command(action,fields={}){if(this.guest)throw Error("Choose a profile to use Together.");const result=await this.request('/v1/shared/commands',{method:'POST',body:{id:crypto.randomUUID(),action,...fields}});if(['create','join','leave','decline'].includes(action))await this.refreshParties().catch(()=>{});return result}
 send(value){if(this.ws?.readyState===1)this.ws.send(JSON.stringify(value))}
 serverNow(){return Date.now()+this.offset}
 stopLive(){++this.generation;clearTimeout(this.retryTimer);clearInterval(this.pingTimer);const ws=this.ws;this.ws=null;ws?.close()}
 async startLive(){if(this.guest||!this.profile)return;const generation=++this.generation;clearTimeout(this.retryTimer);this.status='Connecting';this.notify();
  try{const {ticket}=await this.request('/v1/shared/live-ticket',{method:'POST',body:{}});if(generation!==this.generation)return;const ws=new WebSocket(this.base.replace(/^http/,'ws')+'/v1/shared/live?ticket='+encodeURIComponent(ticket));this.ws=ws;
   ws.onopen=()=>{if(generation!==this.generation){ws.close();return}this.retries=0;this.status='Connected';this.notify();this.flush().catch(()=>{});clearInterval(this.pingTimer);const ping=()=>this.send({type:'ping',sent:Date.now()});ping();this.pingTimer=setInterval(ping,5000)};
   ws.onmessage=({data})=>{if(generation!==this.generation)return;let value;try{value=JSON.parse(data)}catch{return}if(value.type==='snapshot'){this.parties=value.parties;this.profiles=value.profiles;this.sources=value.sources;this.online=value.online;this.notify()}else if(value.type==='pong'){const received=Date.now();if(received-value.sent<3000)this.offset=value.serverNow-(received+value.sent)/2}else if(value.type==='library')this.refreshLibrary().catch(()=>{});else if(value.type==='error'){this.dispatchEvent(new CustomEvent('notice',{detail:value.error}))}};
   ws.onerror=()=>{};ws.onclose=e=>{if(generation!==this.generation)return;clearInterval(this.pingTimer);if(e.code===4001){this.status='Connection moved or profile changed. Select a profile to reconnect.';this.refreshProfiles().then(()=>{if(!this.profiles.some(p=>p.id===this.profile)){this.profile=null;write('any.profile',null);this.library={saved:[],progress:[],feedback:[]};this.notify()}}).catch(error=>{if(error.status===401){this.device=null;this.profile=null;localStorage.removeItem('any.device');localStorage.removeItem('any.profile');this.notify()}});this.notify();return}this.reconnect(generation)};
  }catch{if(generation===this.generation)this.reconnect(generation)}
 }
 reconnect(generation){this.status='Reconnecting…';this.notify();this.retryTimer=setTimeout(()=>{if(generation===this.generation)this.startLive()},Math.min(30000,1000*2**Math.min(this.retries++,5)))}
 async signOut(){await this.flush();await this.request('/v1/shared/device',{method:'DELETE'});this.stopLive();this.device=null;this.profile=null;this.library={saved:[],progress:[],feedback:[]};localStorage.removeItem('any.device');localStorage.removeItem('any.profile');this.notify()}
}
export const api=new AnyApi();
