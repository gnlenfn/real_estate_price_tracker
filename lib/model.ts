export type Kind = 'trade' | 'estimate' | 'asking';
export type Property = { id: string; name: string; district: string; dong: string; area: number; owned: boolean; color: string; apt_seq?:string|null; kakao_place_id?:string|null; road_address?:string; jibun_address?:string };
export type Record = { id: string; property_id: string; date: string; price: number; kind: Kind; source: string; note: string };
export type Data = { properties: Property[]; records: Record[] };
export type Interval = 'month' | 'week';
export const labels: {[key in Kind]: string} = {trade:'실거래가',estimate:'직접 평가',asking:'호가'};
// `asking` remains readable for existing backups and database rows, but new UI
// only offers the two supported price sources below.
export const supportedKinds = ['trade','estimate'] as const satisfies readonly Kind[];
export const colors = ['#285ee8','#12a18b','#9b75df','#ed9b47','#df6488'];
export const money = (n: number | null | undefined) => n == null ? '—' : `${(n / 10000).toLocaleString('ko-KR',{maximumFractionDigits:2})}억`;
export function median(values: number[]) { const a=[...values].sort((a,b)=>a-b); const m=Math.floor(a.length/2); return a.length ? a.length%2 ? a[m] : (a[m-1]+a[m])/2 : null; }
// Price lines contain only observed monthly medians. Gap points use each side's latest
// known value at an event month so manual home values can be compared with sparse trades.
const isoDate=(date:Date)=>date.toISOString().slice(0,10);
function monday(date:Date){const copy=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));copy.setUTCDate(copy.getUTCDate()-((copy.getUTCDay()+6)%7));return copy;}
function periodKey(date:string,interval:Interval){if(interval==='month')return date.slice(0,7);return isoDate(monday(new Date(`${date.slice(0,10)}T00:00:00Z`)));}
export function series(data: Data, baseId: string, kind: Kind, periods: number, now = new Date(), baseKind: Kind = kind, interval:Interval='month') {
 const keys=interval==='month'?(()=>{const end=now.getUTCFullYear()*12+now.getUTCMonth();return Array.from({length:periods},(_,i)=>{const serial=end-periods+1+i;return `${Math.floor(serial/12)}-${String(serial%12+1).padStart(2,'0')}`;});})():(()=>{const end=monday(now);return Array.from({length:periods},(_,i)=>{const start=new Date(end);start.setUTCDate(start.getUTCDate()-(periods-1-i)*7);return isoDate(start);});})();
 const rows=keys.map(period=>{
 const row: {[key:string]: string|number|null}={month:period,label:interval==='month'?period.slice(2).replace('-','.'):period.slice(5).replace('-','.')};
 for(const p of data.properties) row[p.id]=median(data.records.filter(r=>r.property_id===p.id&&r.kind===(p.id===baseId?baseKind:kind)&&periodKey(r.date,interval)===period).map(r=>r.price));
 return row;
 });
 const latest:{[id:string]:{value:number;month:string}}={};
 const firstMonth=String(rows[0]?.month||'');
 for(const p of data.properties){
  const selectedKind=p.id===baseId?baseKind:kind;
  const prior=data.records.filter(r=>r.property_id===p.id&&r.kind===selectedKind&&periodKey(r.date,interval)<firstMonth).sort((a,b)=>b.date.localeCompare(a.date));
  const priorMonth=prior[0]&&periodKey(prior[0].date,interval);
  if(priorMonth){const value=median(prior.filter(r=>periodKey(r.date,interval)===priorMonth).map(r=>r.price));if(value!=null)latest[p.id]={value,month:priorMonth};}
 }
 for(const row of rows){
  const changed=new Set<string>();
  for(const p of data.properties)if(typeof row[p.id]==='number'){latest[p.id]={value:row[p.id] as number,month:String(row.month)};changed.add(p.id);}
  for(const p of data.properties){
   const gapKey=`gap_${p.id}`;row[gapKey]=null;
   if(p.id===baseId||(!changed.has(baseId)&&!changed.has(p.id)))continue;
   const home=latest[baseId],target=latest[p.id];
   if(home&&target){row[gapKey]=target.value-home.value;row[`gap_base_month_${p.id}`]=home.month;row[`gap_target_month_${p.id}`]=target.month;}
  }
 }
 return rows;
}
export function demoData(): Data {
 const properties:Property[]=[{id:'home',name:'마포래미안푸르지오',district:'11440',dong:'아현동',area:84.9,owned:true,color:colors[0]},{id:'p1',name:'공덕자이',district:'11440',dong:'아현동',area:84.9,owned:false,color:colors[1]},{id:'p2',name:'신촌그랑자이',district:'11440',dong:'대흥동',area:84.9,owned:false,color:colors[2]},{id:'p3',name:'래미안웰스트림',district:'11440',dong:'현석동',area:84.9,owned:false,color:colors[3]}];
 const records:Record[]=[]; const now=new Date();
 for(let i=35;i>=0;i--) { const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,15)); if(d>now)d.setUTCDate(1); properties.forEach((p,j)=>{ const price=Math.round((135000+j*18000+(35-i)*(850+j*90)+Math.sin(i*.6+j)*3500)/100)*100;
 for(const kind of supportedKinds) records.push({id:`demo-${i}-${j}-${kind}`,property_id:p.id,date:d.toISOString().slice(0,10),price:price+(kind==='estimate'?2000:0),kind,source:'예시 데이터',note:'화면 체험을 위한 가상 가격입니다.'}); }); }
 return {properties,records};
}

export function chartAvailability(data:Data,rows:ReturnType<typeof series>,baseId:string,kind:Kind,baseKind:Kind,chart:'gap'|'price'){
 const hasValue=(id:string)=>rows.some(row=>typeof row[id]==='number'&&Number.isFinite(row[id]));
 const visible=data.properties.filter(p=>chart==='price'||(p.id!==baseId&&!p.owned));
 if(visible.some(p=>hasValue(chart==='gap'?`gap_${p.id}`:p.id)))return null;
 if(!data.records.length)return '아직 가격 기록이 없습니다. 실거래를 불러오거나 가격을 직접 기록해 주세요.';
 if(chart==='gap'&&!hasValue(baseId))return `선택한 기간에 기준 부동산의 ${labels[baseKind]} 기록이 없습니다. 기준 가격 종류를 바꾸거나 기록을 추가해 주세요.`;
 if(!data.properties.some(p=>p.id!==baseId))return '비교할 관심단지를 추가해 주세요.';
 if(!data.records.some(r=>data.properties.some(p=>p.id===r.property_id&&!p.owned)&&r.kind===kind))return `관심단지의 ${labels[kind]} 기록이 없습니다. 실거래를 먼저 불러와 주세요.`;
 return chart==='gap'?'선택 기간에 보유 주택이나 관심단지의 가격 변화가 없습니다. 조회 기간을 늘리거나 가격 기록을 추가해 주세요.':'선택한 기간에 표시할 가격이 없습니다. 조회 기간이나 가격 기준을 바꿔 주세요.';
}
