import {areaGroup} from './area';
import type {Property} from './model';
export type SyncResult={id:string;name:string;area:number;count:number;completed:number;failures:{month:string;message:string}[]};
export function syncMonths(start:string,end:string){
 const valid=(v:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(v);
 if(!valid(start)||!valid(end)||start>end||start<'2006-01')throw new Error('조회 기간을 확인해 주세요.');
 const serial=(v:string)=>Number(v.slice(0,4))*12+Number(v.slice(5))-1;
 return Array.from({length:serial(end)-serial(start)+1},(_,i)=>{const n=serial(start)+i;return `${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`;});
}
export async function runTradeSync(properties:Property[],months:string[],request:(id:string,month:string)=>Promise<number>,progress:(label:string)=>void,active:()=>boolean=()=>true){
 const results:SyncResult[]=properties.map(property=>({id:property.id,name:property.name,area:areaGroup(property.area),count:0,completed:0,failures:[]}));
 const jobs=properties.flatMap((property,index)=>months.map(month=>({property,index,month})));
 let next=0,done=0,running=0,stopped=false;
 const update=()=>{if(active()&&!stopped)progress(`${done}/${jobs.length} 완료 · ${running}건 조회 중…`);};
 async function worker(){
  while(next<jobs.length){
   if(stopped||!active()){stopped=true;return;}
   const {property,index,month}=jobs[next++],row=results[index];
   running++;update();
   try{const count=await request(property.id,month);row.count+=count;row.completed++;}
   catch(e){row.failures.push({month,message:e instanceof Error?e.message:'조회 실패'});}
   finally{running--;done++;update();}
  }
 }
 // A bounded pool avoids flooding the provider and waits for all in-flight saves.
 await Promise.all(Array.from({length:Math.min(4,jobs.length)},()=>worker()));
 if(stopped||!active())throw new Error('로그인 계정이 변경되어 조회를 중단했습니다.');
 for(const row of results)row.failures.sort((a,b)=>a.month.localeCompare(b.month));
 return results;
}

export function syncSummary(results:SyncResult[]){
 return [`${results.length}개 단지 · ${results.reduce((n,r)=>n+r.count,0)}건 반영`,...results.map(r=>`${r.name} ${r.area}㎡: ${r.count}건 · ${r.completed}개월 완료${r.failures.length?` · 실패 ${r.failures.map(f=>`${f.month} (${f.message})`).join(', ')}`:''}`),'실패한 월은 해당 단지를 선택해 다시 조회할 수 있습니다. 0건이면 단지명·주소·면적과 거래 유무를 확인해 주세요.'].join('\n');
}
