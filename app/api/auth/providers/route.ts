import {providerAvailability} from '@/lib/auth';
export async function GET() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return Response.json({error:'계정 서비스가 아직 연결되지 않았습니다.'},{status:503});
 try {
  const response=await fetch(new URL('/auth/v1/settings',url),{headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('settings unavailable');
  return Response.json(providerAvailability(await response.json()),{headers:{'Cache-Control':'no-store'}});
 } catch {return Response.json({error:'로그인 서비스 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'},{status:503});}
}
