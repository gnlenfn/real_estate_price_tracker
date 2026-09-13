'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {SupportInbox} from '@/app/components/support-inbox';

export default function SupportPage(){
 const [userId,setUserId]=useState<string|null>(null);
 useEffect(()=>{void supabase?.auth.getUser().then(({data})=>setUserId(data.user?.id||null));},[]);
 if(!supabase)return <main className="support-page"><p className="notice">문의 기능에 연결하지 못했습니다.</p></main>;
 if(userId===null)return <main className="support-page"><p>로그인 상태를 확인 중…</p></main>;
 if(!userId)return <main className="support-page"><p className="notice">문의하려면 먼저 로그인해 주세요.</p><a className="button primary" href="/auth">로그인 · 회원가입</a></main>;
 return <main className="support-page"><a className="back-link" href="/"><ArrowLeft size={16}/>앱으로 돌아가기</a><SupportInbox userId={userId}/></main>;
}
