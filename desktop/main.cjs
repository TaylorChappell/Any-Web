'use strict';
const {app,BrowserWindow,Menu,dialog,shell}=require('electron');
const path=require('node:path');
const {UI_ORIGIN,trustedUI}=require('./lib/policy.cjs');
const {PlayerHost}=require('./lib/player-host.cjs');
const {registerWindowBridge}=require('./lib/window-bridge.cjs');
const {DesktopUpdates}=require('./lib/updates.cjs');
if(process.argv.some(a=>a.startsWith('--update-self-test='))){
 app.whenReady().then(()=>require('./test/update-smoke.cjs').run(process.argv.find(a=>a.startsWith('--update-self-test=')).slice(19))).then(()=>app.exit(0)).catch(error=>{console.error(error);app.exit(1);});
}else if(process.argv.includes('--self-test')){
 app.whenReady().then(()=>require('./test/electron-smoke.cjs').run()).then(()=>app.exit(0)).catch(error=>{console.error(error);app.exit(1);});
}else{
 const lock=app.requestSingleInstanceLock();if(!lock)app.quit();else{
  let win,player,updates;
  app.setAppUserModelId('fun.anymovies.desktop');
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
  app.on('window-all-closed',()=>app.quit());
  app.whenReady().then(()=>{
   win=new BrowserWindow({title:'ANY',width:1360,height:850,minWidth:920,minHeight:700,backgroundColor:'#080809',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,backgroundThrottling:false,navigateOnDragDrop:false,autoplayPolicy:'no-user-gesture-required',additionalArguments:['--any-version='+app.getVersion()]}});
   updates=new DesktopUpdates(require('electron-updater').autoUpdater,{version:app.getVersion(),enabled:app.isPackaged&&process.platform==='win32',notify:state=>{if(win&&!win.isDestroyed())win.webContents.send('any:update-state',state);},confirm:async version=>{if(!win||win.isDestroyed())return false;const result=await dialog.showMessageBox(win,{type:'question',title:'Update ANY',message:`Restart and install ANY ${version}?`,detail:'This closes playback and leaves your Together party. Your profiles and watch history are kept.',buttons:['Restart and install','Later'],defaultId:1,cancelId:1});return result.response===0;}});
   async function checkUpdates(){const s=await updates.check();if(!win||win.isDestroyed())return;const downloadable=s.status==='available',installable=s.status==='downloaded';const result=await dialog.showMessageBox(win,{type:s.status==='error'?'error':'info',title:'ANY updates',message:downloadable?`ANY ${s.version} is available.`:installable?`ANY ${s.version} is ready to install.`:s.status==='current'?`You’re up to date: ANY ${app.getVersion()}.`:s.status==='error'?s.error:s.status==='unavailable'?'Updates are available in the installed Windows app.':'Checking or downloading an update…',buttons:downloadable?['Download update','Later']:installable?['Restart and install','Later']:['OK'],defaultId:downloadable||installable?1:0,cancelId:downloadable||installable?1:0});if(result.response===0){if(downloadable)updates.download();else if(installable)updates.install();}}
   Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'ANY',submenu:[{label:'Check for updates…',click:checkUpdates},{type:'separator'},{label:'Reload ANY',click:()=>{player.close();win.reload();}},{label:'Fullscreen',accelerator:'F11',click:()=>win.setFullScreen(!win.isFullScreen())},{type:'separator'},{role:'quit'}]}]));
   player=new PlayerHost(win);
   registerWindowBridge(win,player,{updates});updates.start();
   win.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));win.webContents.session.setPermissionCheckHandler(()=>false);
   win.webContents.session.on('will-download',event=>event.preventDefault());
   win.webContents.setWindowOpenHandler(({url})=>{try{const u=new URL(url);if(u.protocol==='https:'&&(['www.youtube.com','youtube.com'].includes(u.hostname)||(u.origin==='https://github.com'&&u.pathname==='/TaylorChappell/Any-Web/releases/latest')))shell.openExternal(u.href).catch(()=>{});}catch{}return {action:'deny'};});
   const guard=(event,url)=>{if(!trustedUI(event.url||url))event.preventDefault();};
   win.webContents.on('will-navigate',guard);win.webContents.on('will-redirect',guard);
   win.webContents.on('did-start-navigation',(_event,_url,inPlace,main)=>{if(main&&!inPlace)player.close();});
   win.webContents.on('did-navigate-in-page',(_event,url,main)=>{if(main&&!new URL(url).hash.startsWith('#/watch/'))player.close();});
   win.webContents.on('render-process-gone',()=>player.close());
   win.on('close',()=>player.close());win.on('closed',()=>{updates.stop();win=null;});
   async function load(){try{await win.loadURL(UI_ORIGIN+'/');}catch{if(!win||win.isDestroyed())return;const result=await dialog.showMessageBox(win,{type:'error',title:'Couldn’t connect to ANY',message:'ANY needs an internet connection. Check your connection and try again.',buttons:['Retry','Close'],defaultId:0,cancelId:1});if(result.response===0)load();else win.close();}}
   load();
  });
 }
}
