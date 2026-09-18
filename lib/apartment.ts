export type KakaoPlaceDocument = {
  id?: string;
  place_name?: string;
  category_name?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
};

export type ApartmentCandidate = {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  x: string;
  y: string;
};

const compact = (value: string) => value.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
const displayName = (value: string) =>
  value
    .trim()
    .replace(/\s*아파트\s*$/, "")
    .trim();

export function apartmentCandidates(
  documents: KakaoPlaceDocument[],
  query: string,
): ApartmentCandidate[] {
  const normalized = compact(query);
  const rows = documents
    .filter((document) => {
      const category = String(document.category_name ?? "");
      if (category.includes("중개")) return false;
      return (
        category.includes("아파트") ||
        compact(String(document.place_name ?? "")).includes(normalized)
      );
    })
    .map((document) => ({
      id: String(document.id ?? ""),
      name: displayName(String(document.place_name ?? "")),
      address: String(document.address_name ?? "").trim(),
      roadAddress: String(document.road_address_name ?? "").trim(),
      x: String(document.x ?? ""),
      y: String(document.y ?? ""),
    }))
    .filter((row) => row.id && row.name && row.address);
  const seen = new Set<string>();
  return rows
    .filter((row) => {
      const key = `${row.id}:${row.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

export function jibunFromAddress(address: string) {
  return address.trim().match(/(\d+(?:-\d+)?)$/)?.[1] ?? "";
}
