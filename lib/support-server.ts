import {createClient} from '@supabase/supabase-js';

export async function supportServer(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY;
 if(!url||!anon||!secret)throw new Error('문의 기능이 아직 연결되지 않았습니다.');
 const authorization=request.headers.get('authorization');
 if(!authorization?.startsWith('Bearer '))throw new Error('로그인이 필요합니다.');
 const auth=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(authorization.slice(7));
 if(error||!user)throw new Error('로그인을 다시 해 주세요.');
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return {user,auth,admin};
}

export async function isSupportAdmin(admin:Awaited<ReturnType<typeof supportServer>>['admin'],userId:string){
 const {data,error}=await admin.from('app_admins').select('user_id').eq('user_id',userId).maybeSingle();
 if(error)throw new Error('운영자 권한을 확인하지 못했습니다.');
 return Boolean(data);
}
