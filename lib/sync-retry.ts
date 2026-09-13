export type RetryTarget={propertyId:string;month:string};

export function retryTargets(failures:unknown):RetryTarget[]{
 if(!Array.isArray(failures))return [];
 const seen=new Set<string>(),result:RetryTarget[]=[];
 for(const item of failures){
  if(!item||typeof item!=='object')continue;
  const propertyId=String((item as Record<string,unknown>).propertyId||'');
  const month=String((item as Record<string,unknown>).month||'');
  if(!propertyId||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))continue;
  const key=`${propertyId}:${month}`;
  if(seen.has(key))continue;
  seen.add(key);result.push({propertyId,month});
 }
 return result;
}
