type TooltipValueItem = {
  value?: number | string | ReadonlyArray<number | string>;
};

export function descendingTooltipValueKey(item: TooltipValueItem) {
  const value = Number(item.value);
  return Number.isFinite(value) ? -value : Number.POSITIVE_INFINITY;
}
