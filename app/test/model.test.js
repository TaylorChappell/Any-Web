import test from 'node:test';
import assert from 'node:assert/strict';
import {titleOf,progressValue,continueWatching,feedbackValue,seasonal,recommendationSeeds} from '../src/model.js';
const title=titleOf({id:1399,name:'A series',genre_ids:[18,10765]},'tv');
test('series progress uses the same keys as Android and only the latest episode is resumed',()=>{const old={...progressValue(title,1,1,250,1800),updated:1},newer={...progressValue(title,1,2,100,1800),updated:2};const library={progress:[old,newer],feedback:[]};assert.equal(old.key,'tv:1399:1:1');assert.equal(continueWatching(library)[0].episode,2);newer.complete=true;assert.equal(continueWatching(library).length,0);newer.complete=false;library.feedback=[feedbackValue(title,{hideContinue:true})];assert.equal(continueWatching(library).length,0)});
test('seasonal collections roll over automatically at the agreed dates',()=>{assert.equal(seasonal(new Date(2026,9,12)).key,'halloween');assert.equal(seasonal(new Date(2026,10,15)).key,'christmas');assert.equal(seasonal(new Date(2026,11,27)).key,'newyear');assert.equal(seasonal(new Date(2027,0,4)),null);assert.equal(seasonal(new Date(2026,3,5)).key,'easter')});
test('thumbs down removes a watched title as a recommendation seed',()=>{const p=progressValue(title,1,1,200,1800);assert.equal(recommendationSeeds({progress:[p],feedback:[]}).length,1);assert.equal(recommendationSeeds({progress:[p],feedback:[feedbackValue(title,{notInterested:true})]}).length,0)});

test('MCU release sorting retains distinct seasons and hides upcoming or undated entries',async()=>{
 const {releasedCollection,titleOf}=await import('../src/model.js');
 const base={id:1,media_type:'tv',title:'Series',collection_category:'series'};
 const rows=releasedCollection([{...base,release_date:'2023-01-01',collection_season:2},{...base,release_date:'2021-01-01',collection_season:1},{...base,release_date:'2027-01-01',collection_season:3},{...base,release_date:'',collection_season:4},{id:2,media_type:'movie',release_date:'2022-01-01'}],'2026-10-12');
 assert.deepEqual(rows.map(t=>t.collection_season||0),[1,0,2]);assert.equal(titleOf(rows[2]).collection_season,2);
});
