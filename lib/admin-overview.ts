type Run={id:string;trigger:string;status:string;started_at:string;finished_at:string|null};
export type CronHealth='running'|'success'|'partial'|'failed'|'delayed'|'unverified';

export function weeklySchedule(now:Date){
 const next=new Date(now),daysUntilSunday=(7-now.getUTCDay())%7;
 next.setUTCDate(now.getUTCDate()+daysUntilSunday);next.setUTCHours(18,0,0,0);
 if(next.getTime()<=now.getTime())next.setUTCDate(next.getUTCDate()+7);
 return {previous:new Date(next.getTime()-7*24*60*60*1000),next};
}

export function cronHealth(runs:Run[],now=new Date(),enabledAt?:string|null){
 const schedule=weeklySchedule(now),cron=runs.filter(run=>run.trigger==='cron').sort((a,b)=>b.started_at.localeCompare(a.started_at))[0]||null;
 if(cron&&new Date(cron.started_at)>=schedule.previous){
  const health:CronHealth=cron.status==='running'&&now.getTime()-new Date(cron.started_at).getTime()>15*60*1000?'delayed':cron.status as CronHealth;
  return {health,lastRunId:cron.id,nextAt:schedule.next.toISOString()};
 }
 const activation=enabledAt?new Date(enabledAt):null,firstDue=activation&&activation>schedule.previous?schedule.next:schedule.previous;
 const health:CronHealth=now.getTime()>firstDue.getTime()+60*60*1000?'delayed':'unverified';
 return {health,lastRunId:cron?.id??null,nextAt:schedule.next.toISOString()};
}
