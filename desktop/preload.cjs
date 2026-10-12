'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const subscribe=(channel,callback)=>{if(typeof callback!=='function')return()=>{};const receive=(_event,data)=>callback(data);ipcRenderer.on(channel,receive);return()=>ipcRenderer.removeListener(channel,receive);};
contextBridge.exposeInMainWorld('anyDesktop',Object.freeze({
 protocolVersion:1,version:process.argv.find(a=>a.startsWith('--any-version='))?.slice(14)||'0.3.0',
 openPlayer:input=>ipcRenderer.invoke('any:open-player',input),
 closePlayer:session=>ipcRenderer.invoke('any:close-player',session),
 playerCommand:input=>ipcRenderer.invoke('any:player-command',input),
 setPlayerBounds:input=>ipcRenderer.invoke('any:player-bounds',input),
 fullscreen:()=>ipcRenderer.invoke('any:fullscreen'),
 onPlayerEvent:callback=>subscribe('any:player-event',callback),
 onPlayerKey:callback=>subscribe('any:player-key',callback)
}));
