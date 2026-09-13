import {createClient} from '@supabase/supabase-js';
import {logServerError} from './api-error';
import {fetchDistrictTrades} from './molit';
import {safeSyncFailures} from './sync-status';
import {recentKoreaMonths,runScheduledSync,type ScheduledProperty} from './weekly-sync';
import {appendAdminEvent} from './admin-audit';
import {retryTargets} from './sync-retry';

export class SyncAlreadyRunningError extends Error{}

export async function runWeeklyTradeSync(trigger:'cron'|'manual',options?:{retryOf?:string;actorId?:string}){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY,molitKey=process.env.MOLIT_API_KEY;
 if(!url||!secret||!molitKey)throw new Error('Weekly sync configuration is incomplete');
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const staleBefore=new Date(Date.now()-15*60*1000).toISOString();
 await db.from('trade_sync_runs').update({status:'failed',finished_at:new Date().toISOString(),failure_count:1,failures:[{name:'자동수집',month:'',propertyId:''}]}).eq('status','running').lt('started_at',staleBefore);
 let targets:ReturnType<typeof retryTargets>|undefined,failureScope:'targets'|'run'='targets';
 if(options?.retryOf){
  const {data:original,error}=await db.from('trade_sync_runs').select('id,status,failures,failure_scope').eq('id',options.retryOf).maybeSingle();
  if(error)throw error;
  if(!original||original.status==='success')throw new Error('RETRY_NOT_ALLOWED');
  if(original.failure_scope==='run')throw new Error('RETRY_SCOPE_UNAVAILABLE');
  targets=retryTargets(original.failures);
  if(!targets.length)throw new Error('RETRY_NOT_ALLOWED');
 }
 const {data:run,error:runError}=await db.from('trade_sync_runs').insert({trigger,status:'running',retry_of:options?.retryOf||null,actor_id:options?.actorId||null,failure_scope:failureScope}).select('id,request_id,started_at').single();
 if(runError){if(runError.code==='23505')throw new SyncAlreadyRunningError('Sync is already running');throw runError;}
 await appendAdminEvent(db,{actorId:options?.actorId||null,action:'sync.start',targetId:run.id,requestId:run.request_id,outcome:'success'});
 try{
  const properties:ScheduledProperty[]=[];
  for(let offset=0;;offset+=1000){
   const {data,error}=await db.from('properties').select('id,user_id,name,district,dong,area,owned,color,apt_seq,kakao_place_id,road_address,jibun_address').order('id').range(offset,offset+999);
   if(error)throw error;
   properties.push(...(data as ScheduledProperty[]));
   if(data.length<1000)break;
  }
  const allProperties=properties;
  const targetIds=targets?new Set(targets.map(target=>target.propertyId)):null;
  const selectedProperties=targetIds?allProperties.filter(property=>targetIds.has(property.id)):allProperties;
  const months=targets?[...new Set(targets.map(target=>target.month))]:recentKoreaMonths();
  const allowedPairs=targets?new Set(targets.map(target=>`${target.propertyId}:${target.month}`)):undefined;
  const skippedCount=targets?new Set(targets.filter(target=>!selectedProperties.some(property=>property.id===target.propertyId)).map(target=>target.propertyId)).size:0;
  const summary=await runScheduledSync(selectedProperties,months,(district,month)=>fetchDistrictTrades(district,month,molitKey),async(property,month,rows)=>{
   const {error}=await db.rpc('replace_molit_month_scheduled',{p_id:property.id,p_user_id:property.user_id,p_month:month,p_rows:rows});
   if(error)throw error;
  },4,allowedPairs);
  const total=targets?targets.length-skippedCount:selectedProperties.length*months.length,status=summary.failures.length===0?'success':summary.completed===0&&total>0?'failed':'partial';
  const failures=safeSyncFailures(summary.failures);
  const finishedAt=new Date().toISOString();
  const {error:updateError}=await db.from('trade_sync_runs').update({status,finished_at:finishedAt,property_count:selectedProperties.length,completed_count:summary.completed,saved_records:summary.savedRecords,failure_count:failures.length,failures,skipped_count:skippedCount}).eq('id',run.id);
  if(updateError)throw updateError;
  if(summary.failures.length)logServerError('trade-sync.items',run.request_id,new Error(summary.failures.map(item=>`${item.propertyId}/${item.month}: ${item.message}`).join('; ')),{runId:run.id,failureCount:summary.failures.length});
  await appendAdminEvent(db,{actorId:options?.actorId||null,action:'sync.finish',targetId:run.id,requestId:run.request_id,outcome:status==='failed'?'failed':'success'});
  return {id:run.id,requestId:run.request_id,trigger,status,startedAt:run.started_at,finishedAt,properties:selectedProperties.length,completed:summary.completed,savedRecords:summary.savedRecords,failures,skippedCount,retryOf:options?.retryOf||null};
 }catch(error){
  await db.from('trade_sync_runs').update({status:'failed',finished_at:new Date().toISOString(),failure_count:1,failure_scope:'run',failures:[{name:'자동수집',month:'',propertyId:''}]}).eq('id',run.id);
  await appendAdminEvent(db,{actorId:options?.actorId||null,action:'sync.finish',targetId:run.id,requestId:run.request_id,outcome:'failed'});
  logServerError('trade-sync.run',run.request_id,error,{runId:run.id,trigger});
  throw error;
 }
}
