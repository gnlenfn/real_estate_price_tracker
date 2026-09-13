import {deriveSyncHealth} from '@/lib/sync-status';
import {serverError} from '@/lib/api-error';
import {adminAccessResponse,requireAdmin} from '@/lib/admin-server';
import {runWeeklyTradeSync,SyncAlreadyRunningError} from '@/lib/weekly-sync-server';

export const maxDuration=300;

export async function GET(request:Request){
 try{
  const {admin}=await requireAdmin(request);
  const {data,error}=await admin.from('trade_sync_runs').select('id,trigger,status,started_at,finished_at,property_count,completed_count,saved_records,failure_count,failures,request_id,retry_of,actor_id,skipped_count,failure_scope').order('started_at',{ascending:false}).limit(30);
  if(error)throw error;
  return Response.json({health:deriveSyncHealth(data?.[0]??null),runs:data||[],schedule:'매주 월요일 오전 3시 (한국 시간)'});
 }catch(error){return adminAccessResponse(error)??serverError('admin.sync.list',error,'자동수집 상태를 불러오지 못했습니다.');}
}

export async function POST(request:Request){
 try{const {user}=await requireAdmin(request);return Response.json({run:await runWeeklyTradeSync('manual',{actorId:user.id})});}
 catch(error){const access=adminAccessResponse(error);if(access)return access;if(error instanceof SyncAlreadyRunningError)return Response.json({error:'자동수집이 이미 실행 중입니다.'},{status:409});return serverError('admin.sync.run',error,'자동수집을 시작하지 못했습니다.');}
}
