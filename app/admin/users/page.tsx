'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {AdminNav} from '@/app/components/admin-nav';
import {supabase} from '@/lib/supabase';

type User={id:string;nickname:string;joinedAt:string;propertyCount:number;ticketCount:number;lastActivityAt:string|null};
export default function AdminUsersPage(){
 const [users,setUsers]=useState<User[]>([]),[search,setSearch]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{const timer=setTimeout(()=>void(async()=>{try{const {data:{session}}=await supabase!.auth.getSession();if(!session){window.location.assign('/admin/login');return;}const response=await fetch(`/api/admin/users?search=${encodeURIComponent(search)}`,{headers:{Authorization:`Bearer ${session.access_token}`}}),body=await response.json();if(response.status===401||response.status===403){window.location.assign('/admin/login');return;}if(!response.ok)throw new Error(body.error);setUsers(body.users);}catch(error){setNotice(error instanceof Error?error.message:'사용자 목록을 불러오지 못했습니다.');}})(),200);return()=>clearTimeout(timer);},[search]);
 return <main className="admin-page"><AdminNav active="users"/><div className="admin-heading"><div><h1>사용자</h1><p>서비스 이용 현황을 읽기 전용으로 확인합니다.</p></div></div><section className="admin-filters"><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="닉네임 검색"/></section>{notice&&<p className="admin-notice">{notice}</p>}<section className="panel sync-history"><div className="sync-table"><div className="sync-row sync-head"><span>닉네임</span><span>가입일</span><span>등록 단지</span><span>문의</span><span>최근 활동</span></div>{users.map(user=><div className="sync-row" key={user.id}><strong>{user.nickname}</strong><span>{new Date(user.joinedAt).toLocaleDateString('ko-KR')}</span><span>{user.propertyCount}개</span><Link href={`/admin/support?search=${encodeURIComponent(user.nickname)}`}>{user.ticketCount}건</Link><span>{user.lastActivityAt?new Date(user.lastActivityAt).toLocaleString('ko-KR'):'기록 없음'}</span></div>)}</div></section></main>;
}
