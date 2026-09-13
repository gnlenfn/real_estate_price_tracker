'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronRight,MapPin,Search} from 'lucide-react';
import {PropertyArea} from './property-area';
import {AddressResult,propertyAddress} from '@/lib/address';
import {supabase} from '@/lib/supabase';
import type {ApartmentCandidate} from '@/lib/apartment';
import type {Property} from '@/lib/model';

type PostcodeAPI={Postcode:new(options:{oncomplete:(data:AddressResult)=>void;width:string;height:number})=>{embed:(element:HTMLElement)=>void}};
type Location={district:string;dong:string;label:string;roadAddress:string;jibunAddress:string;kakaoPlaceId:string};
declare global {interface Window {kakao?:PostcodeAPI;daum?:PostcodeAPI}}
let loading:Promise<PostcodeAPI>|null=null;

function loadPostcode(){
 const existing=window.kakao?.Postcode?window.kakao:window.daum;
 if(existing?.Postcode)return Promise.resolve(existing);
 if(loading)return loading;
 loading=new Promise<PostcodeAPI>((resolve,reject)=>{
  const script=document.createElement('script');
  const timer=setTimeout(()=>fail(),15000);
  function fail(){clearTimeout(timer);script.remove();loading=null;reject(new Error('주소 검색을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'));}
  script.src='https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';script.async=true;
  script.onerror=fail;script.onload=()=>{const api=window.kakao?.Postcode?window.kakao:window.daum;if(!api?.Postcode){fail();return;}clearTimeout(timer);resolve(api);};
  document.head.appendChild(script);
 });
 return loading;
}

export function PropertyAddress({property}:{property:Property|null}){
 const [name,setName]=useState(property?.name||''),[query,setQuery]=useState(property?.name||'');
 const [location,setLocation]=useState<Location>({district:property?.district||'',dong:property?.dong||'',label:property?.road_address||property?.jibun_address||property?.dong||'',roadAddress:property?.road_address||'',jibunAddress:property?.jibun_address||'',kakaoPlaceId:property?.kakao_place_id||''});
 const [candidates,setCandidates]=useState<ApartmentCandidate[]>([]),[searching,setSearching]=useState(false),[postcode,setPostcode]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const container=useRef<HTMLDivElement>(null),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);

 async function sessionToken(){
  if(!supabase)throw new Error('아파트명 검색을 사용하려면 로그인해 주세요.');
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)throw new Error('아파트명 검색을 사용하려면 로그인해 주세요.');
  return session.access_token;
 }
 async function apartmentRequest(body:unknown){
  const token=await sessionToken();
  const response=await fetch('/api/apartments',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'아파트를 검색하지 못했습니다.');return result;
 }
 async function searchByName(){
  if(busy||query.trim().length<2)return;
  const version=++generation.current;setBusy(true);setError('');setPostcode(false);
  try{const result=await apartmentRequest({query:query.trim()});if(version!==generation.current)return;setCandidates(result.candidates||[]);setSearching(true);if(!result.candidates?.length)setError('검색 결과가 없습니다. 지역명을 함께 입력하거나 주소로 직접 찾아 주세요.');}
  catch(e){if(version===generation.current){setCandidates([]);setSearching(true);setError(e instanceof Error?e.message:'아파트를 검색하지 못했습니다.');}}
  finally{if(version===generation.current)setBusy(false);}
 }
 async function selectCandidate(candidate:ApartmentCandidate){
  const version=++generation.current;setBusy(true);setError('');
  try{const result=await apartmentRequest({place:candidate});if(version!==generation.current)return;const place=result.place;setName(place.name);setQuery(place.name);setLocation({district:place.district,dong:place.dong,label:place.roadAddress||place.address,roadAddress:place.roadAddress,jibunAddress:place.address,kakaoPlaceId:place.id});setSearching(false);setCandidates([]);}
  catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'선택한 주소를 확인하지 못했습니다.');}
  finally{if(version===generation.current)setBusy(false);}
 }
 async function searchAddress(){
  const version=++generation.current;setBusy(true);setPostcode(true);setSearching(false);setCandidates([]);setError('');
  try{const api=await loadPostcode();if(version!==generation.current||!container.current)return;
   new api.Postcode({width:'100%',height:420,oncomplete:result=>{if(version!==generation.current)return;try{const address=propertyAddress(result);setLocation(address);if(address.name){setName(address.name);setQuery(address.name);}setError('');setPostcode(false);}catch(e){setError((e as Error).message);}}}).embed(container.current);
  }catch(e){if(version===generation.current){setError((e as Error).message);setPostcode(false);}}
  finally{if(version===generation.current)setBusy(false);}
 }
 const existing=property&&property.district===location.district&&property.dong===location.dong&&property.name===name;
 return <div className="property-address">
  <label>아파트명 검색<div className="apartment-query"><input value={query} maxLength={80} placeholder="예: 래미안 원베일리" onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();searchByName();}}}/><button type="button" className="button primary" disabled={busy||query.trim().length<2} onClick={searchByName}><Search size={16}/>{busy?'검색 중…':'검색'}</button></div></label>
  <p className="muted">단지명을 검색한 뒤 주소가 맞는 아파트를 선택하세요. 지역명을 함께 입력하면 더 정확합니다.</p>
  {searching&&candidates.length>0&&<div className="apartment-candidates" role="listbox" aria-label="아파트 검색 결과">{candidates.map(candidate=><button type="button" role="option" aria-selected="false" className="apartment-candidate" key={candidate.id} onClick={()=>selectCandidate(candidate)}><MapPin size={18}/><span><strong>{candidate.name}</strong><small>{candidate.roadAddress||candidate.address}</small>{candidate.roadAddress&&<small>{candidate.address}</small>}</span><ChevronRight size={17}/></button>)}</div>}
  <button type="button" className="button address-fallback" disabled={busy} onClick={searchAddress}>{location.district?'다른 주소로 직접 찾기':'주소로 직접 찾기'}</button>
  <div hidden={!postcode} className="address-search"><button type="button" className="button" onClick={()=>{generation.current++;setPostcode(false);setBusy(false);}}>검색 닫기</button><div ref={container}/></div>
  {error&&<p role="alert" className="notice">{error}</p>}
  {location.district&&<div className="address-selection"><strong>{name||'선택한 아파트'}</strong><span>{location.label}</span><small>{location.jibunAddress}</small></div>}
  <input type="hidden" name="district" value={location.district}/><input type="hidden" name="dong" value={location.dong}/><input type="hidden" name="road_address" value={location.roadAddress}/><input type="hidden" name="jibun_address" value={location.jibunAddress}/><input type="hidden" name="kakao_place_id" value={location.kakaoPlaceId}/>
  <label>표시할 단지명<input name="name" required maxLength={100} placeholder="아파트를 먼저 검색해 주세요" value={name} onChange={e=>setName(e.target.value)}/></label>
  <PropertyArea key={`${location.district}|${location.dong}|${location.jibunAddress}|${name}`} district={location.district} dong={location.dong} name={name} jibunAddress={location.jibunAddress} existing={existing?property.area:undefined} existingAptSeq={existing?property.apt_seq:null}/>
 </div>;
}
