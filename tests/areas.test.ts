import {test} from 'node:test';
import assert from 'node:assert/strict';
import {availableAreas} from '../lib/molit';
test('area choices are grouped by integer part, deduplicated, sorted, and scoped to the complex and legal neighborhood',()=>{
 const item={aptNm:'마포 래미안',umdNm:'아현동',excluUseAr:'84.9'};
 assert.deepEqual(availableAreas([item,{...item,excluUseAr:'84.90'},{...item,excluUseAr:'59.95'},{...item,excluUseAr:'84.91'},{...item,umdNm:'다른동',excluUseAr:'100'},{...item,aptNm:'다른단지',excluUseAr:'120'},{...item,excluUseAr:'NaN'},{...item,excluUseAr:'0'},{...item,excluUseAr:'150',cdealType:'O'},{...item,excluUseAr:'151',cdealDay:'20260101'}],'마포래미안','아현동'),[59,84]);
 assert.deepEqual(availableAreas([],'마포래미안','아현동'),[]);
});
