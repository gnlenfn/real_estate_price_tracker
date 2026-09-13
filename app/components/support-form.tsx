'use client';
import {useState,FormEvent} from 'react';
import {MessageSquareText} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {validateSupportInput} from '@/lib/support';

export function SupportForm({loggedIn,screen}:{loggedIn:boolean;screen:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[issue,setIssue]=useState<number|null>(null);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget,data=new FormData(form),input={category:String(data.get('category')||''),title:String(data.get('title')||'').trim(),body:String(data.get('body')||'').trim()};
  const validation=validateSupportInput(input);setMessage('');setIssue(null);if(validation){setMessage(validation);return;}
  if(!supabase){setMessage('문의 접수 기능에 연결하지 못했습니다.');return;}
  setBusy(true);
  try{
   const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('로그인 후 문의해 주세요.');
   const response=await fetch('/api/support',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({...input,screen}),signal:AbortSignal.timeout(20000)});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'문의를 접수하지 못했습니다.');
   setIssue(Number(result.number));setMessage('문의가 접수되었습니다.');form.reset();
  }catch(error){setMessage(error instanceof Error?error.message:'문의를 접수하지 못했습니다.');}
  finally{setBusy(false);}
 }
 return <section className="panel settings-panel support-panel"><MessageSquareText size={25}/><h2>문의하기</h2><p>오류나 개선 의견을 남기면 운영자의 GitHub 이슈로 바로 접수됩니다. 이메일과 소셜 계정 이름은 전송하지 않습니다.</p>{loggedIn?<form className="support-form" onSubmit={submit}><label>문의 유형<select name="category" defaultValue="bug"><option value="bug">오류 제보</option><option value="feature">기능 제안</option><option value="question">사용 문의</option></select></label><label>제목<input name="title" minLength={3} maxLength={100} required placeholder="문의 내용을 짧게 적어 주세요"/></label><label>내용<textarea name="body" minLength={10} maxLength={4000} required rows={6} placeholder="발생 과정이나 원하는 기능을 자세히 적어 주세요"/></label><button className="button primary" disabled={busy}>{busy?'접수 중…':'문의 접수'}</button>{message&&<span className="form-message" role="status">{message}{issue?` GitHub Issue #${issue}`:''}</span>}</form>:<div className="connection">문의하려면 먼저 로그인해 주세요.</div>}</section>;
}
