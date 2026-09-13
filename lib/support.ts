export type SupportCategory='bug'|'feature'|'question';
export type SupportInput={category:string;title:string;body:string};
export type SupportContext=SupportInput&{screen?:string;browser?:string;nickname:string};

const categoryLabels:Record<SupportCategory,string>={bug:'오류 제보',feature:'기능 제안',question:'사용 문의'};

export function validateSupportInput(input:SupportInput){
 if(!(input.category in categoryLabels))return '문의 유형을 확인해 주세요.';
 const title=input.title.trim(),body=input.body.trim();
 if([...title].length<3)return '제목은 3자 이상 입력해 주세요.';
 if([...title].length>100)return '제목은 100자 이하로 입력해 주세요.';
 if([...body].length<10)return '내용은 10자 이상 입력해 주세요.';
 if([...body].length>4000)return '내용은 4,000자 이하로 입력해 주세요.';
 return null;
}

export function validateMessage(body:string){
 const value=body.trim();
 if(!value)return '내용을 입력해 주세요.';
 if([...value].length>4000)return '내용은 4,000자 이하로 입력해 주세요.';
 return null;
}

export function publicTicketResponse(ticketId:string,_github:{number:number;url:string}|null){
 return {ticketId};
}

const redact=(value:string)=>value
 .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[이메일 가림]')
 .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,'[식별값 가림]');
const oneLine=(value:string|undefined,max:number)=>redact(value||'확인되지 않음').replace(/[\r\n]+/g,' ').trim().slice(0,max);

export function githubIssuePayload(context:SupportContext){
 const category=context.category as SupportCategory;
 const label=categoryLabels[category];
 return {
  title:`[${label}] ${oneLine(context.title,100)}`,
  body:[
   '## 문의 내용',redact(context.body.trim()),'',
   '## 접수 정보',
   `- 유형: ${label}`,
   `- 앱 닉네임: ${oneLine(context.nickname,30)}`,
   `- 화면: ${oneLine(context.screen,200)}`,
   `- 브라우저: ${oneLine(context.browser,500)}`,
   '', '> 집업 앱에서 접수된 사용자 문의입니다.',
  ].join('\n'),
  labels:['user-feedback',category],
 };
}
