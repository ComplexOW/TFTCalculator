export type DamageType = "physical" | "magic" | "true";
export type CalculationStatus = "incomplete" | "unsupported" | "partial" | "complete";

export type FinalCombatStats = {
  hp: number;
  attackDamage: number;
  abilityPower: number;
  attackSpeed: number;
  armor: number;
  magicResist: number;
  critChance: number;
  critMultiplier: number;
  initialMana: number;
  maxMana: number;
  manaRegen: number;
  range: number;
  damageAmp: number;
  durability: number;
  attackDamageReduction: number;
  omnivamp: number;
  manaGainMultiplier: number;
};

export type AppliedModifier = {
  sourceId: string;
  sourceName: string;
  stat: keyof FinalCombatStats;
  operation: "flat" | "percent" | "override";
  value: number;
};

export type DamageEventResult = {
  id: string;
  category: "basic-attack" | "ability" | "item" | "trait";
  sourceId: string;
  sourceName: string;
  damageType: DamageType;
  rawDamage: number;
  crit: "yes" | "no" | "expected" | "ineligible";
  effectiveResistance: number | null;
  resistanceMultiplier: number;
  mitigatedDamage: number;
  absorbedDamage: number;
  healthDamage: number;
};

export type ManaTimelineEvent = {
  timeSeconds: number;
  kind: "attack" | "passive" | "cast";
  manaBefore: number;
  manaAfter: number;
  manaGained: number;
};

export type ManaEstimate = {
  supported: boolean;
  normalizedRole: string | null;
  startingMana: number;
  maxMana: number;
  manaPerAttack: number | null;
  passiveManaPerSecond: number;
  attacksUntilCast: number | null;
  secondsUntilCast: number | null;
  events: ManaTimelineEvent[];
  warning?: string;
};

export type UnsupportedIssue = {
  scope: "catalog" | "champion" | "ability" | "item" | "trait" | "rules";
  sourceId?: string;
  message: string;
};

export type ActiveItemEffect = {
  itemId: string;
  itemName: string;
  holder: "attacker" | "defender";
  label: string;
  active: boolean;
  value?: number;
  unit?: "percent" | "stacks" | "flat";
};

export type DefenseDebuffSource = {
  sourceId: string;
  sourceName: string;
  kind: "sunder" | "shred";
  percent: number;
  timing: "aura" | "on-damage" | "external";
  active: boolean;
};

export type DefenseDebuffSummary = {
  armorSunderPercent: number;
  magicShredPercent: number;
  baseArmor: number;
  baseMagicResist: number;
  effectiveArmor: number;
  effectiveMagicResist: number;
  sources: DefenseDebuffSource[];
};

export type TankStats = {
  maxHealth: number;
  startingHealth: number;
  endingHealth: number;
  startingShield: number;
  endingShield: number;
  armor: number;
  magicResist: number;
  durability: number;
  attackDamageReduction: number;
  healing: number;
  thresholdShieldsGranted: number;
  startingMana: number;
  endingMana: number;
  thresholdManaGranted: number;
};

export type DamageCheckpoint = {
  timeSeconds: number;
  cumulativeDamage: number;
  cumulativeHealthDamage: number;
  averageDps: number;
  physicalDamage: number;
  magicDamage: number;
  trueDamage: number;
  attacks: number;
  casts: number;
  defenderHealth: number;
  defenderShield: number;
  effectiveArmor: number;
  effectiveMagicResist: number;
  attackerAttackDamage: number;
  attackerAbilityPower: number;
  attackerAttackSpeed: number;
  defenderDurability: number;
  defenderAttackDamageReduction: number;
};

export type DamageCalculationResult = {
  status: CalculationStatus;
  missing: ("attacker" | "defender")[];
  totals: {
    physical: number;
    magic: number;
    true: number;
    absorbed: number;
    health: number;
  };
  basicAttack: DamageEventResult | null;
  ability: DamageEventResult[];
  finalStats: {
    attacker: FinalCombatStats | null;
    defender: FinalCombatStats | null;
  };
  effectiveDefenses: {
    armor: number;
    magicResist: number;
  } | null;
  events: DamageEventResult[];
  modifiers: AppliedModifier[];
  manaEstimate: ManaEstimate | null;
  checkpoints: DamageCheckpoint[];
  activeItemEffects: ActiveItemEffect[];
  defenseDebuffs: DefenseDebuffSummary | null;
  tankStats: TankStats | null;
  timeToKillSeconds: number | null;
  assumptions: string[];
  warnings: string[];
  unsupported: UnsupportedIssue[];
};
