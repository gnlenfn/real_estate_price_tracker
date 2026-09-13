import {supportServer} from './support-server';

export class AdminAccessError extends Error{
 constructor(public kind:'unauthorized'|'forbidden'){
  super(kind);
  this.name='AdminAccessError';
 }
}

export async function requireAdmin(request:Request){
 let session:Awaited<ReturnType<typeof supportServer>>;
 try{session=await supportServer(request);}catch{throw new AdminAccessError('unauthorized');}
 const {data,error}=await session.admin.from('app_admins').select('user_id').eq('user_id',session.user.id).maybeSingle();
 if(error)throw error;
 if(!data)throw new AdminAccessError('forbidden');
 return session;
}

export function adminAccessResponse(error:unknown){
 if(!(error instanceof AdminAccessError))return null;
 return Response.json({error:error.kind==='unauthorized'?'로그인이 필요합니다.':'운영자 권한이 필요합니다.'},{status:error.kind==='unauthorized'?401:403});
}
