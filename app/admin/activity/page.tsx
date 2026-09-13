'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {AdminNav} from '@/app/components/admin-nav';
import {supabase} from '@/lib/supabase';

type Event={id:string;action:string;target_id:string;request_id:string;outcome:string;before_status:string|null;after_status:string|null;created_at:string};
const labels:Record<string,string>={'support.reply':'문의 답변','support.note':'내부 메모','support.status':'문의 상태 변경','github.transfer':'GitHub 전송','sync.start':'수집 시작','sync.finish':'수집 완료'};
export default function AdminActivityPage(){
 const [events,setEvents]=useState<Event[]>([]),[action,setAction]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{void(async()=>{try{const {data:{session}}=await supabase!.auth.getSession();if(!session){window.location.assign('/admin/login');return;}const query=action?`?action=${encodeURIComponent(action)}`:'',response=await fetch(`/api/admin/activity${query}`,{headers:{Authorization:`Bearer ${session.access_token}`}}),body=await response.json();if(response.status===401||response.status===403){window.location.assign('/admin/login');return;}if(!response.ok)throw new Error(body.error);setEvents(body.events);}catch(error){setNotice(error instanceof Error?error.message:'활동 기록을 불러오지 못했습니다.');}})();},[action]);
 return <main className="admin-page"><AdminNav active="activity"/><div className="admin-heading"><div><h1>관리자 활동</h1><p>운영 작업 결과와 추적 ID를 확인합니다.</p></div></div><section className="admin-filters"><select value={action} onChange={event=>setAction(event.target.value)}><option value="">모든 작업</option>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></section>{notice&&<p className="admin-notice">{notice}</p>}<section className="panel sync-history"><div className="sync-table">{events.map(event=><div className="sync-row" key={event.id}><span>{labels[event.action]||event.action}</span><span className={`sync-status ${event.outcome==='success'?'success':'failed'}`}>{event.outcome}</span><span>{new Date(event.created_at).toLocaleString('ko-KR')}</span><span>{event.action.startsWith('support.')?<Link href={`/admin/support?ticket=${event.target_id}`}>문의 열기</Link>:<Link href={`/admin/sync?run=${event.target_id}`}>수집 열기</Link>}</span><code>{event.request_id}</code></div>)}</div></section></main>;
}
