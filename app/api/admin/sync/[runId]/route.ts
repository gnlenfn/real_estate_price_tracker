import {adminAccessResponse,requireAdmin} from '@/lib/admin-server';
import {serverError} from '@/lib/api-error';

export async function GET(request:Request,{params}:{params:Promise<{runId:string}>}){
 try{
  const {runId}=await params,{admin}=await requireAdmin(request);
  const {data,error}=await admin.from('trade_sync_runs').select('id,trigger,status,started_at,finished_at,property_count,completed_count,saved_records,failure_count,failures,request_id,retry_of,actor_id,skipped_count,failure_scope').eq('id',runId).maybeSingle();
  if(error)throw error;
  if(!data)return Response.json({error:'수집 실행을 찾을 수 없습니다.'},{status:404});
  return Response.json({run:data});
 }catch(error){return adminAccessResponse(error)??serverError('admin.sync.detail',error,'수집 실행을 불러오지 못했습니다.');}
}
