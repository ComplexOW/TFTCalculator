export type DamagePool = {
  shield: number;
  health: number;
};

export type DamagePoolResult = DamagePool & {
  absorbedDamage: number;
  healthDamage: number;
  overkillDamage: number;
};

export function applyDamageToPool(pool: DamagePool, damage: number): DamagePoolResult {
  const incoming = finiteNonNegative(damage);
  const shield = finiteNonNegative(pool.shield);
  const health = finiteNonNegative(pool.health);
  const absorbedDamage = Math.min(shield, incoming);
  const afterShield = incoming - absorbedDamage;
  const healthDamage = Math.min(health, afterShield);
  return {
    shield: shield - absorbedDamage,
    health: health - healthDamage,
    absorbedDamage,
    healthDamage,
    overkillDamage: Math.max(0, afterShield - healthDamage),
  };
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
