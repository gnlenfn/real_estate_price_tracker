import {test} from 'node:test';
import assert from 'node:assert/strict';
import {retryTargets} from '../lib/sync-retry';

test('retry targets preserve exact property-month pairs and remove duplicates',()=>{
 assert.deepEqual(retryTargets([
  {propertyId:'a',month:'2026-08'},
  {propertyId:'a',month:'2026-08'},
  {propertyId:'b',month:'2026-09'},
  {propertyId:'',month:'2026-09'},
  {propertyId:'c',month:'invalid'},
 ]),[{propertyId:'a',month:'2026-08'},{propertyId:'b',month:'2026-09'}]);
});
