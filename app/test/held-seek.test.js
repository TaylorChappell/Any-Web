import test from 'node:test';
import assert from 'node:assert/strict';
import {HeldSeek} from '../src/held-seek.js';
import {seriesStatus} from '../src/experience-model.js';
test('held seeking accelerates locally and sends one seek on release',()=>{
 const s=new HeldSeek(),sent=[],key=(timeStamp,repeat=true,key='ArrowRight',type='keydown')=>s.handle({key,type,timeStamp,repeat},100,1000,t=>sent.push(t));
 key(1000,false);assert.equal(s.preview,110);
 key(2999);assert.equal(s.preview,120);
 key(3200);assert.equal(s.preview,140);
 key(6000);assert.equal(s.preview,170);
 key(9000);assert.equal(s.preview,230);assert.deepEqual(sent,[]);
 key(9100,true,'ArrowRight','keyup');key(9200,true,'ArrowRight','keyup');assert.deepEqual(sent,[230]);assert.equal(s.preview,null);
 key(9300,false);assert.equal(s.preview,110,'a new tap starts at ten seconds');
});
test('reversal resets acceleration, old releases are ignored, and cancelled holds cannot seek',()=>{
 const s=new HeldSeek(),sent=[],key=(key,timeStamp,repeat=false,type='keydown')=>s.handle({key,type,timeStamp,repeat},100,1000,t=>sent.push(t));
 key('ArrowRight',1000);key('ArrowRight',9000,true);assert.equal(s.preview,170);
 key('ArrowLeft',9200);assert.equal(s.preview,160);key('ArrowRight',9300,false,'keyup');assert.deepEqual(sent,[]);
 s.cancel();key('ArrowLeft',9400,true);key('ArrowLeft',9500,false,'keyup');assert.equal(s.preview,null);assert.deepEqual(sent,[]);
});
test('accelerated seek stays inside the video and repeated events are throttled',()=>{
 const s=new HeldSeek(),sent=[];
 for(const [timeStamp,repeat] of [[1000,false],[1010,true],[9000,true],[9200,true]])s.handle({key:'ArrowLeft',timeStamp,repeat},100,1000,t=>sent.push(t));
 assert.equal(s.preview,0);s.handle({key:'ArrowLeft',type:'keyup'},100,1000,t=>sent.push(t));assert.deepEqual(sent,[0]);
 s.handle({key:'ArrowRight',timeStamp:10000},995,1000,()=>{});assert.equal(s.preview,1000);
});
test('series status distinguishes a completed run from cancellation',()=>{
 assert.equal(seriesStatus('Returning Series'),'Series ongoing');assert.equal(seriesStatus('Canceled'),'Series cancelled');assert.equal(seriesStatus('Ended'),'Series ended');assert.equal(seriesStatus('null'),'');
});
