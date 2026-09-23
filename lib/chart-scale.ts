export type ChartDomain = [number, number];

export function chartDomain(values: readonly unknown[]): ChartDomain | null {
  const numeric = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (!numeric.length) return null;

  const minimum = Math.min(...numeric);
  const maximum = Math.max(...numeric);
  const span = maximum - minimum;
  const padding = span > 0 ? span * 0.12 : Math.max(Math.abs(maximum) * 0.08, 1);

  return [minimum - padding, maximum + padding];
}
