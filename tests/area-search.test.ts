import {test} from 'node:test';
import assert from 'node:assert/strict';
import {areaSearchKey} from '../lib/area-search';

test('area lookup starts only for a complete selected apartment and changes with its identity',()=>{
 const selected={district:'11680',dong:'반포동',name:' 래미안 원베일리 ',jibunAddress:'서울 서초구 반포동 1-1'};
 assert.equal(areaSearchKey(selected),'11680|반포동|래미안 원베일리|서울 서초구 반포동 1-1');
 assert.equal(areaSearchKey({...selected,name:'   '}),'');
 assert.notEqual(areaSearchKey(selected),areaSearchKey({...selected,jibunAddress:'서울 서초구 반포동 2-2'}));
});
