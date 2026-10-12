'use strict';
// Only the main process owns the updater and its packaged GitHub release feed.
class DesktopUpdates {
 constructor(updater,{version,enabled=true,notify=()=>{},confirm=async()=>false,now=Date.now}={}) {
  this.updater=updater;this.enabled=enabled;this.notify=notify;this.confirm=confirm;this.now=now;
  this.state={status:enabled?'idle':'unavailable',currentVersion:version,version:null,percent:0,checkedAt:null,error:''};
  this.pending=null;this.confirming=false;this.timer=null;this.startTimer=null;
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.autoRunAppAfterInstall=true;
  updater.allowDowngrade=false;updater.allowPrerelease=false;
  updater.on('checking-for-update',()=>this.set({status:'checking',error:''}));
  updater.on('update-available',info=>this.set({status:'available',version:info.version,percent:0,checkedAt:this.now(),error:''}));
  updater.on('update-not-available',()=>this.set({status:'current',version:null,percent:0,checkedAt:this.now(),error:''}));
  updater.on('download-progress',p=>this.set({status:'downloading',percent:Math.min(100,Math.max(0,Number(p.percent)||0))}));
  updater.on('update-downloaded',info=>this.set({status:'downloaded',version:info.version,percent:100,error:''}));
  updater.on('error',()=>this.fail());
 }
 snapshot(){return {...this.state};}
 set(patch){this.state={...this.state,...patch};this.notify(this.snapshot());return this.snapshot();}
 fail(){return this.set({status:'error',error:'Couldn’t complete the update. Check your internet connection and try again.'});}
 async check(){
  if(!this.enabled||this.pending||['downloading','downloaded','installing'].includes(this.state.status))return this.snapshot();
  this.set({status:'checking',error:''});
  this.pending=Promise.resolve().then(()=>this.updater.checkForUpdates());
  try{await this.pending;}catch{this.fail();}finally{this.pending=null;}
  return this.snapshot();
 }
 async download(){
  if(!this.enabled||this.pending||this.state.status!=='available')return this.snapshot();
  this.set({status:'downloading',percent:0,error:''});
  this.pending=Promise.resolve().then(()=>this.updater.downloadUpdate());
  try{await this.pending;}catch{this.fail();}finally{this.pending=null;}
  return this.snapshot();
 }
 async install(){
  if(!this.enabled||this.confirming||this.state.status!=='downloaded')return this.snapshot();
  this.confirming=true;
  try{if(await this.confirm(this.state.version)){
   this.set({status:'installing'});
   // Let the IPC reply and the UI settle before the updater closes the windows.
   setImmediate(()=>{try{this.updater.quitAndInstall(true,true);}catch{this.fail();}});
  }}finally{this.confirming=false;}
  return this.snapshot();
 }
 start(){if(!this.enabled||this.timer)return;this.startTimer=setTimeout(()=>this.check(),10000);this.timer=setInterval(()=>this.check(),6*60*60*1000);this.startTimer.unref?.();this.timer.unref?.();}
 stop(){clearTimeout(this.startTimer);clearInterval(this.timer);this.timer=null;}
}
module.exports={DesktopUpdates};
