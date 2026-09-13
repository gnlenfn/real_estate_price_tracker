import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const page=readFileSync(join(import.meta.dirname,'../app/page.tsx'),'utf8');

test('price record dialog offers a dated trade reload flow',()=>{
 assert.match(page,/직접 입력/);
 assert.match(page,/실거래 다시 조회/);
 assert.match(page,/reloadTrades/);
 assert.match(page,/syncMonths/);
});
