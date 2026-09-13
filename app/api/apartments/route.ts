import {createClient} from '@supabase/supabase-js';
import {apartmentCandidates,jibunFromAddress,type ApartmentCandidate} from '@/lib/apartment';
import {serverError} from '@/lib/api-error';

export const maxDuration=30;

async function authenticated(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const token=request.headers.get('authorization');
 if(!url||!anon)return {error:Response.json({error:'아파트 검색 기능을 사용할 수 없습니다.'},{status:503})};
 if(!token?.startsWith('Bearer '))return {error:Response.json({error:'로그인이 필요합니다.'},{status:401})};
 const db=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await db.auth.getUser(token.slice(7));
 if(error||!user)return {error:Response.json({error:'로그인을 다시 해 주세요.'},{status:401})};
 return {error:null};
}

async function kakao(path:string,params:Record<string,string>,key:string){
 const url=new URL(`https://dapi.kakao.com${path}`);url.search=new URLSearchParams(params).toString();
 const response=await fetch(url,{headers:{Authorization:`KakaoAK ${key}`},cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error(`Kakao Local API ${response.status}`);
 return response.json();
}

export async function POST(request:Request){
 const auth=await authenticated(request);if(auth.error)return auth.error;
 const key=process.env.KAKAO_REST_API_KEY;
 if(!key)return Response.json({error:'아파트명 검색 기능을 사용할 수 없습니다. 주소로 직접 찾아 주세요.'},{status:503});
 let body:unknown;try{body=await request.json();}catch{return Response.json({error:'검색 조건을 확인해 주세요.'},{status:400});}
 const input=body as {query?:unknown;place?:unknown};
 try{
  if(typeof input.query==='string'){
   const query=input.query.trim();if(query.length<2||query.length>80)return Response.json({error:'아파트명을 2자 이상 입력해 주세요.'},{status:400});
   const result=await kakao('/v2/local/search/keyword.json',{query:`${query} 아파트`,size:'15'},key);
   return Response.json({candidates:apartmentCandidates(Array.isArray(result.documents)?result.documents:[],query)},{headers:{'Cache-Control':'no-store'}});
  }
  const place=input.place as Partial<ApartmentCandidate>|null;
  if(!place||typeof place.id!=='string'||typeof place.name!=='string'||typeof place.address!=='string'||place.id.length>40||place.name.length>100||place.address.length>200)return Response.json({error:'선택한 아파트 정보를 확인해 주세요.'},{status:400});
  const result=await kakao('/v2/local/search/address.json',{query:place.address,size:'1'},key);
  const document=result.documents?.[0],address=document?.address;
  if(!address||!/^[0-9]{10}$/.test(String(address.b_code??'')))return Response.json({error:'선택한 주소의 법정동 정보를 찾지 못했습니다.'},{status:404});
  const dong=String(address.region_3depth_name??'').trim();
  if(!dong)return Response.json({error:'선택한 주소의 법정동을 찾지 못했습니다.'},{status:404});
  return Response.json({place:{
   id:place.id,name:place.name.trim(),address:place.address.trim(),roadAddress:String(place.roadAddress??'').trim(),
   district:String(address.b_code).slice(0,5),dong,jibun:jibunFromAddress(place.address),
   label:[address.region_1depth_name,address.region_2depth_name,dong].filter(Boolean).join(' '),
  }},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return serverError('apartments.search',error,'아파트 검색 서비스에 연결하지 못했습니다. 잠시 후 다시 시도하거나 주소로 직접 찾아 주세요.',502);
 }
}
