import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recentKoreaMonths,runScheduledSync,type ScheduledProperty} from '../lib/weekly-sync';

const base:ScheduledProperty={id:'a',user_id:'u1',name:'테스트아파트',district:'11440',dong:'아현동',area:84,owned:false,color:'#000'};

test('weekly sync refreshes the previous and current Korea month',()=>{
 assert.deepEqual(recentKoreaMonths(new Date('2026-01-01T00:00:00Z')),['2025-12','2026-01']);
 assert.deepEqual(recentKoreaMonths(new Date('2025-12-31T14:59:59Z')),['2025-11','2025-12']);
});

test('properties in one district share one provider response per month',async()=>{
 const properties=[base,{...base,id:'b',user_id:'u2'}];let loads=0;const saved:string[]=[];
 const summary=await runScheduledSync(properties,['2026-08','2026-09'],async()=>{loads++;return [];},async(property,month)=>{saved.push(`${property.id}:${month}`);});
 assert.equal(loads,2);assert.equal(saved.length,4);assert.equal(summary.completed,4);assert.equal(summary.failures.length,0);
});

test('one district failure is reported without stopping other districts',async()=>{
 const properties=[base,{...base,id:'b',district:'11680'}];
 const summary=await runScheduledSync(properties,['2026-09'],async district=>{if(district==='11440')throw new Error('provider down');return [];},async()=>{});
 assert.equal(summary.completed,1);assert.equal(summary.failures.length,1);assert.equal(summary.failures[0].propertyId,'a');
});
