import {createClient} from '@supabase/supabase-js';
import {fetchDistrictTrades} from '@/lib/molit';
import {recentKoreaMonths,runScheduledSync,type ScheduledProperty} from '@/lib/weekly-sync';

export const maxDuration=300;

export async function GET(request:Request){
 const cronSecret=process.env.CRON_SECRET;
 if(!cronSecret||request.headers.get('authorization')!==`Bearer ${cronSecret}`)return Response.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SECRET_KEY;
 const molitKey=process.env.MOLIT_API_KEY;
 if(!url||!secret||!molitKey)return Response.json({error:'Scheduled sync is not configured.'},{status:503});
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const properties:ScheduledProperty[]=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await db.from('properties').select('id,user_id,name,district,dong,area,owned,color,apt_seq,kakao_place_id,road_address,jibun_address').order('id').range(offset,offset+999);
  if(error)return Response.json({error:'Could not load properties.'},{status:502});
  properties.push(...(data as ScheduledProperty[]));
  if(data.length<1000)break;
 }
 if(!properties.length)return Response.json({ok:true,properties:0,message:'No properties to sync.'});
 const months=recentKoreaMonths();
 const summary=await runScheduledSync(
  properties,
  months,
  (district,month)=>fetchDistrictTrades(district,month,molitKey),
  async(property,month,rows)=>{
   const {error}=await db.rpc('replace_molit_month_scheduled',{p_id:property.id,p_user_id:property.user_id,p_month:month,p_rows:rows});
   if(error)throw new Error('조회 결과를 저장하지 못했습니다.');
  },
 );
 const total=properties.length*months.length;
 return Response.json({ok:summary.failures.length===0,...summary},{status:summary.completed===0&&total>0?502:200});
}
