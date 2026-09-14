import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {adminSearchDelay,clearAdminCache,readAdminCache,writeAdminCache} from '../lib/admin-client-cache';

const root=join(import.meta.dirname,'..');
const source=(path:string)=>readFileSync(join(root,path),'utf8');
const adminPages=[
 'app/admin/page.tsx',
 'app/admin/support/page.tsx',
 'app/admin/sync/page.tsx',
 'app/admin/users/page.tsx',
 'app/admin/admins/page.tsx',
 'app/admin/integrations/page.tsx',
 'app/admin/activity/page.tsx',
];

test('Vercel functions run beside the Singapore Supabase project',()=>{
 const config=JSON.parse(source('vercel.json'));
 assert.deepEqual(config.regions,['sin1']);
});

test('admin pages reuse cached data and show an initial loading state',()=>{
 for(const path of adminPages){
  const page=source(path);
  assert.match(page,/readAdminCache/,`${path} does not read cached data`);
  assert.match(page,/writeAdminCache/,`${path} does not refresh cached data`);
  assert.match(page,/AdminDataLoading/,`${path} does not show loading feedback`);
 }
});

test('admin search delay applies only when a search term exists',()=>{
 const cache=source('lib/admin-client-cache.ts');
 assert.match(cache,/query\.trim\(\)\?200:0/);
 for(const path of ['app/admin/support/page.tsx','app/admin/users/page.tsx','app/admin/admins/page.tsx']){
  assert.match(source(path),/adminSearchDelay\(search\)/);
 }
});

test('admin cache reuses the latest value and clears it on logout',()=>{
 clearAdminCache();
 assert.equal(readAdminCache('/api/admin/overview'),undefined);
 writeAdminCache('/api/admin/overview',{unansweredCount:2});
 assert.deepEqual(readAdminCache('/api/admin/overview'),{unansweredCount:2});
 writeAdminCache('/api/admin/overview',{unansweredCount:1});
 assert.deepEqual(readAdminCache('/api/admin/overview'),{unansweredCount:1});
 assert.equal(adminSearchDelay(''),0);
 assert.equal(adminSearchDelay('집업'),200);
 clearAdminCache();
 assert.equal(readAdminCache('/api/admin/overview'),undefined);
});
