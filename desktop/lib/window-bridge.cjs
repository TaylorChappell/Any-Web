'use strict';
const {ipcMain}=require('electron');
const {trustedUI,specification}=require('./policy.cjs');
function registerWindowBridge(win,player,{isTrusted=trustedUI,updates}={}){
 const channels=[];
 const authorize=event=>{if(win.isDestroyed()||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!isTrusted(event.senderFrame.url))throw Error('Untrusted application frame');};
 const handle=(name,fn)=>{channels.push(name);ipcMain.handle(name,(event,input)=>{authorize(event);return fn(input);});};
 handle('any:open-player',input=>player.open(specification(input)));
 handle('any:close-player',id=>player.close(id));
 handle('any:player-command',input=>player.command(input));
 handle('any:player-bounds',input=>player.setBounds(input));
 handle('any:fullscreen',()=>{win.setFullScreen(!win.isFullScreen());return win.isFullScreen();});
 if(updates){
  handle('any:update-status',()=>updates.snapshot());
  handle('any:check-updates',()=>updates.check());
  handle('any:download-update',()=>updates.download());
  handle('any:install-update',()=>updates.install());
 }
 return ()=>channels.forEach(name=>ipcMain.removeHandler(name));
}
module.exports={registerWindowBridge};
