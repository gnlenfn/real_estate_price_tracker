import type {Property} from './model';

const regionNames: Record<string, string> = {
 '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구',
 '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전',
 '울산광역시': '울산', '세종특별자치시': '세종', '경기도': '경기',
 '강원특별자치도': '강원', '강원도': '강원', '충청북도': '충북',
 '충청남도': '충남', '전북특별자치도': '전북', '전라북도': '전북',
 '전라남도': '전남', '경상북도': '경북', '경상남도': '경남',
 '제주특별자치도': '제주',
 '서울': '서울', '부산': '부산', '대구': '대구', '인천': '인천',
 '광주': '광주', '대전': '대전', '울산': '울산', '세종': '세종',
 '경기': '경기', '강원': '강원', '충북': '충북', '충남': '충남',
 '전북': '전북', '전남': '전남', '경북': '경북', '경남': '경남',
 '제주': '제주',
};

function addressRegion(address: string | undefined) {
 const parts = address?.trim().replace(/^대한민국\s+/, '').split(/\s+/) ?? [];
 const first = parts[0];
 if (!first || !regionNames[first]) return null;

 const divisions = parts.slice(1).filter(part => /(?:시|군|구)$/.test(part));
 return [regionNames[first], ...divisions].join(' ');
}

export function propertyRegionLabel(property: Property): string {
 return addressRegion(property.road_address)
  ?? addressRegion(property.jibun_address)
  ?? `지역 코드 ${property.district}`;
}

export function regionOptions(properties: Property[]): Array<{id: string; label: string}> {
 const options = new Map<string, {id: string; label: string}>();
 for (const property of properties) {
  if (!options.has(property.district)) {
   options.set(property.district, {id: property.district, label: propertyRegionLabel(property)});
  }
 }
 return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}
