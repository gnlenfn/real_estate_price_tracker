export type AddressResult = {bcode:string;bname:string;bname1:string;sido:string;sigungu:string;buildingName:string;roadAddress:string;jibunAddress:string};
export function propertyAddress(result:AddressResult){
 if(!/^\d{10}$/.test(result.bcode)||!result.bname.trim())throw new Error('주소의 지역 정보를 확인할 수 없습니다. 다른 검색 결과를 선택해 주세요.');
 // Rural transaction records use the legal eup/myeon, not the subordinate ri.
 const dong=result.bname1.trim()||result.bname.trim();
 return {district:result.bcode.slice(0,5),dong,label:[result.sido,result.sigungu,dong].filter(Boolean).join(' '),name:result.buildingName.trim()};
}
