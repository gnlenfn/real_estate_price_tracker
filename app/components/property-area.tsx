'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {areaGroup} from '@/lib/area';
export function PropertyArea({district,dong,name,existing}:{district:string;dong:string;name:string;existing?:number}){
 const current=existing===undefined?undefined:areaGroup(existing);
 const [areas,setAreas]=useState<number[]>(current?[current]:[]),[value,setValue]=useState(current?String(current):'');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[scanned,setScanned]=useState(0);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function load(){
  if(busy||!district||!dong||!name.trim())return;
  const abort=new AbortController();controller.current=abort;setBusy(true);setMessage('');
  try{
   if(!supabase)throw new Error('면적 목록을 불러오려면 로그인해 주세요.');
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw new Error('면적 목록을 불러오려면 로그인해 주세요.');
   const now=new Date();const end=now.getUTCFullYear()*12+now.getUTCMonth();
   for(let i=scanned;i<Math.min(scanned+12,60);i++){
    if(abort.signal.aborted)return;
    const serial=end-i,month=`${Math.floor(serial/12)}-${String(serial%12+1).padStart(2,'0')}`;
    setMessage(`${month} 거래에서 면적을 찾고 있습니다…`);
    const res=await fetch('/api/areas',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({district,dong,name:name.trim(),month}),signal:abort.signal});
    const result=await res.json();if(!res.ok)throw new Error(result.error);
    if(abort.signal.aborted)return;
    setAreas(prev=>[...new Set([...prev,...(result.areas as number[]).map(areaGroup).filter(Number.isFinite)])].sort((a,b)=>a-b));setScanned(i+1);
   }
   setMessage('조회가 완료되었습니다. 찾는 면적이 없으면 이전 기간을 더 조회해 주세요.');
  }catch(e){if(!abort.signal.aborted)setMessage(e instanceof Error?e.message:'면적을 불러오지 못했습니다.');}
  finally{if(!abort.signal.aborted)setBusy(false);}
 }
 return <div className="property-area"><label>전용면적 (㎡)<select name="area" required value={value} onChange={e=>setValue(e.target.value)}><option value="">면적을 선택하세요</option>{areas.map(area=><option key={area} value={area}>{area}㎡{area===current?' (현재 등록)':''}</option>)}</select></label>
 <button type="button" className="button" disabled={busy||!district||!dong||!name.trim()||scanned>=60} onClick={load}>{busy?'면적 조회 중…':scanned?'이전 1년 면적 더 찾기':'단지 면적 불러오기'}</button>
 <p className="muted">소수점 아래를 버려 묶습니다. 예: 59.1~59.99㎡ → 59㎡. 거래가 없는 타입은 목록에 없을 수 있습니다. 공급면적·평형과는 다릅니다.</p>
 {message&&<p className="muted" role="status">{message}</p>}{scanned>0&&<p className="muted">최근 {scanned}개월 확인 · {areas.length}개 면적{!areas.length?' · 단지명과 주소를 확인하거나 이전 기간을 조회해 주세요.':''}</p>}
 </div>;
}
