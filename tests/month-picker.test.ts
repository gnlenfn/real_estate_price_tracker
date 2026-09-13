import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthChoices} from '../app/components/month-picker';

test('month calendar exposes twelve months and disables dates outside the range',()=>{
 const months=monthChoices(2026,'2026-03','2026-09');
 assert.equal(months.length,12);
 assert.equal(months[1].disabled,true);
 assert.equal(months[2].disabled,false);
 assert.equal(months[8].disabled,false);
 assert.equal(months[9].disabled,true);
});
