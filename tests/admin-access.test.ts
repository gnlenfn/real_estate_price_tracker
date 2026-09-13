import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AdminAccessError,adminAccessResponse} from '../lib/admin-server';
import {adminEventRow} from '../lib/admin-audit';

test('admin access errors map to safe 401 and 403 responses',async()=>{
 for(const [kind,status] of [['unauthorized',401],['forbidden',403]] as const){
  const response=adminAccessResponse(new AdminAccessError(kind));
  assert.equal(response?.status,status);
  const body=await response?.json();
  assert.equal(Object.hasOwn(body,'stack'),false);
 }
 assert.equal(adminAccessResponse(new Error('db details')),null);
});

test('audit rows keep metadata and never copy message content',()=>{
 const row=adminEventRow({actorId:'actor',action:'support.reply',targetId:'ticket',requestId:'request',outcome:'success',beforeStatus:'open',afterStatus:'answered'});
 assert.deepEqual(row,{actor_id:'actor',action:'support.reply',target_id:'ticket',request_id:'request',outcome:'success',before_status:'open',after_status:'answered'});
 assert.equal(Object.hasOwn(row,'body'),false);
});
