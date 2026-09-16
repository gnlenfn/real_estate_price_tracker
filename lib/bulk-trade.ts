import type {Property} from './model';
import {runTradeSync,type SyncResult} from './trade-sync';

export const MAX_BULK_TRADE_JOBS=1200;

export function selectableBulkProperties(properties:Property[],regionId:string):Property[]{
 return properties
  .filter(property=>regionId==='all'||property.district===regionId)
  .toSorted((a,b)=>a.name.localeCompare(b.name,'ko'));
}

export function bulkTradeLabel(properties:Property[],months:string[]):string{
 return `${properties.length}곳 · ${months.length}개월`;
}

export function toggleSelectedPropertyId(ids:string[],id:string):string[]{
 return ids.includes(id)?ids.filter(value=>value!==id):[...ids,id];
}

export function reconcileSelectedPropertyIds(properties:Property[],regionId:string,ids:string[]):string[]{
 const selected=new Set(ids);
 return selectableBulkProperties(properties,regionId)
  .filter(property=>selected.has(property.id))
  .map(property=>property.id);
}

export function assertBulkTradeWorkload(properties:Property[],months:string[]):number{
 const jobs=properties.length*months.length;
 if(jobs>MAX_BULK_TRADE_JOBS)
  throw new Error(`한 번에 조회할 수 있는 범위는 ${MAX_BULK_TRADE_JOBS}건까지입니다. 단지 수나 기간을 줄여 주세요.`);
 return jobs;
}

export async function executeBulkTradeReload({properties,months,request,progress,active,refresh}:{
 properties:Property[];
 months:string[];
 request:(id:string,month:string)=>Promise<number>;
 progress:(label:string)=>void;
 active:()=>boolean;
 refresh:()=>Promise<void>;
}):Promise<SyncResult[]>{
 assertBulkTradeWorkload(properties,months);
 const results=await runTradeSync(properties,months,request,progress,active);
 await refresh();
 return results;
}
