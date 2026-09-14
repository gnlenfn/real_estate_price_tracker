import type {SupabaseClient} from '@supabase/supabase-js';

export type AdminEvent={
 actorId:string|null;
 action:'support.reply'|'support.note'|'support.status'|'github.transfer'|'sync.start'|'sync.finish'|'admin.grant'|'admin.revoke'|'admin.transfer';
 targetId:string;
 requestId:string;
 outcome:'success'|'failed'|'unknown';
 beforeStatus?:string;
 afterStatus?:string;
};

export function adminEventRow(event:AdminEvent){
 return {actor_id:event.actorId,action:event.action,target_id:event.targetId,request_id:event.requestId,outcome:event.outcome,before_status:event.beforeStatus??null,after_status:event.afterStatus??null};
}

export async function appendAdminEvent(db:SupabaseClient<any,any,any,any,any>,event:AdminEvent){
 const {error}=await db.schema('admin').from('audit_events').insert(adminEventRow(event));
 if(error)throw error;
}
