import {validateMessage} from '@/lib/support';
import {adminAccessResponse,requireAdmin} from '@/lib/admin-server';
import type {SupportStatus} from '@/lib/support-inbox';
import {serverError} from '@/lib/api-error';
import {appendAdminEvent} from '@/lib/admin-audit';

const statuses=['open','answered','closed'] as const;
export async function GET(request:Request,{params}:{params:Promise<{ticketId:string}>}){
 try{
  const {ticketId}=await params,{admin}=await requireAdmin(request),support=admin.schema('support');
  const [ticketResult,messageResult,attachmentResult,noteResult]=await Promise.all([
   support.from('tickets').select('id,user_id,category,title,body,status,screen,browser,created_at,last_activity_at,github_status,github_issue_number,github_issue_url').eq('id',ticketId).maybeSingle(),
   support.from('messages').select('id,author_role,body,created_at').eq('ticket_id',ticketId).order('created_at'),
   support.from('attachments').select('id,message_id,storage_path,file_name,mime_type,byte_size,created_at').eq('ticket_id',ticketId).order('created_at'),
   support.from('internal_notes').select('id,author_id,body,created_at').eq('ticket_id',ticketId).order('created_at'),
  ]);
  if(ticketResult.error||!ticketResult.data)return Response.json({error:'문의를 찾을 수 없습니다.'},{status:404});
  if(messageResult.error||attachmentResult.error||noteResult.error)throw messageResult.error||attachmentResult.error||noteResult.error;
  const attachments=await Promise.all((attachmentResult.data||[]).map(async attachment=>{const {data,error}=await admin.storage.from('support-attachments').createSignedUrl(attachment.storage_path,300);return {...attachment,url:error?null:data.signedUrl};}));
  const {data:profile}=await admin.from('profiles').select('nickname').eq('user_id',ticketResult.data.user_id).maybeSingle();
  return Response.json({ticket:{...ticketResult.data,nickname:profile?.nickname||'집 사용자'},messages:messageResult.data||[],attachments,notes:noteResult.data||[]});
 }catch(error){return adminAccessResponse(error)??serverError('admin.support.detail',error,'문의 내용을 불러오지 못했습니다.');}
}

export async function PATCH(request:Request,{params}:{params:Promise<{ticketId:string}>}){
 try{
  const {ticketId}=await params,{user,admin}=await requireAdmin(request),support=admin.schema('support');
  const input=await request.json(),body=String(input.body||'').trim(),status=input.status as SupportStatus|undefined;
  if(status&&!statuses.includes(status))return Response.json({error:'문의 상태를 확인해 주세요.'},{status:400});
  if(body){const validation=validateMessage(body);if(validation)return Response.json({error:validation},{status:400});}
  if(!body&&!status)return Response.json({error:'변경할 내용을 입력해 주세요.'},{status:400});
  const now=new Date().toISOString(),requestId=crypto.randomUUID();
  const {data:before}=await support.from('tickets').select('status').eq('id',ticketId).maybeSingle();
  if(body){const {error}=await support.from('messages').insert({ticket_id:ticketId,author_id:user.id,author_role:'admin',body});if(error)return serverError('admin.support.reply',error,'답변을 저장하지 못했습니다.',500,{ticketId});}
  const next=status||(body?'answered':undefined);
  const {data,error}=await support.from('tickets').update({...(next?{status:next}:{}),last_activity_at:now,updated_at:now}).eq('id',ticketId).select('id,status,last_activity_at').single();
  if(error)return serverError('admin.support.update',error,'문의를 수정하지 못했습니다.',500,{ticketId});
  if(body)await appendAdminEvent(admin,{actorId:user.id,action:'support.reply',targetId:ticketId,requestId,outcome:'success',beforeStatus:before?.status,afterStatus:data.status});
  if(status&&status!==before?.status)await appendAdminEvent(admin,{actorId:user.id,action:'support.status',targetId:ticketId,requestId,outcome:'success',beforeStatus:before?.status,afterStatus:data.status});
  return Response.json(data);
 }catch(error){return adminAccessResponse(error)??serverError('admin.support.mutate',error,'문의 처리에 실패했습니다.');}
}
