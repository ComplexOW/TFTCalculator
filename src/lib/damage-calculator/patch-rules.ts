import type { StarLevel } from "./model";

export type NormalizedRole =
  | "tank"
  | "fighter"
  | "assassin"
  | "marksman"
  | "caster"
  | "specialist";

export type RoleManaRule = {
  manaPerAttack: number | null;
  passiveManaPerSecond: number;
};

export type PatchRules = {
  id: string;
  setNumber: number | null;
  patchPrefix: string | null;
  starStatMultipliers: {
    hp: Record<StarLevel, number>;
    attackDamage: Record<StarLevel, number>;
  };
  roleMana: Record<NormalizedRole, RoleManaRule>;
  roleAliases: Readonly<Record<string, NormalizedRole>>;
  attackSpeedCap: number;
  damageTakenManaSupported: false;
  assumptions: readonly string[];
};

const STANDARD_ROLE_MANA: PatchRules["roleMana"] = {
  tank: { manaPerAttack: 5, passiveManaPerSecond: 0 },
  fighter: { manaPerAttack: 10, passiveManaPerSecond: 0 },
  assassin: { manaPerAttack: 10, passiveManaPerSecond: 0 },
  marksman: { manaPerAttack: 10, passiveManaPerSecond: 0 },
  caster: { manaPerAttack: 7, passiveManaPerSecond: 2 },
  specialist: { manaPerAttack: null, passiveManaPerSecond: 0 },
};

const SET_17_RULES: PatchRules = {
  id: "set-17-default",
  setNumber: 17,
  patchPrefix: "17.",
  starStatMultipliers: {
    hp: { 1: 1, 2: 1.8, 3: 3.24 },
    attackDamage: { 1: 1, 2: 1.5, 3: 2.25 },
  },
  roleMana: STANDARD_ROLE_MANA,
  roleAliases: {
    carry: "marksman",
    reaper: "assassin",
  },
  attackSpeedCap: 5,
  damageTakenManaSupported: false,
  assumptions: [
    "Set 17 uses explicit HP and attack-damage star multipliers; these values require patch-pinned golden verification.",
    "Modifier ordering and rounding are not fully encoded by CommunityDragon; the snapshot engine keeps full precision.",
    "Set 17 Carry/Reaper role families are mapped to Marksman/Assassin mana rules; AD/AP/H prefixes are treated as stat-family prefixes.",
    "Final Attack Speed is capped at the Set 17 global limit of 5.0 attacks per second.",
  ],
};

const FALLBACK_RULES: PatchRules = {
  ...SET_17_RULES,
  id: "unverified-fallback",
  setNumber: null,
  assumptions: [
    ...SET_17_RULES.assumptions,
    "No exact set rule table was available, so the Set 17 defaults were used.",
  ],
};

export function getPatchRules(setNumber: number, patch?: string): PatchRules {
  if (
    SET_17_RULES.setNumber === setNumber &&
    (!SET_17_RULES.patchPrefix || patch?.startsWith(SET_17_RULES.patchPrefix))
  ) {
    return SET_17_RULES;
  }
  return FALLBACK_RULES;
}

/** Normalizes public roles plus the set-versioned internal aliases in the selected rule table. */
export function normalizeRole(
  rawRole: string | null | undefined,
  rules: PatchRules = SET_17_RULES,
): NormalizedRole | null {
  if (!rawRole) return null;
  const compact = rawRole
    .toLowerCase()
    .replace(/[\s_-]/g, "")
    .replace(/^(ad|ap|h)/, "");
  if (compact === "tank") return "tank";
  if (compact === "fighter") return "fighter";
  if (compact === "assassin") return "assassin";
  if (compact === "marksman") return "marksman";
  if (compact === "caster") return "caster";
  if (compact === "specialist") return "specialist";
  return rules.roleAliases[compact] ?? null;
}
