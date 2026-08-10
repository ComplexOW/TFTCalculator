import type { TftSet } from "@/data/types";
import type { StarLevel } from "./model";

type UnknownRecord = Record<string, unknown>;

export type CatalogChampion = {
  id: string;
  name: string;
  role: string | null;
  stats: {
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
  } | null;
  ability: {
    name: string;
    variables: CatalogAbilityVariable[];
  } | null;
};

export type CatalogAbilityVariable = {
  name: string;
  rawValues: unknown[];
  starValues: [unknown, unknown, unknown];
};

export type CatalogItem = {
  id: string;
  name: string;
  unique: boolean;
  effects: Record<string, unknown>;
};

export type CatalogTraitTier = {
  min: number;
  variables: Record<string, unknown>;
};

export type CatalogTrait = {
  id: string;
  name: string;
  tiers: CatalogTraitTier[];
};

export type CalculatorCatalog = {
  setNumber: number;
  patch?: string;
  champions: CatalogChampion[];
  items: CatalogItem[];
  traits: CatalogTrait[];
};

export function readCalculatorCatalog(data: TftSet): CalculatorCatalog {
  const root = asRecord(data);
  const provenance = asRecord(root.provenance);
  return {
    setNumber: finiteNumber(root.setNumber) ?? 0,
    patch: stringValue(root.patch) ?? stringValue(provenance.patch),
    champions: arrayValue(root.champions).map(readChampion),
    items: arrayValue(root.items).map(readItem),
    traits: arrayValue(root.traits).map(readTrait),
  };
}

export function abilityValue(
  champion: CatalogChampion,
  variableName: string,
  starLevel: StarLevel,
): number | null {
  const variable = champion.ability?.variables.find(
    (candidate) => candidate.name.toLowerCase() === variableName.toLowerCase(),
  );
  if (!variable) return null;
  return finiteNumber(variable.starValues[starLevel - 1]);
}

function readChampion(value: unknown): CatalogChampion {
  const champion = asRecord(value);
  const stats = asRecord(champion.stats);
  const ability = asRecord(champion.ability);
  const health = finiteNumber(stats.health) ?? finiteNumber(stats.hp);
  const attackDamage = finiteNumber(stats.attackDamage) ?? finiteNumber(stats.damage);
  return {
    id: stringValue(champion.id) ?? stringValue(champion.apiName) ?? "",
    name: stringValue(champion.name) ?? "Unknown champion",
    role: stringValue(champion.role) ?? stringValue(champion.roleRaw) ?? null,
    stats: health !== null && attackDamage !== null
      ? {
          health,
          attackDamage,
          armor: finiteNumber(stats.armor) ?? 0,
          magicResist: finiteNumber(stats.magicResist) ?? 0,
          attackSpeed: finiteNumber(stats.attackSpeed) ?? 0,
          range: finiteNumber(stats.range) ?? 0,
          startingMana:
            finiteNumber(stats.startingMana) ?? finiteNumber(stats.initialMana) ?? 0,
          maxMana: finiteNumber(stats.maxMana) ?? finiteNumber(stats.mana) ?? 0,
          critChance: normalizeChance(finiteNumber(stats.critChance) ?? 0),
          critMultiplier: normalizeCritMultiplier(finiteNumber(stats.critMultiplier) ?? 1.4),
        }
      : null,
    ability: Object.keys(ability).length
      ? {
          name: stringValue(ability.name) ?? "Ability",
          variables: arrayValue(ability.variables).map(readAbilityVariable),
        }
      : null,
  };
}

function readAbilityVariable(value: unknown): CatalogAbilityVariable {
  const variable = asRecord(value);
  const rawValues = arrayValue(variable.rawValues).length
    ? arrayValue(variable.rawValues)
    : arrayValue(variable.value);
  const normalizedStars = arrayValue(variable.starValues);
  const starValues: [unknown, unknown, unknown] = normalizedStars.length >= 3
    ? [normalizedStars[0], normalizedStars[1], normalizedStars[2]]
    : [rawValues[1], rawValues[2], rawValues[3]];
  return {
    name: stringValue(variable.name) ?? "",
    rawValues,
    starValues,
  };
}

function readItem(value: unknown): CatalogItem {
  const item = asRecord(value);
  return {
    id: stringValue(item.id) ?? stringValue(item.apiName) ?? "",
    name: stringValue(item.name) ?? "Unknown item",
    unique: item.unique === true,
    effects: asRecord(item.effects),
  };
}

function readTrait(value: unknown): CatalogTrait {
  const trait = asRecord(value);
  return {
    id: stringValue(trait.id) ?? stringValue(trait.apiName) ?? "",
    name: stringValue(trait.name) ?? "Unknown trait",
    tiers: arrayValue(trait.tiers).map((tierValue) => {
      const tier = asRecord(tierValue);
      return {
        min: finiteNumber(tier.min) ?? finiteNumber(tier.minUnits) ?? 0,
        variables: asRecord(tier.variables),
      };
    }),
  };
}

function normalizeChance(value: number): number {
  return value > 1 ? value / 100 : value;
}

function normalizeCritMultiplier(value: number): number {
  return value > 10 ? value / 100 : value;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}
