import {createClient} from '@supabase/supabase-js';

export const dynamic='force-dynamic';
export function isLocalSupabase(url:string){try{const parsed=new URL(url);return parsed.protocol==='http:'&&['127.0.0.1','localhost'].includes(parsed.hostname)&&parsed.port==='54321';}catch{return false;}}

export async function POST(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'',publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY,email=process.env.LOCAL_DEV_USER_EMAIL,password=process.env.LOCAL_DEV_USER_PASSWORD;
 if(!isLocalSupabase(url))return Response.json({error:'로컬 개발 환경에서만 사용할 수 있습니다.'},{status:404});
 if(!publishable||!secret||!email||!password)return Response.json({error:'로컬 개발 계정 설정을 확인해 주세요.'},{status:503});
 const auth=createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false}});
 let signedIn=await auth.auth.signInWithPassword({email,password});
 if(signedIn.error){const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error&&!created.error.message.toLowerCase().includes('already'))return Response.json({error:'로컬 개발 계정을 준비하지 못했습니다.'},{status:500});signedIn=await auth.auth.signInWithPassword({email,password});}
 const session=signedIn.data.session;if(signedIn.error||!session)return Response.json({error:'로컬 개발 계정에 로그인하지 못했습니다.'},{status:500});
 return Response.json({accessToken:session.access_token,refreshToken:session.refresh_token});
}
