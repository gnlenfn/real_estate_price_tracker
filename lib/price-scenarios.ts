import { areaGroup } from "./area";
import { median, type Data, type Kind, type Property } from "./model";
import { propertyRegionLabel } from "./property-context";

export const scenarioRates = [-30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30] as const;

export function latestMonthlyMedianPrice(
  data: Data,
  propertyId: string,
  kind: Kind,
): { month: string; price: number } | null {
  const records = data.records.filter(
    (record) => record.property_id === propertyId && record.kind === kind,
  );
  const month = records.reduce(
    (latest, record) => (record.date.slice(0, 7) > latest ? record.date.slice(0, 7) : latest),
    "",
  );
  if (!month) return null;
  const price = median(
    records.filter((record) => record.date.startsWith(month)).map((record) => record.price),
  );
  return price == null ? null : { month, price };
}

export function priceScenario(basePrice: number, targetPrice: number, rate: number) {
  const factor = 1 + rate / 100;
  const changedBasePrice = Math.round(basePrice * factor);
  const changedTargetPrice = Math.round(targetPrice * factor);
  return {
    rate,
    basePrice: changedBasePrice,
    targetPrice: changedTargetPrice,
    gap: changedTargetPrice - changedBasePrice,
  };
}

export type ScenarioRow = {
  property: Property;
  current: { month: string; price: number } | null;
};

export type ScenarioGroup = {
  district: string;
  label: string;
  rows: ScenarioRow[];
};

export function scenarioGroups(
  data: Data,
  baseId: string,
  regionId: string,
  area: number | null = null,
): ScenarioGroup[] {
  const properties = data.properties
    .filter(
      (property) =>
        !property.owned &&
        property.id !== baseId &&
        (regionId === "all" || property.district === regionId) &&
        (area == null || areaGroup(property.area) === area),
    )
    .toSorted(
      (left, right) =>
        propertyRegionLabel(left).localeCompare(propertyRegionLabel(right), "ko") ||
        left.name.localeCompare(right.name, "ko") ||
        areaGroup(left.area) - areaGroup(right.area),
    );
  const groups = new Map<string, ScenarioGroup>();

  for (const property of properties) {
    const group = groups.get(property.district) ?? {
      district: property.district,
      label: propertyRegionLabel(property),
      rows: [],
    };
    group.rows.push({
      property,
      current: latestMonthlyMedianPrice(data, property.id, "trade"),
    });
    groups.set(property.district, group);
  }

  return [...groups.values()];
}
