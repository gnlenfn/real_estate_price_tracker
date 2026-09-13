export type AreaSearchIdentity={district:string;dong:string;name:string;jibunAddress:string};

export function areaSearchKey(identity:AreaSearchIdentity){
 const values=[identity.district,identity.dong,identity.name,identity.jibunAddress].map(value=>value.trim());
 return values[0]&&values[1]&&values[2]?values.join('|'):'';
}
