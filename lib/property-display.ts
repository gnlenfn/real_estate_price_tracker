import { areaGroup } from "./area";
import type { Property } from "./model";

export type PropertyComplexGroup = {
  key: string;
  properties: Property[];
};

function normalizedComplexName(name: string) {
  return name.trim().replace(/\s+/g, "").toLocaleLowerCase("ko");
}

function complexKey(property: Property) {
  const ownership = property.owned ? "owned" : "watch";
  const aptSeq = property.apt_seq?.trim();
  if (aptSeq) return `${ownership}:apt:${aptSeq}`;
  const placeId = property.kakao_place_id?.trim();
  if (placeId) return `${ownership}:place:${placeId}`;
  return [
    ownership,
    "legacy",
    property.district,
    property.dong.trim(),
    normalizedComplexName(property.name),
  ].join(":");
}

export function groupPropertiesByComplex(
  properties: readonly Property[],
): PropertyComplexGroup[] {
  const groups = new Map<string, Property[]>();
  for (const property of properties) {
    const key = complexKey(property);
    groups.set(key, [...(groups.get(key) ?? []), property]);
  }
  return [...groups].map(([key, groupedProperties]) => ({
    key,
    properties: groupedProperties.toSorted(
      (left, right) => areaGroup(left.area) - areaGroup(right.area),
    ),
  }));
}

export function propertyAreaLabel(property: Property) {
  return `${property.name} · ${areaGroup(property.area)}㎡`;
}
