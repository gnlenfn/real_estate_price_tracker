import {areaGroup} from './area';
import { XMLParser } from 'fast-xml-parser';
import { Property } from './model';
type Item = {[key:string]:string};
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
export function matchTrades(items:Item[],property:Property,month:string) {
 return items.filter(i=>clean(i.aptNm)===clean(property.name)&&clean(i.umdNm)===clean(property.dong)&&areaGroup(Number(i.excluUseAr))===areaGroup(property.area)&&!['O','Y'].includes(String(i.cdealType).toUpperCase())&&!String(i.cdealDay??'').trim()).map(i=>({date:`${i.dealYear}-${String(i.dealMonth).padStart(2,'0')}-${String(i.dealDay).padStart(2,'0')}`,price:Number(String(i.dealAmount).replace(/,/g,'')),note:`전용 ${i.excluUseAr}㎡ · ${i.floor}층`})).filter(r=>r.date.startsWith(month)&&Number.isFinite(r.price)&&r.price>0&&r.date<=new Date().toISOString().slice(0,10));
}
export async function fetchDistrictTrades(district:string,month:string,key:string,cache=false) {
 const all:Item[]=[];
 for(let page=1;page<=100;page++) {
 const url=new URL('https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade');
 url.search=new URLSearchParams({serviceKey:key,LAWD_CD:district,DEAL_YMD:month.replace('-',''),pageNo:String(page),numOfRows:'1000'}).toString();
 const res=await fetch(url,{...(cache?{next:{revalidate:3600}}:{cache:'no-store' as const}),signal:AbortSignal.timeout(15000)});
 if(!res.ok) throw new Error('국토교통부에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
 const parsed=parsePage(await res.text()); all.push(...parsed.items);
 if(all.length>=parsed.total)return all;
 if(!parsed.items.length) throw new Error('실거래 자료가 일부 누락되어 저장하지 않았습니다.');
 }
 throw new Error('조회 범위가 너무 큽니다.');
}

export function availableAreas(items:Item[],name:string,dong:string){
 return [...new Set(items.filter(i=>clean(i.aptNm)===clean(name)&&clean(i.umdNm)===clean(dong)&&!['O','Y'].includes(String(i.cdealType).toUpperCase())&&!String(i.cdealDay??'').trim()).map(i=>Number(i.excluUseAr)).map(areaGroup).filter(Number.isFinite))].sort((a,b)=>a-b);
}
export async function fetchTrades(property:Property,month:string,key:string){
 return matchTrades(await fetchDistrictTrades(property.district,month,key),property,month);
}
