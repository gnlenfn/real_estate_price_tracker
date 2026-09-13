import type {Data,Kind,Record as PriceRecord} from './model';

export type RecordFilter={kind:Kind;propertyId:string;query:string;years:number|null;now?:Date};

export function filterRecords(data:Data,filter:RecordFilter):PriceRecord[]{
 const names=new Map(data.properties.map(property=>[property.id,property.name]));
 const query=filter.query.trim().toLocaleLowerCase('ko-KR');
 const now=filter.now??new Date();
 const cutoff=filter.years==null?null:(()=>{const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));date.setUTCFullYear(date.getUTCFullYear()-filter.years!);return date.toISOString().slice(0,10);})();
 return data.records.filter(record=>{
  if(record.kind!==filter.kind)return false;
  if(filter.propertyId!=='all'&&record.property_id!==filter.propertyId)return false;
  if(cutoff&&record.date<cutoff)return false;
  if(!query)return true;
  return `${names.get(record.property_id)||''} ${record.source} ${record.note}`.toLocaleLowerCase('ko-KR').includes(query);
 }).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}
