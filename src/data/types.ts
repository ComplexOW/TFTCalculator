export const TFT_DATA_SCHEMA_VERSION = 1 as const;

export type Cost = 1 | 2 | 3 | 4 | 5;
export type TraitStyle = "bronze" | "silver" | "gold" | "chromatic" | "prismatic";
export type DataValue = number | string | boolean | null;
export type AbilityValue = Exclude<DataValue, boolean>;

export type TftDataProvenance = {
  source: "CommunityDragon";
  sourceUrl: string;
  /** TFT's user-facing balance patch (for example, 17.8). */
  patch: string;
  /** CommunityDragon's LoL client archive selector (for example, 16.15). */
  sourcePatch: string;
  locale: string;
  setMutator: string;
  fetchedAt: string;
  sourceHash: string;
};

export type ChampionStats = {
  health: number;
  attackDamage: number;
  armor: number;
  magicResist: number;
  attackSpeed: number;
  range: number;
  startingMana: number;
  maxMana: number;
  critChance: number;
  critMultiplier: number;
};

export type AbilityVariable = {
  name: string;
  /** The unmodified CommunityDragon array, including its non-star index zero. */
  rawValues: AbilityValue[];
  /** One-, two-, and three-star values (indexes 1, 2, and 3); runtime validation enforces length 3. */
  starValues: AbilityValue[];
};

export type Ability = {
  name: string;
  description: string;
  iconUrl: string;
  variables: AbilityVariable[];
};

export type Champion = {
  id: string;
  name: string;
  cost: Cost;
  traits: string[];
  iconUrl: string;
  role: string;
  stats: ChampionStats;
  ability: Ability;
};

export type TraitTier = {
  min: number;
  max: number;
  style: TraitStyle;
  variables: Partial<Record<string, AbilityValue>>;
};

export type Trait = {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  tiers: TraitTier[];
};

export type ItemCategory = "standard" | "radiant";

export type Item = {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  unique: boolean;
  category: ItemCategory;
  composition: string[];
  effects: Partial<Record<string, DataValue>>;
};

export type TftSet = {
  schemaVersion: typeof TFT_DATA_SCHEMA_VERSION;
  provenance: TftDataProvenance;
  setNumber: number;
  setName: string;
  champions: Champion[];
  traits: Trait[];
  items: Item[];
};
