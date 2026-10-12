'use strict';
const {WebContentsView,session}=require('electron');
const {randomUUID}=require('node:crypto');
const {allowedPlayerURL,playerCommand,bounds,validSample}=require('./policy.cjs');
const {installVideoBridge}=require('./video-bridge.cjs');
const WORLD=1001;
class PlayerHost{
 constructor(win,{emit,key}={}){this.win=win;this.emit=emit||((data)=>win.webContents.send('any:player-event',data));this.key=key||((data)=>win.webContents.send('any:player-key',data));this.current=null;const resize=()=>{if(this.current?.boundsInput)this.setBounds(this.current.boundsInput);};win.on('resize',resize);win.on('enter-full-screen',resize);win.on('leave-full-screen',resize);}
 async open(spec){
  this.close();const ses=session.fromPartition('any-player-'+randomUUID());
  ses.setPermissionRequestHandler((_w,_p,callback)=>callback(false));ses.setPermissionCheckHandler(()=>false);
  ses.on('will-download',event=>event.preventDefault());
  const view=new WebContentsView({webPreferences:{session:ses,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,autoplayPolicy:'no-user-gesture-required',backgroundThrottling:false,navigateOnDragDrop:false}});
  const current={view,spec,busy:false,injected:false,visible:false,lastBeat:Date.now(),timer:null};this.current=current;
  this.win.contentView.addChildView(view);view.setBounds({x:0,y:0,width:0,height:0});view.setVisible(false);view.setBackgroundColor('#000000');
  const wc=view.webContents;
  wc.setWindowOpenHandler(()=>({action:'deny'}));
  const guard=(event,url)=>{if(!allowedPlayerURL(event.url||url,spec))event.preventDefault();};
  wc.on('will-navigate',guard);wc.on('will-redirect',guard);
  wc.on('did-start-navigation',(_event,_url,inPlace,main)=>{if(main&&!inPlace)current.injected=false;});
  wc.on('dom-ready',()=>this.inject(current));
  wc.on('did-navigate-in-page',(_event,url,main)=>{if(main&&!allowedPlayerURL(url,spec)){this.notify(current,{kind:'error',message:'The source changed title or episode. Use ANY’s episode controls or reload the player.'});this.close(spec.session);}});
  wc.on('did-fail-load',(_event,code,_description,_url,main)=>{if(main&&code!==-3)this.notify(current,{kind:'error',message:'The source could not load. Reload the player or choose another source.'});});
  wc.on('render-process-gone',()=>{this.notify(current,{kind:'error',message:'The video process stopped. Reload the player.'});this.close(spec.session);});
  wc.on('before-input-event',(event,input)=>{
   if(input.type!=='keyDown'||input.control||input.meta||input.alt)return;
   if([' ','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape','Tab'].includes(input.key)){event.preventDefault();this.key({session:spec.session,key:input.key});}
  });
  let lastPointer=0,lastPointerPosition='';
  wc.on('before-mouse-event',(_event,mouse)=>{
   if(!['mouseMove','mouseDown','mouseWheel'].includes(mouse.type))return;
   const rect=view.getBounds(),point=`${mouse.globalX??mouse.x+rect.x}:${mouse.globalY??mouse.y+rect.y}`;
   if(mouse.type==='mouseMove'&&point===lastPointerPosition)return;
   if(mouse.type==='mouseMove'&&Date.now()-lastPointer<200)return;
   lastPointerPosition=point;lastPointer=Date.now();this.notify(current,{kind:'pointer'});
  });
  current.timer=setInterval(()=>{
   if(Date.now()-current.lastBeat>8000){this.notify(current,{kind:'error',message:'The app connection to the player stopped. Reload the player.'});this.close(spec.session);return;}
   // On Windows, fullscreen events can precede the final native content size.
   // Reconcile it during the existing heartbeat without resizing unchanged views.
   if(current.boundsInput?.fillWindow)this.syncBounds(current);
   this.poll(current);
  },250);
  wc.loadURL(spec.url).catch(()=>{});return {session:spec.session};
 }
 notify(current,data){if(this.current===current&&!this.win.isDestroyed())this.emit({session:current.spec.session,...data});}
 async inject(current){
  if(this.current!==current||current.view.webContents.isDestroyed()||!allowedPlayerURL(current.view.webContents.getURL(),current.spec))return;
  try{const code=`(${installVideoBridge.toString()})(${JSON.stringify(current.spec)})`;current.injected=await current.view.webContents.executeJavaScriptInIsolatedWorld(WORLD,[{code}]);}catch(error){current.injected=false;current.lastError=error.message;}
 }
 async poll(current){
  if(this.current!==current||current.busy||!current.injected)return;
  if(!allowedPlayerURL(current.view.webContents.getURL(),current.spec)){this.close(current.spec.session);return;}
  current.busy=true;
  try{const events=await current.view.webContents.executeJavaScriptInIsolatedWorld(WORLD,[{code:'globalThis.__ANY_NATIVE_PLAYER__?.poll() || []'}]);
   if(this.current===current&&Array.isArray(events))for(const data of events.slice(-17))if(validSample(data))this.notify(current,{kind:'status',data});
  }catch(error){current.lastError=error.message;}finally{current.busy=false;}
 }
 async command(input){
  const cmd=playerCommand(input),current=this.current;if(!current||current.spec.session!==input.session)return false;
  current.lastBeat=Date.now();if(cmd.command==='getStatus'){await this.poll(current);return true;}
  if(!current.injected||!allowedPlayerURL(current.view.webContents.getURL(),current.spec))return false;
  try{return await current.view.webContents.executeJavaScriptInIsolatedWorld(WORLD,[{code:`globalThis.__ANY_NATIVE_PLAYER__?.control(${JSON.stringify(cmd.command)},${JSON.stringify(cmd.time??null)}) || false`}]);}catch{return false;}
 }
 syncBounds(current){const rect=bounds(current.boundsInput,this.win.getContentSize()),previous=current.view.getBounds();if(['x','y','width','height'].some(k=>rect[k]!==previous[k]))current.view.setBounds(rect);const visible=current.boundsInput.visible&&rect.width>0&&rect.height>0;if(visible!==current.visible)current.view.setVisible(visible);current.visible=visible;}
 setBounds(input){const current=this.current;if(!current||current.spec.session!==input.session)return false;bounds(input,this.win.getContentSize());current.boundsInput={...input};this.syncBounds(current);return true;}
 close(id){const current=this.current;if(!current||id&&current.spec.session!==id)return;this.current=null;clearInterval(current.timer);this.win.contentView.removeChildView(current.view);if(!current.view.webContents.isDestroyed())current.view.webContents.close();}
}
module.exports={PlayerHost};
