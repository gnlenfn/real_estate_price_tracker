import {createClient} from '@supabase/supabase-js';
import {githubIssuePayload,validateSupportInput} from '@/lib/support';

export async function POST(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY;
 const githubToken=process.env.GITHUB_ISSUES_TOKEN,repository=process.env.GITHUB_ISSUES_REPOSITORY||'gnlenfn/real_estate_price_tracker';
 if(!url||!anon||!secret||!githubToken||!/^[-\w.]+\/[-\w.]+$/.test(repository))return Response.json({error:'문의 접수 기능이 아직 연결되지 않았습니다.'},{status:503});
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
 if(countError)return Response.json({error:'문의 접수 상태를 확인하지 못했습니다.'},{status:500});
 if((count||0)>=5)return Response.json({error:'한 시간에 최대 5건까지 접수할 수 있습니다. 잠시 후 다시 시도해 주세요.'},{status:429});
 let {data:profile}=await db.from('profiles').select('nickname').eq('user_id',user.id).maybeSingle();
 if(!profile){const ensured=await authDb.rpc('ensure_profile').single();profile=ensured.data as {nickname:string}|null;}
 const nickname=profile?.nickname||'집 사용자',browser=(request.headers.get('user-agent')||'').slice(0,500);
 const {data:ticket,error:ticketError}=await db.from('support_tickets').insert({user_id:user.id,category,title,body,screen,browser,status:'pending'}).select('id').single();
 if(ticketError||!ticket)return Response.json({error:'문의를 저장하지 못했습니다.'},{status:500});
 try{
  const response=await fetch(`https://api.github.com/repos/${repository}/issues`,{method:'POST',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${githubToken}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:JSON.stringify(githubIssuePayload({category,title,body,screen,browser,nickname})),signal:AbortSignal.timeout(15000)});
  const issue=await response.json();
  if(!response.ok||typeof issue.number!=='number'||typeof issue.html_url!=='string')throw new Error(`GitHub issue request failed: ${response.status}`);
  await db.from('support_tickets').update({status:'sent',github_issue_number:issue.number,github_issue_url:issue.html_url,updated_at:new Date().toISOString()}).eq('id',ticket.id);
  return Response.json({number:issue.number});
 }catch(error){
  console.error('Support issue creation failed',error instanceof Error?error.message:'Unknown error');
  await db.from('support_tickets').update({status:'failed',updated_at:new Date().toISOString()}).eq('id',ticket.id);
  return Response.json({error:'문의를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.'},{status:502});
 }
}
