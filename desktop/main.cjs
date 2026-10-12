'use strict';
const {app,BrowserWindow,ipcMain,Menu,dialog,shell}=require('electron');
const path=require('node:path');
const {UI_ORIGIN,trustedUI,specification}=require('./lib/policy.cjs');
const {PlayerHost}=require('./lib/player-host.cjs');
if(process.argv.includes('--self-test')){
 app.whenReady().then(()=>require('./test/electron-smoke.cjs').run()).then(()=>app.exit(0)).catch(error=>{console.error(error);app.exit(1);});
}else{
 const lock=app.requestSingleInstanceLock();if(!lock)app.quit();else{
  let win,player;
  app.setAppUserModelId('fun.anymovies.desktop');
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
  app.on('window-all-closed',()=>app.quit());
  app.whenReady().then(()=>{
   win=new BrowserWindow({title:'ANY',width:1360,height:850,minWidth:920,minHeight:700,backgroundColor:'#080809',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,backgroundThrottling:false,navigateOnDragDrop:false,autoplayPolicy:'no-user-gesture-required',additionalArguments:['--any-version='+app.getVersion()]}});
   Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'ANY',submenu:[{label:'Reload ANY',click:()=>{player.close();win.reload();}},{label:'Fullscreen',accelerator:'F11',click:()=>win.setFullScreen(!win.isFullScreen())},{type:'separator'},{role:'quit'}]}]));
   player=new PlayerHost(win);
   const authorize=event=>{if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!trustedUI(event.senderFrame.url))throw Error('Untrusted application frame');};
   const handle=(name,fn)=>ipcMain.handle(name,(event,input)=>{authorize(event);return fn(input);});
   handle('any:open-player',input=>player.open(specification(input)));
   handle('any:close-player',id=>player.close(id));
   handle('any:player-command',input=>player.command(input));
   handle('any:player-bounds',input=>player.setBounds(input));
   handle('any:fullscreen',()=>{win.setFullScreen(!win.isFullScreen());return win.isFullScreen();});
   win.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));win.webContents.session.setPermissionCheckHandler(()=>false);
   win.webContents.session.on('will-download',event=>event.preventDefault());
   win.webContents.setWindowOpenHandler(({url})=>{try{const u=new URL(url);if(u.protocol==='https:'&&['www.youtube.com','youtube.com'].includes(u.hostname))shell.openExternal(u.href).catch(()=>{});}catch{}return {action:'deny'};});
   const guard=(event,url)=>{if(!trustedUI(event.url||url))event.preventDefault();};
   win.webContents.on('will-navigate',guard);win.webContents.on('will-redirect',guard);
   win.webContents.on('did-start-navigation',(_event,_url,inPlace,main)=>{if(main&&!inPlace)player.close();});
   win.webContents.on('did-navigate-in-page',(_event,url,main)=>{if(main&&!new URL(url).hash.startsWith('#/watch/'))player.close();});
   win.webContents.on('render-process-gone',()=>player.close());
   win.on('close',()=>player.close());win.on('closed',()=>{win=null;});
   async function load(){try{await win.loadURL(UI_ORIGIN+'/');}catch{if(!win||win.isDestroyed())return;const result=await dialog.showMessageBox(win,{type:'error',title:'Couldn’t connect to ANY',message:'ANY needs an internet connection. Check your connection and try again.',buttons:['Retry','Close'],defaultId:0,cancelId:1});if(result.response===0)load();else win.close();}}
   load();
  });
 }
}
