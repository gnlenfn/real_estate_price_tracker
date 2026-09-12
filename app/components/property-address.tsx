'use client';
import {useEffect,useRef,useState} from 'react';
import {Search} from 'lucide-react';
import {PropertyArea} from './property-area';
import {AddressResult,propertyAddress} from '@/lib/address';
import type {Property} from '@/lib/model';
type PostcodeAPI={Postcode:new(options:{oncomplete:(data:AddressResult)=>void;width:string;height:number})=>{embed:(element:HTMLElement)=>void}};
declare global {interface Window {kakao?:PostcodeAPI;daum?:PostcodeAPI}}
let loading:Promise<PostcodeAPI>|null=null;
function loadSearch(){
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
 const [name,setName]=useState(property?.name||'');
 const [location,setLocation]=useState({district:property?.district||'',dong:property?.dong||'',label:property?.dong||''});
 const [searching,setSearching]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const container=useRef<HTMLDivElement>(null),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 async function search(){
  const version=++generation.current;setBusy(true);setSearching(true);setError('');
  try{const api=await loadSearch();if(version!==generation.current||!container.current)return;
   new api.Postcode({width:'100%',height:420,oncomplete:result=>{
    if(version!==generation.current)return;
    try{const address=propertyAddress(result);setLocation(address);if(address.name)setName(address.name);setError('');setSearching(false);}catch(e){setError((e as Error).message);}
   }}).embed(container.current);
  }catch(e){if(version===generation.current){setError((e as Error).message);setSearching(false);}}
  finally{if(version===generation.current)setBusy(false);}
 }
 return <div className="property-address">
  <div className="address-control"><span>아파트 위치</span><button type="button" className="button" disabled={busy} onClick={search}><Search size={16}/>{busy?'검색 준비 중…':location.district?'아파트 · 주소 다시 검색':'아파트 · 주소 검색'}</button></div>
  <p className="muted">아파트명이나 도로명·지번 주소로 검색하고 해당 주소를 선택하세요.</p>
  <div hidden={!searching} className="address-search"><button type="button" className="button" onClick={()=>{generation.current++;setSearching(false);setBusy(false);}}>검색 닫기</button><div ref={container}/></div>
  {error&&<p role="alert" className="notice">{error}</p>}
  {location.district&&<p className="address-selection">선택한 지역: {location.label}</p>}
  <input type="hidden" name="district" value={location.district}/><input type="hidden" name="dong" value={location.dong}/>
  <label>단지명<input name="name" required maxLength={100} placeholder="예: 마포래미안푸르지오" value={name} onChange={e=>setName(e.target.value)}/></label>
  <p className="muted">검색된 단지명은 수정할 수 있습니다. 실거래 자료에 등록된 명칭과 일치해야 합니다.</p>
  <PropertyArea key={`${location.district}|${location.dong}|${name}`} district={location.district} dong={location.dong} name={name} existing={property&&property.district===location.district&&property.dong===location.dong&&property.name===name?property.area:undefined}/>
 </div>;
}
