import {adminAccessResponse,requireAdmin} from '@/lib/admin-server';
import {serverError} from '@/lib/api-error';

export async function GET(request:Request){
 try{
  const {admin}=await requireAdmin(request),params=new URL(request.url).searchParams,action=params.get('action'),before=params.get('before');
  let query=admin.from('admin_audit_events').select('id,actor_id,action,target_id,request_id,outcome,before_status,after_status,created_at').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50);
  if(action)query=query.eq('action',action);if(before)query=query.lt('created_at',before);
  const {data,error}=await query;if(error)throw error;
  return Response.json({events:data||[],nextCursor:data?.length===50?data[49].created_at:null});
 }catch(error){return adminAccessResponse(error)??serverError('admin.activity',error,'활동 기록을 불러오지 못했습니다.');}
}
