import {adminAccessResponse,requireAdmin} from '@/lib/admin-server';
import {serverError} from '@/lib/api-error';

export async function GET(request:Request){
 try{
  const {admin}=await requireAdmin(request);
  const params=new URL(request.url).searchParams,before=params.get('before');let cursor:{activity:string;id:string}|null=null;
  try{cursor=before?JSON.parse(Buffer.from(before,'base64url').toString()):null;}catch{return Response.json({error:'페이지 정보를 확인해 주세요.'},{status:400});}
  const {data,error}=await admin.rpc('admin_list_support_tickets',{p_status:params.get('status')||'',p_category:params.get('category')||'',p_github:params.get('github')||'',p_search:(params.get('search')||'').trim(),p_before_activity:cursor?.activity||null,p_before_id:cursor?.id||null,p_limit:50});
  if(error)throw error;const tickets=data||[],last=tickets.at(-1);
  return Response.json({tickets,nextCursor:tickets.length===50&&last?Buffer.from(JSON.stringify({activity:last.last_activity_at,id:last.id})).toString('base64url'):null});
 }catch(error){return adminAccessResponse(error)??serverError('admin.support.list',error,'문의함을 불러오지 못했습니다.');}
}
