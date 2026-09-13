import {createClient} from '@supabase/supabase-js';
import {fetchTrades} from '@/lib/molit';
import {serverError} from '@/lib/api-error';
export const maxDuration=60;
export async function POST(request:Request) {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,key=process.env.MOLIT_API_KEY;
 if(!url||!anon||!key)return Response.json({error:'실거래 조회 기능을 사용할 수 없습니다.'},{status:503});
 const token=request.headers.get('authorization');
 if(!token?.startsWith('Bearer '))return Response.json({error:'로그인이 필요합니다.'},{status:401});
 const db=createClient(url,anon,{db:{schema:'app'},global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await db.auth.getUser(token.slice(7));
 if(error||!user)return Response.json({error:'로그인을 다시 해 주세요.'},{status:401});
 try {
 const body=await request.json();
 if(!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(body.month)||body.month<'2006-01'||body.month>new Date().toISOString().slice(0,7))return Response.json({error:'조회 월을 확인해 주세요.'},{status:400});
 const {data:property,error:pe}=await db.from('properties').select('*').eq('id',body.propertyId).single();
 if(pe||!property)return Response.json({error:'단지를 찾을 수 없습니다.'},{status:404});
 const records=await fetchTrades(property,body.month,key);
 const {error:saveError}=await db.rpc('replace_molit_month',{p_id:property.id,p_month:body.month,p_rows:records});
 if(saveError)throw saveError;
 return Response.json({count:records.length});
 } catch(error) {return serverError('trades.fetch-and-save',error,'실거래가를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',502);}
}
