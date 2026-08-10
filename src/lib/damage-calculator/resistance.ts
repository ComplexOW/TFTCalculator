export function resistanceMultiplier(resistance: number): number {
  if (!Number.isFinite(resistance)) return 1;
  return resistance >= 0
    ? 100 / (100 + resistance)
    : 2 - 100 / (100 - resistance);
}

export function damageAfterResistance(rawDamage: number, resistance: number): number {
  return nonNegative(rawDamage) * resistanceMultiplier(resistance);
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
