import React,{useEffect,useState} from 'react';
import {desktopBridge} from './desktop.js';
import {Button} from './ui.jsx';
const installer='https://github.com/TaylorChappell/Any-Web/releases/latest';
function useUpdateState(){
 const bridge=desktopBridge(),[state,setState]=useState({status:'idle'});
 useEffect(()=>{if(!bridge?.updateStatus)return;let active=true;const receive=s=>{if(active&&s&&typeof s.status==='string')setState(s)};const off=bridge.onUpdate(receive);bridge.updateStatus().then(receive).catch(()=>receive({status:'error',error:'Couldn’t read update status. Reopen ANY and try again.'}));return()=>{active=false;off()};},[bridge]);
 const invoke=async method=>{try{setState(await bridge[method]())}catch{setState(s=>({...s,status:'error',error:'Couldn’t complete the update. Please try again.'}))}};
 return {bridge,state,invoke};
}
export function DesktopUpdateSettings(){
 const {bridge,state:s,invoke}=useUpdateState();if(!bridge)return null;
 if(!bridge.updateStatus)return <section className="settings-section"><h2>Desktop updates</h2><p>Install the latest desktop version once to enable automatic update checks.</p><a className="button" href={installer} target="_blank" rel="noreferrer">Get the latest installer</a></section>;
 const text=s.status==='current'?`You’re up to date. ANY ${s.currentVersion}`:s.status==='available'?`ANY ${s.version} is available.`:s.status==='downloaded'?`ANY ${s.version} is ready to install.`:s.status==='downloading'?`Downloading… ${Math.round(s.percent||0)}%`:s.status==='checking'?'Checking for updates…':s.status==='installing'?'Restarting to install…':s.status==='error'?s.error:s.status==='unavailable'?'Updates are available in the installed Windows app.':`Installed version ${bridge.version}`;
 return <section className="settings-section"><h2>Desktop updates</h2><p role="status">{text}</p><p>ANY checks when it opens and every six hours. Download an update, then restart when you’re ready.</p><div className="actions"><Button disabled={['checking','downloading','downloaded','installing','unavailable'].includes(s.status)} onClick={()=>invoke('checkForUpdates')}>Check for updates</Button>{s.status==='available'&&<Button tone="red" onClick={()=>invoke('downloadUpdate')}>Download update</Button>}{s.status==='downloaded'&&<Button tone="red" onClick={()=>invoke('installUpdate')}>Restart and install</Button>}</div>{s.status==='downloading'&&<progress className="update-progress" aria-label="Update download" max="100" value={s.percent||0}/>}</section>;
}
export function DesktopUpdateNotice(){
 const {bridge,state:s}=useUpdateState(),[hash,setHash]=useState(location.hash),[dismissed,setDismissed]=useState('');
 useEffect(()=>{const change=()=>setHash(location.hash);window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[]);
 const key=s.status+':'+s.version;
 if(!bridge||!['available','downloaded'].includes(s.status)||key===dismissed||hash.startsWith('#/watch/')||hash.startsWith('#/settings'))return null;
 return <aside className="desktop-update-notice" role="status"><span>ANY {s.version} {s.status==='downloaded'?'is ready to install':'is available'}</span><a className="button" href="#/settings">View update</a><Button icon="close" aria-label="Dismiss update notice" onClick={()=>setDismissed(key)}/></aside>;
}
