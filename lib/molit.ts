import {areaGroup} from './area';
import { XMLParser } from 'fast-xml-parser';
import { Property } from './model';
type Item = {[key:string]:string};
type ApartmentLookup={name:string;dong:string;aptSeq?:string|null;jibunAddress?:string};
type MolitRequestInit=RequestInit&{next?:{revalidate:number}};
type Fetcher=(input:URL,init?:MolitRequestInit)=>Promise<Response>;
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
export async function fetchMolitResponse(url:URL,init:MolitRequestInit,fetcher:Fetcher=fetch,wait:(ms:number)=>Promise<void>=delay){
 let lastStatus:number|undefined,lastError:unknown;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetcher(url,{...init,signal:AbortSignal.timeout(15000)});
   if(response.ok)return response;
   lastStatus=response.status;
   if(response.status!==429&&response.status<500)break;
  }catch(error){lastError=error;}
  if(attempt<2)await wait(200*2**attempt);
 }
 throw new Error(`국토교통부에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.${lastStatus?` (HTTP ${lastStatus})`:lastError?' (network error)':''}`);
}
export function parsePage(xml:string): {items:Item[];total:number} {
 const parsed=new XMLParser({parseTagValue:false,trimValues:true}).parse(xml);
 const response=parsed.response;
 if(!response?.header || !['000','00','0'].includes(String(response.header.resultCode))) throw new Error('국토교통부 응답 오류: API 키의 승인 상태와 호출 한도를 확인해 주세요.');
 const total=Number(response.body?.totalCount);
 if(!Number.isInteger(total)||total<0) throw new Error('실거래 응답 형식이 올바르지 않습니다.');
 const item=response.body?.items?.item;
 return {items:item ? Array.isArray(item)?item:[item]:[],total};
}
const clean=(s:string)=>String(s??'').replace(/\s/g,'');
const cleanName=(s:string)=>clean(s).replace(/[^0-9a-zA-Z가-힣]/g,'').replace(/아파트$/,'');
const active=(i:Item)=>!['O','Y'].includes(String(i.cdealType).toUpperCase())&&!String(i.cdealDay??'').trim();
const addressJibun=(address:string)=>String(address??'').trim().match(/(\d+(?:-\d+)?)$/)?.[1]??'';

function apartmentItems(items:Item[],lookup:ApartmentLookup){
 const rows=items.filter(i=>clean(i.umdNm)===clean(lookup.dong)&&active(i));
 if(lookup.aptSeq){const exact=rows.filter(i=>clean(i.aptSeq)===clean(lookup.aptSeq!));if(exact.length)return exact;}
 const jibun=addressJibun(lookup.jibunAddress??'');
 if(jibun){const exact=rows.filter(i=>clean(i.jibun)===clean(jibun));if(exact.length)return exact;}
 const name=cleanName(lookup.name),exact=rows.filter(i=>cleanName(i.aptNm)===name);
 if(exact.length)return exact;
 if(name.length>=4)return rows.filter(i=>{const candidate=cleanName(i.aptNm);return candidate.includes(name)||name.includes(candidate);});
 return [];
}

export function apartmentIdentity(items:Item[],lookup:ApartmentLookup){
 const matches=apartmentItems(items,lookup),ids=[...new Set(matches.map(i=>String(i.aptSeq??'').trim()).filter(Boolean))];
 const names=[...new Set(matches.map(i=>String(i.aptNm??'').trim()).filter(Boolean))];
 return {areas:[...new Set(matches.map(i=>Number(i.excluUseAr)).map(areaGroup).filter(n=>Number.isFinite(n)&&n>0))].sort((a,b)=>a-b),aptSeq:ids.length===1?ids[0]:null,officialName:names.length===1?names[0]:null};
}
export function matchTrades(items:Item[],property:Property,month:string) {
 return apartmentItems(items,{name:property.name,dong:property.dong,aptSeq:property.apt_seq,jibunAddress:property.jibun_address}).filter(i=>areaGroup(Number(i.excluUseAr))===areaGroup(property.area)).map(i=>({date:`${i.dealYear}-${String(i.dealMonth).padStart(2,'0')}-${String(i.dealDay).padStart(2,'0')}`,price:Number(String(i.dealAmount).replace(/,/g,'')),note:`전용 ${i.excluUseAr}㎡ · ${i.floor}층`})).filter(r=>r.date.startsWith(month)&&Number.isFinite(r.price)&&r.price>0&&r.date<=new Date().toISOString().slice(0,10));
}
export async function fetchDistrictTrades(district:string,month:string,key:string,cache=false) {
 const all:Item[]=[];
 for(let page=1;page<=100;page++) {
 const url=new URL('https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade');
 url.search=new URLSearchParams({serviceKey:key,LAWD_CD:district,DEAL_YMD:month.replace('-',''),pageNo:String(page),numOfRows:'1000'}).toString();
 const res=await fetchMolitResponse(url,cache?{next:{revalidate:3600}}:{cache:'no-store' as const});
 const parsed=parsePage(await res.text()); all.push(...parsed.items);
 if(all.length>=parsed.total)return all;
 if(!parsed.items.length) throw new Error('실거래 자료가 일부 누락되어 저장하지 않았습니다.');
 }
 throw new Error('조회 범위가 너무 큽니다.');
}

export function availableAreas(items:Item[],name:string,dong:string,aptSeq?:string|null,jibunAddress?:string){
 return apartmentIdentity(items,{name,dong,aptSeq,jibunAddress}).areas;
}
export async function fetchTrades(property:Property,month:string,key:string){
 return matchTrades(await fetchDistrictTrades(property.district,month,key),property,month);
}
