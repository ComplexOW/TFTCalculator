import type { CritMode } from "./model";

export type CritCalculation = {
  damage: number;
  state: "yes" | "no" | "expected";
};

export function calculateCritDamage(
  baseDamage: number,
  critChance: number,
  critMultiplier: number,
  mode: CritMode,
): CritCalculation {
  const base = finiteNonNegative(baseDamage);
  const chance = clamp(critChance, 0, 1);
  const multiplier = Math.max(1, finiteOr(critMultiplier, 1));
  if (mode === "force-crit") return { damage: base * multiplier, state: "yes" };
  if (mode === "force-no-crit") return { damage: base, state: "no" };
  return {
    damage: base * (1 + chance * (multiplier - 1)),
    state: "expected",
  };
}

function finiteNonNegative(value: number): number {
  return Math.max(0, finiteOr(value, 0));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, finiteOr(value, min)));
}
