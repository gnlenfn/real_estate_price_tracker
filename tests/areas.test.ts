import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apartmentIdentity,availableAreas} from '../lib/molit';
test('area choices are grouped by integer part, deduplicated, sorted, and scoped to the complex and legal neighborhood',()=>{
 const item={aptNm:'마포 래미안',umdNm:'아현동',excluUseAr:'84.9'};
 assert.deepEqual(availableAreas([item,{...item,excluUseAr:'84.90'},{...item,excluUseAr:'59.95'},{...item,excluUseAr:'84.91'},{...item,umdNm:'다른동',excluUseAr:'100'},{...item,aptNm:'다른단지',excluUseAr:'120'},{...item,excluUseAr:'NaN'},{...item,excluUseAr:'0'},{...item,excluUseAr:'150',cdealType:'O'},{...item,excluUseAr:'151',cdealDay:'20260101'}],'마포래미안','아현동'),[59,84]);
 assert.deepEqual(availableAreas([],'마포래미안','아현동'),[]);
});

test('a selected lot number resolves the official apartment identity even when names differ',()=>{
 const items=[{aptNm:'래미안원베일리',aptSeq:'11650-9999',umdNm:'반포동',jibun:'1-1',excluUseAr:'84.97'},{aptNm:'다른 단지',aptSeq:'11650-1111',umdNm:'반포동',jibun:'2',excluUseAr:'84.9'}];
 assert.deepEqual(apartmentIdentity(items,{name:'원베일리 아파트',dong:'반포동',jibunAddress:'서울 서초구 반포동 1-1'}),{areas:[84],aptSeq:'11650-9999',officialName:'래미안원베일리'});
});

test('aptSeq takes priority over a changed display name',()=>{
 const items=[{aptNm:'새 공식 명칭',aptSeq:'11440-1234',umdNm:'아현동',jibun:'10',excluUseAr:'59.8'}];
 assert.deepEqual(apartmentIdentity(items,{name:'사용자 표시명',dong:'아현동',aptSeq:'11440-1234'}).areas,[59]);
});
