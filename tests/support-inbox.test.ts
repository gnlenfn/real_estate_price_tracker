import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendAttachments,canReply,validateAttachment,validateAttachments} from '../lib/support-inbox';

test('accepts up to three supported five megabyte images',()=>{
 assert.equal(validateAttachments([
  {type:'image/png',size:5*1024*1024},
  {type:'image/jpeg',size:123},
  {type:'image/webp',size:456},
 ]),null);
});

test('rejects a fourth image and unsupported or oversized files',()=>{
 assert.match(validateAttachments(Array.from({length:4},()=>({type:'image/png',size:1})))||'',/3개/);
 assert.match(validateAttachment({type:'image/gif',size:1})||'',/PNG/);
 assert.match(validateAttachment({type:'image/png',size:5*1024*1024+1})||'',/5MB/);
});

test('closed tickets cannot receive a user reply',()=>{
 assert.equal(canReply('open'),true);
 assert.equal(canReply('answered'),true);
 assert.equal(canReply('closed'),false);
});

test('pasted images append only until the attachment limit',()=>{
 assert.deepEqual(appendAttachments(['first'],['second','third','fourth']),['first','second','third']);
});
