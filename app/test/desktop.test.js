import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopPartySource} from '../src/desktop.js';
test('new desktop parties always choose Movish regardless of source order; no silent fallback',()=>{
 assert.equal(desktopPartySource(['vidfast','vidcore','movish']),'movish');
 assert.equal(desktopPartySource(['vidfast','vidcore']),undefined);
});
