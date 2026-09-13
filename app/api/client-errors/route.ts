import {logServerError} from '@/lib/api-error';
import {supportServer} from '@/lib/support-server';

const operations=new Set(['property.save','property.delete','record.save','record.delete','support.load','support.upload','support.attachment']);
export async function POST(request:Request){
 try{
  const {user}=await supportServer(request),input=await request.json(),operation=String(input.operation||''),code=String(input.code||'unknown');
  if(!operations.has(operation)||code.length>80)return Response.json({error:'요청 내용을 확인해 주세요.'},{status:400});
  const requestId=crypto.randomUUID();
  logServerError(`client.${operation}`,requestId,new Error(`Client operation failed: ${code}`),{userId:user.id});
  return new Response(null,{status:204});
 }catch{return Response.json({error:'로그인을 확인해 주세요.'},{status:401});}
}
