import type { CalculatorTarget, ItemConditionState } from "./model";

export type ItemRuleKind =
  | "adaptive"
  | "archangel"
  | "bloodthirster"
  | "blue-buff"
  | "bramble"
  | "crownguard"
  | "damage-amp"
  | "dragon-claw"
  | "edge-of-night"
  | "evenshroud"
  | "gargoyle"
  | "giant-slayer"
  | "guinsoo"
  | "hand-of-justice"
  | "gunblade"
  | "precision"
  | "ionic-spark"
  | "kraken"
  | "last-whisper"
  | "burn-on-hit"
  | "nashor"
  | "protectors-vow"
  | "quicksilver"
  | "red-buff"
  | "shojin"
  | "spirit-visage"
  | "steadfast"
  | "sterak"
  | "strikers-flail"
  | "sunfire"
  | "thiefs-gloves"
  | "titans"
  | "void-staff"
  | "warmog"
  | "noncombat"
  | "unsupported";

export type ItemConditionDefinition = {
  itemId: string;
  label: string;
  description: string;
  hasToggle: boolean;
  stackLabel?: string;
  minStacks?: number;
  maxStacks?: number;
};

const STANDARD: Readonly<Record<string, ItemRuleKind>> = {
  TFT_Item_AdaptiveHelm: "adaptive",
  TFT_Item_ArchangelsStaff: "archangel",
  TFT_Item_Bloodthirster: "bloodthirster",
  TFT_Item_BlueBuff: "blue-buff",
  TFT_Item_BrambleVest: "bramble",
  TFT_Item_Crownguard: "crownguard",
  TFT_Item_Deathblade: "damage-amp",
  TFT_Item_DragonsClaw: "dragon-claw",
  TFT_Item_GuardianAngel: "edge-of-night",
  TFT_Item_SpectralGauntlet: "evenshroud",
  TFT_Item_GargoyleStoneplate: "gargoyle",
  TFT_Item_MadredsBloodrazor: "giant-slayer",
  TFT_Item_GuinsoosRageblade: "guinsoo",
  TFT_Item_UnstableConcoction: "hand-of-justice",
  TFT_Item_HextechGunblade: "gunblade",
  TFT_Item_InfinityEdge: "precision",
  TFT_Item_IonicSpark: "ionic-spark",
  TFT_Item_JeweledGauntlet: "precision",
  TFT_Item_RunaansHurricane: "kraken",
  TFT_Item_LastWhisper: "last-whisper",
  TFT_Item_Morellonomicon: "burn-on-hit",
  TFT_Item_Leviathan: "nashor",
  TFT_Item_FrozenHeart: "protectors-vow",
  TFT_Item_Quicksilver: "quicksilver",
  TFT_Item_RabadonsDeathcap: "damage-amp",
  TFT_Item_RapidFireCannon: "red-buff",
  TFT_Item_SpearOfShojin: "shojin",
  TFT_Item_Redemption: "spirit-visage",
  TFT_Item_NightHarvester: "steadfast",
  TFT_Item_SteraksGage: "sterak",
  TFT_Item_PowerGauntlet: "strikers-flail",
  TFT_Item_RedBuff: "sunfire",
  TFT_Item_ThiefsGloves: "thiefs-gloves",
  TFT_Item_TitansResolve: "titans",
  TFT_Item_StatikkShiv: "void-staff",
  TFT_Item_WarmogsArmor: "warmog",
  TFT_Item_TacticiansRing: "noncombat",
  TFT_Item_ForceOfNature: "noncombat",
  TFT_Item_TacticiansScepter: "noncombat",
};

const RADIANT_TO_STANDARD: Readonly<Record<string, keyof typeof STANDARD>> = {
  TFT5_Item_AdaptiveHelmRadiant: "TFT_Item_AdaptiveHelm",
  TFT5_Item_ArchangelsStaffRadiant: "TFT_Item_ArchangelsStaff",
  TFT5_Item_BloodthirsterRadiant: "TFT_Item_Bloodthirster",
  TFT5_Item_BlueBuffRadiant: "TFT_Item_BlueBuff",
  TFT5_Item_BrambleVestRadiant: "TFT_Item_BrambleVest",
  TFT5_Item_CrownguardRadiant: "TFT_Item_Crownguard",
  TFT5_Item_DeathbladeRadiant: "TFT_Item_Deathblade",
  TFT5_Item_DragonsClawRadiant: "TFT_Item_DragonsClaw",
  TFT5_Item_GuardianAngelRadiant: "TFT_Item_GuardianAngel",
  TFT5_Item_SpectralGauntletRadiant: "TFT_Item_SpectralGauntlet",
  TFT5_Item_GargoyleStoneplateRadiant: "TFT_Item_GargoyleStoneplate",
  TFT5_Item_GiantSlayerRadiant: "TFT_Item_MadredsBloodrazor",
  TFT5_Item_GuinsoosRagebladeRadiant: "TFT_Item_GuinsoosRageblade",
  TFT5_Item_HandOfJusticeRadiant: "TFT_Item_UnstableConcoction",
  TFT5_Item_HextechGunbladeRadiant: "TFT_Item_HextechGunblade",
  TFT5_Item_InfinityEdgeRadiant: "TFT_Item_InfinityEdge",
  TFT5_Item_IonicSparkRadiant: "TFT_Item_IonicSpark",
  TFT5_Item_JeweledGauntletRadiant: "TFT_Item_JeweledGauntlet",
  TFT5_Item_RunaansHurricaneRadiant: "TFT_Item_RunaansHurricane",
  TFT5_Item_LastWhisperRadiant: "TFT_Item_LastWhisper",
  TFT5_Item_MorellonomiconRadiant: "TFT_Item_Morellonomicon",
  TFT5_Item_LeviathanRadiant: "TFT_Item_Leviathan",
  TFT5_Item_FrozenHeartRadiant: "TFT_Item_FrozenHeart",
  TFT5_Item_QuicksilverRadiant: "TFT_Item_Quicksilver",
  TFT5_Item_RabadonsDeathcapRadiant: "TFT_Item_RabadonsDeathcap",
  TFT5_Item_RapidFirecannonRadiant: "TFT_Item_RapidFireCannon",
  TFT5_Item_SpearOfShojinRadiant: "TFT_Item_SpearOfShojin",
  TFT5_Item_RedemptionRadiant: "TFT_Item_Redemption",
  TFT5_Item_NightHarvesterRadiant: "TFT_Item_NightHarvester",
  TFT5_Item_SteraksGageRadiant: "TFT_Item_SteraksGage",
  TFT5_Item_TrapClawRadiant: "TFT_Item_PowerGauntlet",
  TFT5_Item_SunfireCapeRadiant: "TFT_Item_RedBuff",
  TFT5_Item_ThiefsGlovesRadiant: "TFT_Item_ThiefsGloves",
  TFT5_Item_TitansResolveRadiant: "TFT_Item_TitansResolve",
  TFT5_Item_StatikkShivRadiant: "TFT_Item_StatikkShiv",
  TFT5_Item_WarmogsArmorRadiant: "TFT_Item_WarmogsArmor",
};

const CONDITIONS: Partial<Record<ItemRuleKind, Omit<ItemConditionDefinition, "itemId">>> = {
  bloodthirster: {
    label: "Threshold shield",
    description: "Allow the once-per-combat shield when Health crosses its threshold.",
    hasToggle: true,
  },
  "edge-of-night": {
    label: "Threshold heal",
    description: "Allow the once-per-combat cleanse/heal when Health crosses its threshold.",
    hasToggle: true,
  },
  evenshroud: {
    label: "Sunder aura in range",
    description: "Treat the opposing unit as inside the Evenshroud aura.",
    hasToggle: true,
  },
  "giant-slayer": {
    label: "Tank target bonus",
    description: "Apply the additional Damage Amp against a Tank-role target.",
    hasToggle: true,
  },
  "ionic-spark": {
    label: "Shred aura in range",
    description: "Treat the opposing unit as inside the Ionic Spark aura.",
    hasToggle: true,
  },
  "protectors-vow": {
    label: "Threshold shield and Mana",
    description: "Allow the once-per-combat shield and Mana grant at low Health.",
    hasToggle: true,
  },
  sterak: {
    label: "Threshold shield",
    description: "Allow the once-per-combat decaying shield at low Health.",
    hasToggle: true,
  },
  "strikers-flail": {
    label: "Critical-strike stacks",
    description: "Use an explicit active Damage Amp stack count; otherwise derive it from attacks.",
    hasToggle: true,
    stackLabel: "Active stacks",
    minStacks: 0,
    maxStacks: 4,
  },
  sunfire: {
    label: "Burn target in range",
    description: "Include periodic Sunfire applications to the selected target.",
    hasToggle: true,
  },
  titans: {
    label: "Titan's Resolve stacks",
    description: "Use an explicit stack count; otherwise derive stacks from attacks and incoming hits.",
    hasToggle: true,
    stackLabel: "Stacks",
    minStacks: 0,
    maxStacks: 25,
  },
};

export function itemRuleKind(itemId: string): ItemRuleKind {
  const direct = STANDARD[itemId];
  if (direct) return direct;
  const standardId = RADIANT_TO_STANDARD[itemId];
  return standardId ? STANDARD[standardId] : "unsupported";
}

export function isRadiantItemId(itemId: string): boolean {
  return itemId.startsWith("TFT5_Item_") && itemId.endsWith("Radiant");
}

export function itemConditionEnabled(
  conditions: Readonly<Record<string, ItemConditionState>>,
  itemId: string,
): boolean {
  return conditions[itemId]?.enabled ?? true;
}

export function itemConditionStacks(
  conditions: Readonly<Record<string, ItemConditionState>>,
  itemId: string,
): number | undefined {
  const value = conditions[itemId]?.stacks;
  return value === undefined || !Number.isFinite(value) ? undefined : Math.max(0, value);
}

export function getItemConditionDefinitions(
  itemIds: readonly (string | null)[],
  target: CalculatorTarget,
): ItemConditionDefinition[] {
  return itemIds.flatMap((itemId) => {
    if (!itemId) return [];
    const kind = itemRuleKind(itemId);
    const relevant = target === "damage"
      ? new Set<ItemRuleKind>([
          "evenshroud", "giant-slayer", "ionic-spark", "strikers-flail", "sunfire", "titans",
        ]).has(kind)
      : new Set<ItemRuleKind>([
          "bloodthirster", "edge-of-night", "protectors-vow", "sterak", "titans",
        ]).has(kind);
    if (!relevant) return [];
    const condition = CONDITIONS[kind];
    return condition ? [{ itemId, ...condition }] : [];
  });
}

export function ruleHasStructuredCombatSupport(kind: ItemRuleKind): boolean {
  return kind !== "unsupported" && kind !== "noncombat" && kind !== "thiefs-gloves";
}
