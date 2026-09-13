import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicAdminUser} from '../lib/admin-users';

test('admin user projection returns only approved operational fields',()=>{
 const result=publicAdminUser({id:'u1',nickname:'차분한 카라칼',joined_at:'2026-09-01',property_count:2,ticket_count:1,last_activity_at:null,email:'hidden@example.com',raw_user_meta_data:{name:'hidden'}});
 assert.deepEqual(result,{id:'u1',nickname:'차분한 카라칼',joinedAt:'2026-09-01',propertyCount:2,ticketCount:1,lastActivityAt:null});
 assert.equal(Object.hasOwn(result,'email'),false);
 assert.equal(Object.hasOwn(result,'raw_user_meta_data'),false);
});
