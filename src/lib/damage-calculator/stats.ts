import type { ManualTraitBuff, DamageScenario, StarLevel } from "./model";
import type { PatchRules } from "./patch-rules";
import { normalizeRole } from "./patch-rules";
import type {
  CalculatorCatalog,
  CatalogChampion,
  CatalogItem,
  CatalogTrait,
} from "./catalog";
import {
  isRadiantItemId,
  itemConditionEnabled,
  itemConditionStacks,
  itemRuleKind,
  ruleHasStructuredCombatSupport,
} from "./item-rules";
import type {
  ActiveItemEffect,
  AppliedModifier,
  FinalCombatStats,
  UnsupportedIssue,
} from "./types";

export type StatBuildResult = {
  stats: FinalCombatStats;
  modifiers: AppliedModifier[];
  activeItemEffects: ActiveItemEffect[];
  unsupported: UnsupportedIssue[];
};

export type ItemStatContext = {
  holder: "attacker" | "defender";
  scenario: Readonly<DamageScenario>;
  timeSeconds: number;
  attackCount: number;
  currentHealth?: number;
  /** Expected/forced critical attacks whose Flail buff has not expired. */
  recentCriticalAttacks?: number;
};

type MutableBonuses = {
  hpFlat: number;
  hpPercent: number;
  attackDamagePercent: number;
  abilityPowerFlat: number;
  attackSpeedPercent: number;
  armorFlat: number;
  magicResistFlat: number;
  critChanceFlat: number;
  initialManaFlat: number;
  manaRegenFlat: number;
  damageAmp: number;
  durability: number;
  attackDamageReduction: number;
  omnivamp: number;
  manaGainMultiplier: number;
  blueBuffMultiplier: number;
};

const BASE_EFFECT_KEYS = new Set([
  "AD", "AP", "AS", "Armor", "MR", "MagicResist", "Health", "HP", "Mana",
  "StartingMana", "ManaRegen", "CritChance", "Omnivamp", "StatOmnivamp",
]);

export function buildFinalStats(args: {
  champion: CatalogChampion;
  starLevel: StarLevel;
  itemIds: readonly (string | null)[];
  traitBuffs: readonly ManualTraitBuff[];
  catalog: CalculatorCatalog;
  rules: PatchRules;
  itemContext?: ItemStatContext;
}): StatBuildResult | null {
  const base = args.champion.stats;
  if (!base) return null;
  const hpBase = base.health * args.rules.starStatMultipliers.hp[args.starLevel];
  const adBase = base.attackDamage * args.rules.starStatMultipliers.attackDamage[args.starLevel];
  const bonuses = emptyBonuses();
  const modifiers: AppliedModifier[] = [];
  const activeItemEffects: ActiveItemEffect[] = [];
  const unsupported: UnsupportedIssue[] = [];
  const equippedUniqueItems = new Set<string>();
  const equippedItems: CatalogItem[] = [];

  for (const itemId of args.itemIds) {
    if (!itemId) continue;
    const item = args.catalog.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      unsupported.push({ scope: "item", sourceId: itemId, message: "Item was not found." });
      continue;
    }
    if (item.unique && equippedUniqueItems.has(item.id)) {
      unsupported.push({
        scope: "item",
        sourceId: item.id,
        message: `${item.name} is unique and cannot be equipped more than once; the duplicate was ignored.`,
      });
      continue;
    }
    if (item.unique) equippedUniqueItems.add(item.id);
    equippedItems.push(item);
    decodeBaseItemStats(item, bonuses, modifiers);
  }

  for (const buff of args.traitBuffs) {
    const trait = args.catalog.traits.find((candidate) => candidate.id === buff.traitId);
    if (!trait) {
      unsupported.push({ scope: "trait", sourceId: buff.traitId, message: "Trait was not found." });
      continue;
    }
    decodeTraitTier(trait, buff.tierMin, bonuses, modifiers, unsupported);
  }

  // Max-Health percent belongs in the same post-flat bucket regardless of item family.
  // Resolve it before any Health-ratio conditional checks.
  for (const item of equippedItems) {
    const kind = itemRuleKind(item.id);
    const percent = kind === "bramble" || kind === "dragon-claw"
      ? number(item.effects.PercentMaxHP)
      : kind === "sunfire" || kind === "warmog"
        ? number(item.effects.BonusPercentHP)
        : 0;
    if (percent > 0) {
      bonuses.hpPercent += percent;
      modifiers.push({
        sourceId: item.id,
        sourceName: item.name,
        stat: "hp",
        operation: "percent",
        value: percent,
      });
    }
  }

  const preliminaryHp = Math.max(0, (hpBase + bonuses.hpFlat) * (1 + bonuses.hpPercent));
  const context = args.itemContext;
  for (const item of equippedItems) {
    applyStructuredItemStats({
      item,
      champion: args.champion,
      rules: args.rules,
      context,
      preliminaryHp,
      bonuses,
      modifiers,
      activeItemEffects,
      unsupported,
    });
  }

  // Blue Buff modifies bonus AD/AP from all sources, not the champion's base AD or base 100 AP.
  const finalAttackDamage = adBase * (1 + bonuses.attackDamagePercent) * bonuses.blueBuffMultiplier;
  const finalAbilityPower = (100 + bonuses.abilityPowerFlat) * bonuses.blueBuffMultiplier;

  return {
    stats: {
      hp: Math.max(0, (hpBase + bonuses.hpFlat) * (1 + bonuses.hpPercent)),
      attackDamage: Math.max(0, finalAttackDamage),
      abilityPower: Math.max(0, finalAbilityPower),
      attackSpeed: clamp(
        base.attackSpeed * (1 + bonuses.attackSpeedPercent),
        0,
        args.rules.attackSpeedCap,
      ),
      armor: base.armor + bonuses.armorFlat,
      magicResist: base.magicResist + bonuses.magicResistFlat,
      critChance: clamp(base.critChance + bonuses.critChanceFlat, 0, 1),
      critMultiplier: Math.max(1, base.critMultiplier),
      initialMana: clamp(base.startingMana + bonuses.initialManaFlat, 0, base.maxMana),
      maxMana: Math.max(0, base.maxMana),
      manaRegen: Math.max(0, bonuses.manaRegenFlat),
      range: Math.max(0, base.range),
      damageAmp: Math.max(0, bonuses.damageAmp),
      durability: clamp(bonuses.durability, 0, 0.95),
      attackDamageReduction: clamp(bonuses.attackDamageReduction, 0, 0.95),
      omnivamp: Math.max(0, bonuses.omnivamp),
      manaGainMultiplier: Math.max(0, bonuses.manaGainMultiplier),
    },
    modifiers,
    activeItemEffects,
    unsupported,
  };
}

function decodeBaseItemStats(
  item: CatalogItem,
  bonuses: MutableBonuses,
  modifiers: AppliedModifier[],
): void {
  const source = { sourceId: item.id, sourceName: item.name };
  const add = (stat: keyof FinalCombatStats, operation: AppliedModifier["operation"], value: number) =>
    modifiers.push({ ...source, stat, operation, value });
  let itemOmnivamp = 0;
  for (const [key, rawValue] of Object.entries(item.effects)) {
    const value = numeric(rawValue);
    if (value === null) continue;
    switch (key) {
      case "AD": bonuses.attackDamagePercent += value; add("attackDamage", "percent", value); break;
      case "AP": bonuses.abilityPowerFlat += value; add("abilityPower", "flat", value); break;
      case "AS": bonuses.attackSpeedPercent += value / 100; add("attackSpeed", "percent", value / 100); break;
      case "Armor": bonuses.armorFlat += value; add("armor", "flat", value); break;
      case "MR":
      case "MagicResist": bonuses.magicResistFlat += value; add("magicResist", "flat", value); break;
      case "Health":
      case "HP": bonuses.hpFlat += value; add("hp", "flat", value); break;
      case "Mana":
      case "StartingMana": bonuses.initialManaFlat += value; add("initialMana", "flat", value); break;
      case "ManaRegen": bonuses.manaRegenFlat += value; add("manaRegen", "flat", value); break;
      case "CritChance": bonuses.critChanceFlat += value / 100; add("critChance", "flat", value / 100); break;
      case "Omnivamp":
      case "StatOmnivamp": itemOmnivamp = Math.max(itemOmnivamp, normalizePercent(value)); break;
    }
  }
  bonuses.omnivamp += itemOmnivamp;
  if (itemOmnivamp > 0) add("omnivamp", "percent", itemOmnivamp);
}

function applyStructuredItemStats(args: {
  item: CatalogItem;
  champion: CatalogChampion;
  rules: PatchRules;
  context?: ItemStatContext;
  preliminaryHp: number;
  bonuses: MutableBonuses;
  modifiers: AppliedModifier[];
  activeItemEffects: ActiveItemEffect[];
  unsupported: UnsupportedIssue[];
}): void {
  const { item, context, bonuses } = args;
  const kind = itemRuleKind(item.id);
  const e = item.effects;
  const radiant = isRadiantItemId(item.id);
  const conditionMap = context?.holder === "attacker"
    ? context.scenario.attackerItemConditions
    : context?.scenario.defenderItemConditions;
  const enabled = conditionMap ? itemConditionEnabled(conditionMap, item.id) : true;
  const time = Math.max(0, context?.timeSeconds ?? 0);
  const attacks = Math.max(0, context?.attackCount ?? 0);
  const source = { sourceId: item.id, sourceName: item.name };
  const add = (stat: keyof FinalCombatStats, operation: AppliedModifier["operation"], value: number) => {
    args.modifiers.push({ ...source, stat, operation, value });
  };
  const active = (label: string, value?: number, unit?: ActiveItemEffect["unit"]) => {
    if (!context) return;
    args.activeItemEffects.push({
      itemId: item.id,
      itemName: item.name,
      holder: context.holder,
      label,
      active: enabled,
      ...(value === undefined ? {} : { value }),
      ...(unit === undefined ? {} : { unit }),
    });
  };

  if (!ruleHasStructuredCombatSupport(kind)) {
    args.unsupported.push({
      scope: "item",
      sourceId: item.id,
      message: kind === "thiefs-gloves"
        ? `${item.name}'s random item roll cannot be modeled deterministically; only its printed base stats apply.`
        : kind === "noncombat"
          ? `${item.name} has no individual combat-stat effect.`
          : `${item.name} has no authored item mechanic rule; only safe printed base stats apply.`,
    });
    return;
  }

  switch (kind) {
    case "adaptive": {
      bonuses.manaGainMultiplier *= 1 + number(e.ManaPercIncrease);
      add("manaGainMultiplier", "percent", number(e.ManaPercIncrease));
      const role = normalizeRole(args.champion.role, args.rules);
      if (role === "tank" || role === "fighter") {
        const resists = number(e.FrontlineResists);
        bonuses.armorFlat += resists;
        bonuses.magicResistFlat += resists;
        add("armor", "flat", resists);
        add("magicResist", "flat", resists);
        active("Frontline role bonus", resists, "flat");
      } else if (!radiant || role === "marksman" || role === "caster") {
        const bonus = normalizePercent(number(e.BacklineADAP));
        bonuses.attackDamagePercent += bonus;
        bonuses.abilityPowerFlat += bonus * 100;
        add("attackDamage", "percent", bonus);
        add("abilityPower", "flat", bonus * 100);
        active("Backline role bonus", bonus, "percent");
      } else {
        active("No Radiant role bonus", 0, "flat");
      }
      break;
    }
    case "archangel": {
      const stacks = Math.floor(time / Math.max(0.001, number(e.IntervalSeconds, 5)));
      const ap = stacks * number(e.APPerInterval);
      bonuses.abilityPowerFlat += ap;
      add("abilityPower", "flat", ap);
      active("Timed AP stacks", stacks, "stacks");
      break;
    }
    case "blue-buff":
      bonuses.blueBuffMultiplier *= 1 + number(e.ModifiedADAP);
      active("Bonus AD/AP multiplier", number(e.ModifiedADAP), "percent");
      break;
    case "bramble":
      bonuses.attackDamageReduction += number(e.AutoDamageReduction);
      add("attackDamageReduction", "percent", number(e.AutoDamageReduction));
      active("Attack damage reduction", number(e.AutoDamageReduction), "percent");
      break;
    case "crownguard": {
      const expiry = number(e.ShieldDuration, 8);
      if (time >= expiry) {
        const ap = number(e.ShieldBonusAP);
        bonuses.abilityPowerFlat += ap;
        add("abilityPower", "flat", ap);
        active("Expired-shield AP", ap, "flat");
      }
      break;
    }
    case "damage-amp": {
      const fallback = item.id.includes("RabadonsDeathcap")
        ? (radiant ? 0.5 : 0.15)
        : (radiant ? 0.2 : 0.1);
      const amp = number(e.BonusDamage, fallback);
      bonuses.damageAmp += amp;
      add("damageAmp", "percent", amp);
      active("Damage Amp", amp, "percent");
      break;
    }
    case "dragon-claw":
      break;
    case "evenshroud": {
      if (time < number(e.BonusResistDuration)) {
        const resists = number(e.BonusResists);
        bonuses.armorFlat += resists;
        bonuses.magicResistFlat += resists;
        add("armor", "flat", resists);
        add("magicResist", "flat", resists);
        active("Opening resists", resists, "flat");
      }
      break;
    }
    case "gargoyle": {
      const enemies = context?.holder === "attacker"
        ? context.scenario.enemiesTargetingAttacker
        : context?.scenario.enemiesTargetingDefender ?? 1;
      const armor = enemies * number(e.ArmorPerEnemy);
      const mr = enemies * number(e.MRPerEnemy);
      bonuses.armorFlat += armor;
      bonuses.magicResistFlat += mr;
      add("armor", "flat", armor);
      add("magicResist", "flat", mr);
      active("Enemies targeting holder", enemies, "stacks");
      break;
    }
    case "giant-slayer": {
      const amp = number(e.DamageAmp);
      bonuses.damageAmp += amp;
      add("damageAmp", "percent", amp);
      active("Base Damage Amp", amp, "percent");
      break;
    }
    case "guinsoo": {
      const as = Math.floor(time) * normalizePercent(number(e.AttackSpeedPerStack));
      bonuses.attackSpeedPercent += as;
      add("attackSpeed", "percent", as);
      active("Timed Attack Speed", Math.floor(time), "stacks");
      break;
    }
    case "hand-of-justice": {
      const hp = context?.currentHealth ?? args.preliminaryHp;
      const above = hp / Math.max(1, args.preliminaryHp) > number(e.HealthThreshold, 0.5);
      const multiplier = above ? 2 : 1;
      const ad = number(e.AD_NotStatBar) * multiplier;
      const ap = number(e.AP_NotStatBar) * multiplier;
      bonuses.attackDamagePercent += ad;
      bonuses.abilityPowerFlat += ap;
      bonuses.omnivamp += number(e.StatOmnivamp_NotStatBar) * (above ? 1 : 2);
      add("attackDamage", "percent", ad);
      add("abilityPower", "flat", ap);
      active(above ? "Above-half offensive bonus" : "Below-half Omnivamp bonus");
      break;
    }
    case "kraken": {
      const max = Math.max(0, number(e.MaxStacks, 15));
      const stacks = Math.min(max, Math.floor(attacks));
      const ad = stacks * number(e.ADOnAttack);
      bonuses.attackDamagePercent += ad;
      add("attackDamage", "percent", ad);
      if (stacks >= max) {
        bonuses.attackSpeedPercent += number(e.ASCapstone);
        add("attackSpeed", "percent", number(e.ASCapstone));
      }
      active("Attack stacks", stacks, "stacks");
      break;
    }
    case "protectors-vow":
      bonuses.initialManaFlat += number(e.CombatStartMana);
      add("initialMana", "flat", number(e.CombatStartMana));
      break;
    case "quicksilver": {
      const as = Math.floor(time) * number(e.ProcAttackSpeed);
      bonuses.attackSpeedPercent += as;
      add("attackSpeed", "percent", as);
      active("Timed Attack Speed", Math.floor(time), "stacks");
      break;
    }
    case "red-buff": {
      const amp = number(e.BonusDamage);
      bonuses.damageAmp += amp;
      add("damageAmp", "percent", amp);
      active("Damage Amp", amp, "percent");
      break;
    }
    case "spirit-visage": {
      const dr = radiant ? 0.15 : 0.08;
      bonuses.durability += dr;
      add("durability", "percent", dr);
      active("Damage reduction", dr, "percent");
      break;
    }
    case "steadfast": {
      const hp = context?.currentHealth ?? args.preliminaryHp;
      const above = hp / Math.max(1, args.preliminaryHp) > number(e.ThresholdForEmpower, 0.5);
      const durability = above ? number(e.EmpoweredDurability) : number(e.BaseDurability);
      bonuses.durability += durability;
      add("durability", "percent", durability);
      active(above ? "Empowered durability" : "Base durability", durability, "percent");
      break;
    }
    case "strikers-flail": {
      const baseAmp = radiant ? 0.2 : 0.1;
      const manual = conditionMap ? itemConditionStacks(conditionMap, item.id) : undefined;
      const stacks = enabled
        ? Math.min(
            number(e.MaxStacks, 4),
            manual ?? (context?.recentCriticalAttacks ?? 0),
          )
        : 0;
      const amp = baseAmp + stacks * number(e.BuffDamageAmp);
      bonuses.damageAmp += amp;
      add("damageAmp", "percent", amp);
      active("Active Damage Amp stacks", stacks, "stacks");
      break;
    }
    case "sunfire":
      break;
    case "titans": {
      const max = number(e.StackCap, 25);
      const manual = conditionMap ? itemConditionStacks(conditionMap, item.id) : undefined;
      const incoming = Math.floor(time * (context?.scenario.incomingHitsPerSecond ?? 0));
      const stacks = enabled ? Math.min(max, manual ?? Math.floor(attacks + incoming)) : 0;
      const ad = stacks * number(e.StackingAD);
      const ap = stacks * number(e.StackingSP);
      bonuses.attackDamagePercent += ad;
      bonuses.abilityPowerFlat += ap;
      add("attackDamage", "percent", ad);
      add("abilityPower", "flat", ap);
      if (stacks >= max) {
        bonuses.damageAmp += number(e.StackedAmp);
        add("damageAmp", "percent", number(e.StackedAmp));
      }
      active("Resolve stacks", stacks, "stacks");
      break;
    }
    case "warmog":
      break;
    case "bloodthirster":
    case "edge-of-night":
    case "gunblade":
    case "precision":
    case "ionic-spark":
    case "last-whisper":
    case "burn-on-hit":
    case "nashor":
    case "shojin":
    case "sterak":
    case "void-staff":
      break;
  }

  const omittedMessage = kind === "bramble"
    ? "Bramble retaliation damages the opposing attacker and is outside the selected attacker-to-defender damage total."
    : kind === "gunblade"
      ? "Gunblade ally healing is outside this single-target damage projection."
      : kind === "ionic-spark"
        ? "Ionic Spark enemy-cast retaliation damage is outside this attacker-to-defender projection."
        : (number(e.Omnivamp) > 0 || number(e.StatOmnivamp) > 0 || number(e.StatOmnivamp_NotStatBar) > 0)
          ? `${item.name} Omnivamp is shown as a final stat, but attacker self-healing is not simulated.`
          : null;
  if (omittedMessage) {
    args.unsupported.push({ scope: "item", sourceId: item.id, message: omittedMessage });
  }

  // Every key on a supported rule is intentionally either a base stat or handled by its
  // authored mechanic. We avoid emitting one noisy issue per internal/hash field.
  void BASE_EFFECT_KEYS;
}

function decodeTraitTier(
  trait: CatalogTrait,
  tierMin: number,
  bonuses: MutableBonuses,
  modifiers: AppliedModifier[],
  unsupported: UnsupportedIssue[],
): void {
  const tier = trait.tiers.find((candidate) => candidate.min === tierMin);
  if (!tier) {
    unsupported.push({ scope: "trait", sourceId: trait.id, message: `Tier ${tierMin} was not found for ${trait.name}.` });
    return;
  }
  for (const [key, rawValue] of Object.entries(tier.variables)) {
    const value = numeric(rawValue);
    if (value === null) continue;
    const source = { sourceId: trait.id, sourceName: trait.name };
    if (key === "Armor") {
      bonuses.armorFlat += value;
      modifiers.push({ ...source, stat: "armor", operation: "flat", value });
    } else if (key === "MR" || key === "MagicResist") {
      bonuses.magicResistFlat += value;
      modifiers.push({ ...source, stat: "magicResist", operation: "flat", value });
    } else if (key === "AP") {
      bonuses.abilityPowerFlat += value;
      modifiers.push({ ...source, stat: "abilityPower", operation: "flat", value });
    } else if (!/^(MinUnits|MaxUnits)$/i.test(key)) {
      unsupported.push({ scope: "trait", sourceId: trait.id, message: `${trait.name} effect '${key}' has no safe generic decoder.` });
    }
  }
}

function emptyBonuses(): MutableBonuses {
  return {
    hpFlat: 0,
    hpPercent: 0,
    attackDamagePercent: 0,
    abilityPowerFlat: 0,
    attackSpeedPercent: 0,
    armorFlat: 0,
    magicResistFlat: 0,
    critChanceFlat: 0,
    initialManaFlat: 0,
    manaRegenFlat: 0,
    damageAmp: 0,
    durability: 0,
    attackDamageReduction: 0,
    omnivamp: 0,
    manaGainMultiplier: 1,
    blueBuffMultiplier: 1,
  };
}

function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizePercent(value: number): number {
  return Math.abs(value) > 1 ? value / 100 : value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
