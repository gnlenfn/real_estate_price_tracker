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

test('property list exposes bulk trade reload controls',()=>{
 assert.match(page,/selectedPropertyIds/);
 assert.match(page,/전체 선택/);
 assert.match(page,/전체 다시 조회/);
 assert.match(page,/bulkTradeModal/);
 assert.match(page,/가격 조회/);
});

test('bulk trade dialog submits the selected properties and period',()=>{
 assert.match(page,/name="bulk-start"/);
 assert.match(page,/name="bulk-end"/);
 assert.match(page,/executeBulkTradeReload\(/);
 assert.match(page,/setSelectedPropertyIds\(\[\]\)/);
 assert.match(page,/기존 가격 기록은 유지/);
 assert.match(page,/조회할 부동산을 선택/);
});
