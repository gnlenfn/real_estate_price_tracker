import {test} from 'node:test';
import assert from 'node:assert/strict';
import {median,series,Data} from '../lib/model';
import {parsePage,matchTrades,fetchMolitResponse} from '../lib/molit';
const property={id:'a',name:'테스트 아파트',district:'11440',dong:'아현동',area:84.9,owned:true,color:'#000'};
const data:Data={properties:[property,{...property,id:'b'}],records:[{id:'1',property_id:'a',date:'2026-01-01',price:100000,kind:'trade',source:'test',note:''},{id:'2',property_id:'a',date:'2026-01-02',price:120000,kind:'trade',source:'test',note:''},{id:'3',property_id:'b',date:'2026-01-01',price:150000,kind:'trade',source:'test',note:''},{id:'4',property_id:'b',date:'2026-02-01',price:170000,kind:'trade',source:'test',note:''},{id:'5',property_id:'a',date:'2026-01-01',price:190000,kind:'asking',source:'test',note:''}]};
test('monthly price medians stay sparse while gaps use the latest known values',()=>{const rows=series(data,'a','trade',2,new Date('2026-02-15'));assert.equal(rows[0].a,110000);assert.equal(rows[0].gap_b,40000);assert.equal(rows[1].a,null);assert.equal(rows[1].gap_b,60000);assert.equal(rows[1].gap_base_month_b,'2026-01');assert.equal(rows[1].gap_target_month_b,'2026-02');assert.equal(series(data,'a','asking',2,new Date('2026-02-15'))[0].a,190000);});
test('median handles empty and odd inputs',()=>{assert.equal(median([]),null);assert.equal(median([4,1,2]),2);});
test('XML normalizes singleton, empty response and propagates upstream error',()=>{assert.equal(parsePage('<response><header><resultCode>000</resultCode></header><body><totalCount>1</totalCount><items><item><aptNm>A</aptNm></item></items></body></response>').items.length,1);assert.equal(parsePage('<response><header><resultCode>00</resultCode></header><body><totalCount>0</totalCount><items/></body></response>').items.length,0);assert.throws(()=>parsePage('<response><header><resultCode>30</resultCode></header></response>'));assert.throws(()=>parsePage('<html>error</html>'));});
test('MOLIT HTTP requests retry transient failures but not client errors',async()=>{let calls=0;const recovered=await fetchMolitResponse(new URL('https://example.test'),{},async()=>new Response(++calls<3?'busy':'ok',{status:calls<3?503:200}),async()=>{});assert.equal(await recovered.text(),'ok');assert.equal(calls,3);calls=0;await assert.rejects(()=>fetchMolitResponse(new URL('https://example.test'),{},async()=>{calls++;return new Response('bad',{status:400});},async()=>{}),/HTTP 400/);assert.equal(calls,1);});
test('match exact complex and dong, integer area group, excluding cancellations',()=>{const item={aptNm:'테스트아파트',umdNm:'아현동',excluUseAr:'84.91',dealAmount:'150,000',dealYear:'2026',dealMonth:'1',dealDay:'3',floor:'12',cdealType:'',cdealDay:''};const rows=matchTrades([item,{...item,cdealType:'O'},{...item,cdealDay:'26.01.10'},{...item,umdNm:'다른동'},{...item,excluUseAr:'59.9'},{...item,aptNm:'테스트아파트2'}],property,'2026-01');assert.equal(rows.length,1);assert.equal(rows[0].price,150000);assert.equal(rows[0].date,'2026-01-03');});

test('integer area grouping includes all decimals, respects boundaries, and handles legacy selections',()=>{
 const item={aptNm:'테스트아파트',umdNm:'아현동',dealAmount:'100,000',dealYear:'2026',dealMonth:'1',dealDay:'3',floor:'12'};
 const items=['83.99','84','84.01','84.9','84.999','85','59.99','invalid',''].map(excluUseAr=>({...item,excluUseAr}));
 for(const area of [84,84.9]){
  const rows=matchTrades(items,{...property,area},'2026-01');
  assert.equal(rows.length,4);
  assert.match(rows[3].note,/84.999㎡/);
 }
 assert.equal(matchTrades(items,{...property,area:59},'2026-01').length,1);
 assert.equal(matchTrades(items,{...property,area:NaN},'2026-01').length,0);
});
