// Only the marker moves while a key is held. Releasing sends one absolute seek.
export class HeldSeek {
 constructor(){this.cancel();}
 cancel(){this.preview=null;this.key=null;this.startedAt=0;this.lastStep=0;}
 handle({key,type='keydown',repeat=false,timeStamp=0},position,duration,commit){
  const direction=key==='ArrowLeft'?-1:key==='ArrowRight'?1:0;
  if(!direction)return false;
  if(type==='keyup'){
   if(this.key===key){const target=this.preview;this.cancel();if(target!==null&&Number.isFinite(duration)&&duration>0)commit(Math.max(0,Math.min(target,duration)));}
   return true;
  }
  if(type!=='keydown'||!Number.isFinite(duration)||duration<=0||!Number.isFinite(position))return false;
  if(this.key===null&&repeat)return true;
  const fresh=this.key!==key||!repeat;
  if(fresh)this.startedAt=timeStamp;
  if(fresh||timeStamp-this.lastStep>=150){
   const held=Math.max(0,timeStamp-this.startedAt),step=held>=8000?60:held>=5000?30:held>=2000?20:10;
   this.preview=Math.max(0,Math.min((this.preview??position)+direction*step,duration));
   this.key=key;this.lastStep=timeStamp;
  }
  return true;
 }
}
