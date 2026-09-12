// Group by the integer square-metre value, never by rounding or tolerance.
export function areaGroup(area:number):number {
 return Number.isFinite(area)&&area>=1&&area<1000?Math.floor(area):NaN;
}
