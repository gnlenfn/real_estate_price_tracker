import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cronHealth,weeklySchedule} from '../lib/admin-overview';

test('weekly schedule crosses the Sunday 18:00 UTC boundary',()=>{
 assert.equal(weeklySchedule(new Date('2026-09-13T17:59:00Z')).next.toISOString(),'2026-09-13T18:00:00.000Z');
 assert.equal(weeklySchedule(new Date('2026-09-13T18:01:00Z')).previous.toISOString(),'2026-09-13T18:00:00.000Z');
});

test('cron health ignores a later successful manual run',()=>{
 const runs=[
  {id:'manual',trigger:'manual',status:'success',started_at:'2026-09-13T19:00:00Z',finished_at:'2026-09-13T19:01:00Z'},
  {id:'cron',trigger:'cron',status:'failed',started_at:'2026-09-13T18:00:00Z',finished_at:'2026-09-13T18:01:00Z'},
 ];
 assert.equal(cronHealth(runs,new Date('2026-09-13T20:00:00Z'),'2026-09-01T00:00:00Z').health,'failed');
});

test('first schedule is unverified before due and delayed after grace period',()=>{
 assert.equal(cronHealth([],new Date('2026-09-13T17:00:00Z'),'2026-09-12T00:00:00Z').health,'unverified');
 assert.equal(cronHealth([],new Date('2026-09-13T19:01:00Z'),'2026-09-12T00:00:00Z').health,'delayed');
});
