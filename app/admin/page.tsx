'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {AdminNav} from '@/app/components/admin-nav';
import {supabase} from '@/lib/supabase';

type Overview={unansweredCount:number;newTicketCount7d:number;cron:{health:string;lastRunId:string|null;nextAt:string};recentFailures:{id:string;startedAt:string;failureCount:number}[]};
const labels:Record<string,string>={running:'실행 중',success:'정상 완료',partial:'일부 실패',failed:'실패',delayed:'실행 지연',unverified:'미확인'};
export default function AdminPage(){
 const [data,setData]=useState<Overview|null>(null),[notice,setNotice]=useState('');
 useEffect(()=>{void(async()=>{try{const {data:{session}}=await supabase!.auth.getSession();if(!session){window.location.assign('/admin/login');return;}const response=await fetch('/api/admin/overview',{headers:{Authorization:`Bearer ${session.access_token}`}}),body=await response.json();if(response.status===401||response.status===403){window.location.assign('/admin/login');return;}if(!response.ok)throw new Error(body.error);setData(body);}catch(error){setNotice(error instanceof Error?error.message:'운영 현황을 불러오지 못했습니다.');}})();},[]);
 return <main className="admin-page"><AdminNav active="home"/><div className="admin-heading"><div><h1>운영 현황</h1><p>문의와 예약 수집 상태를 한눈에 확인합니다.</p></div></div>{notice&&<p className="admin-notice">{notice}</p>}{data&&<><section className="sync-overview"><Link className="panel admin-card" href="/admin/support?status=open"><small>미답변 문의</small><strong>{data.unansweredCount}건</strong><p>바로 문의함에서 확인</p></Link><Link className="panel admin-card" href="/admin/support"><small>최근 7일 신규 문의</small><strong>{data.newTicketCount7d}건</strong><p>전체 문의 보기</p></Link><Link className={`panel admin-card sync-health ${data.cron.health}`} href={data.cron.lastRunId?`/admin/sync?run=${data.cron.lastRunId}`:'/admin/sync'}><small>예약 자동수집</small><strong>{labels[data.cron.health]||data.cron.health}</strong><p>다음 예정 {new Date(data.cron.nextAt).toLocaleString('ko-KR')}</p></Link></section><section className="panel sync-history"><h2>최근 실패 실행</h2>{data.recentFailures.length?data.recentFailures.map(run=><Link className="admin-failure-link" href={`/admin/sync?run=${run.id}`} key={run.id}><span>{new Date(run.startedAt).toLocaleString('ko-KR')}</span><strong>실패 {run.failureCount}건</strong></Link>):<p className="muted">최근 실패 실행이 없습니다.</p>}</section></>}</main>;
}
