import {createClient} from '@supabase/supabase-js';
import {publicTicketResponse,validateSupportInput} from '@/lib/support';
import {serverError} from '@/lib/api-error';

export async function POST(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY;
 if(!url||!anon||!secret)return Response.json({error:'문의 접수 기능을 사용할 수 없습니다.'},{status:503});
 const authorization=request.headers.get('authorization');
 if(!authorization?.startsWith('Bearer '))return Response.json({error:'로그인이 필요합니다.'},{status:401});
 const authDb=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await authDb.auth.getUser(authorization.slice(7));
 if(userError||!user)return Response.json({error:'로그인을 다시 해 주세요.'},{status:401});
 let input:Record<string,unknown>;
 try{input=await request.json();}catch{return Response.json({error:'문의 내용을 확인해 주세요.'},{status:400});}
 const category=String(input.category||''),title=String(input.title||'').trim(),body=String(input.body||'').trim(),screen=String(input.screen||'').slice(0,200);
 const validation=validateSupportInput({category,title,body});
 if(validation)return Response.json({error:validation},{status:400});
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const since=new Date(Date.now()-60*60*1000).toISOString();
 const {count,error:countError}=await db.from('support_tickets').select('id',{count:'exact',head:true}).eq('user_id',user.id).gte('created_at',since);
 if(countError)return serverError('support.rate-limit',countError,'문의 접수 상태를 확인하지 못했습니다.');
 if((count||0)>=5)return Response.json({error:'한 시간에 최대 5건까지 접수할 수 있습니다. 잠시 후 다시 시도해 주세요.'},{status:429});
 const browser=(request.headers.get('user-agent')||'').slice(0,500);
 const {data:ticket,error:ticketError}=await db.from('support_tickets').insert({user_id:user.id,category,title,body,screen,browser,status:'open',github_status:'pending'}).select('id').single();
 if(ticketError||!ticket)return serverError('support.create',ticketError||new Error('ticket insert returned no row'),'문의를 저장하지 못했습니다.');
 return Response.json(publicTicketResponse(ticket.id,null));
}
