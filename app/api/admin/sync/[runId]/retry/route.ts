import {adminAccessResponse,requireAdmin} from '@/lib/admin-server';
import {serverError} from '@/lib/api-error';
import {runWeeklyTradeSync,SyncAlreadyRunningError} from '@/lib/weekly-sync-server';

export const maxDuration=300;

export async function POST(request:Request,{params}:{params:Promise<{runId:string}>}){
 try{
  const {runId}=await params,{user}=await requireAdmin(request);
  return Response.json({run:await runWeeklyTradeSync('manual',{retryOf:runId,actorId:user.id})});
 }catch(error){
  const access=adminAccessResponse(error);if(access)return access;
  if(error instanceof SyncAlreadyRunningError)return Response.json({error:'자동수집이 이미 실행 중입니다.'},{status:409});
  if(error instanceof Error&&['RETRY_NOT_ALLOWED','RETRY_SCOPE_UNAVAILABLE'].includes(error.message))return Response.json({error:error.message==='RETRY_SCOPE_UNAVAILABLE'?'실패 대상을 특정할 수 없어 전체 실행이 필요합니다.':'재시도할 실패 대상이 없습니다.'},{status:409});
  return serverError('admin.sync.retry',error,'실패 대상 재수집을 시작하지 못했습니다.');
 }
}
