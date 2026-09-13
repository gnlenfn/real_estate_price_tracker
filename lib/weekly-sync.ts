import {matchTrades} from './molit';
import type {Property} from './model';

export type ScheduledProperty=Property&{user_id:string};
export type ScheduledFailure={propertyId:string;name:string;month:string;message:string};
export type ScheduledSummary={properties:number;months:string[];savedRecords:number;completed:number;failures:ScheduledFailure[]};

export function recentKoreaMonths(now=new Date()){
 const korea=new Date(now.getTime()+9*60*60*1000);
 const current=new Date(Date.UTC(korea.getUTCFullYear(),korea.getUTCMonth(),1));
 const previous=new Date(Date.UTC(korea.getUTCFullYear(),korea.getUTCMonth()-1,1));
 const format=(date:Date)=>`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
 return [format(previous),format(current)];
}

export async function runScheduledSync(
 properties:ScheduledProperty[],
 months:string[],
 loadDistrict:(district:string,month:string)=>Promise<Record<string,string>[]>,
 saveMonth:(property:ScheduledProperty,month:string,rows:ReturnType<typeof matchTrades>)=>Promise<void>,
 concurrency=4,
 allowedPairs?:Set<string>,
):Promise<ScheduledSummary>{
 const groups=new Map<string,{district:string;month:string;properties:ScheduledProperty[]}>();
 for(const property of properties)for(const month of months){
  if(allowedPairs&&!allowedPairs.has(`${property.id}:${month}`))continue;
  const key=`${property.district}:${month}`;
  const group=groups.get(key)??{district:property.district,month,properties:[]};
  group.properties.push(property);groups.set(key,group);
 }
 const jobs=[...groups.values()],failures:ScheduledFailure[]=[];
 let next=0,savedRecords=0,completed=0;
 async function worker(){
  while(next<jobs.length){
   const job=jobs[next++];let items:Record<string,string>[];
   try{items=await loadDistrict(job.district,job.month);}
   catch(error){
    const message=error instanceof Error?error.message:'조회 실패';
    failures.push(...job.properties.map(property=>({propertyId:property.id,name:property.name,month:job.month,message})));
    continue;
   }
   for(const property of job.properties){
    try{const rows=matchTrades(items,property,job.month);await saveMonth(property,job.month,rows);savedRecords+=rows.length;completed++;}
    catch(error){failures.push({propertyId:property.id,name:property.name,month:job.month,message:error instanceof Error?error.message:'저장 실패'});}
   }
  }
 }
 await Promise.all(Array.from({length:Math.min(Math.max(1,concurrency),jobs.length)},()=>worker()));
 failures.sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.month.localeCompare(b.month));
 return {properties:properties.length,months,savedRecords,completed,failures};
}
