import { median, type Data, type Kind } from "./model";

export const scenarioRates = [
  -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30,
] as const;

export function latestMonthlyMedianPrice(
  data: Data,
  propertyId: string,
  kind: Kind,
): { month: string; price: number } | null {
  const records = data.records.filter(
    (record) => record.property_id === propertyId && record.kind === kind,
  );
  const month = records.reduce(
    (latest, record) =>
      record.date.slice(0, 7) > latest ? record.date.slice(0, 7) : latest,
    "",
  );
  if (!month) return null;
  const price = median(
    records
      .filter((record) => record.date.startsWith(month))
      .map((record) => record.price),
  );
  return price == null ? null : { month, price };
}

export function priceScenario(
  basePrice: number,
  targetPrice: number,
  rate: number,
) {
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
