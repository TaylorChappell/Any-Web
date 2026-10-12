// Only the installed app provides this narrow, context-isolated bridge.
export function desktopBridge(){const b=globalThis.window?.anyDesktop;return b?.protocolVersion===1&&['openPlayer','closePlayer','playerCommand','setPlayerBounds','onPlayerEvent','onPlayerKey','fullscreen'].every(k=>typeof b[k]==='function')?b:null;}
export const desktopPartySource=sources=>['movish','vidfast','vidcore'].find(id=>sources.includes(id));
export const desktopPartySupported=id=>['movish','vidfast','vidcore'].includes(id);
export function nativePlayerEvent(message,session){
 if(message?.session!==session||message.kind!=='status')return null;const d=message.data;
 if(!d||!['play','pause','seeked','ended','timeupdate','playerstatus'].includes(d.event)||!Number.isFinite(d.position)||!Number.isFinite(d.duration)||d.duration<0||d.duration>172800||d.position<0||d.position>d.duration+2||typeof d.playing!=='boolean'||typeof d.controllable!=='boolean'||typeof d.playable!=='boolean')return null;
 return {...d,origin:'native'};
}
