'use client';
import Link from 'next/link';
import {Activity,Gauge,HeartPulse,LogOut,MessageSquareText,RefreshCw,ShieldCheck,Users} from 'lucide-react';
import {supabase} from '@/lib/supabase';
type Page='home'|'support'|'sync'|'activity'|'users'|'integrations'|'admins';
export function AdminNav({active}:{active:Page}){
 const items:[Page,string,string,React.ReactNode][]=[['home','현황','/admin',<Gauge size={17} key="i"/>],['support','문의','/admin/support',<MessageSquareText size={17} key="i"/>],['sync','자동수집','/admin/sync',<RefreshCw size={17} key="i"/>],['users','사용자','/admin/users',<Users size={17} key="i"/>],['admins','관리자 관리','/admin/admins',<ShieldCheck size={17} key="i"/>],['integrations','연동','/admin/integrations',<HeartPulse size={17} key="i"/>],['activity','활동','/admin/activity',<Activity size={17} key="i"/>]];
 return <header className="admin-nav"><Link className="admin-brand" href="/admin">집업 운영</Link><nav>{items.map(([id,label,href,icon])=><Link className={active===id?'active':''} href={href} key={id}>{icon}{label}</Link>)}</nav><button onClick={async()=>{await supabase?.auth.signOut({scope:'local'});window.location.assign('/admin/login');}}><LogOut size={17}/>로그아웃</button></header>;
}
