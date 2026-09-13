import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const sql=readFileSync(join(import.meta.dirname,'../supabase/migrations/20260914010000_add_admin_role_management.sql'),'utf8');
test('admin role migration enforces one super admin and atomic role RPCs',()=>{
 assert.match(sql,/role in \('super_admin', 'admin'\)/i);
 assert.match(sql,/unique index[\s\S]+where role = 'super_admin'/i);
 for(const fn of ['is_super_admin','grant_admin','revoke_admin','transfer_super_admin'])assert.match(sql,new RegExp(`function admin\\.${fn}`,'i'));
 for(const action of ['admin.grant','admin.revoke','admin.transfer'])assert.match(sql,new RegExp(action.replace('.','\\.')));
 assert.match(sql,/to service_role/i);
 assert.match(sql,/revoke all on function admin\.grant_admin[\s\S]+from public,anon,authenticated/i);
});
