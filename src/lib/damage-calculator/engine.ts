import type { TftSet } from "@/data/types";
import type { DamageCalculationInput } from "./model";
import { readCalculatorCatalog } from "./catalog";
import { simulateCombat } from "./combat-simulation";
import { calculateCritDamage } from "./crit";
import { calculateAuthoredAbility, type AbilityDamagePacket } from "./handlers/champions";
import { estimateFirstCast } from "./mana";
import { getPatchRules } from "./patch-rules";
import { itemConditionEnabled, itemRuleKind } from "./item-rules";
import { resistanceMultiplier } from "./resistance";
import { applyDamageToPool, type DamagePool } from "./shields";
import { buildFinalStats } from "./stats";
import type {
  DamageCalculationResult,
  DamageEventResult,
  FinalCombatStats,
  UnsupportedIssue,
} from "./types";

export type { DamageCalculationResult } from "./types";

/**
 * Pure deterministic snapshot calculation. Structured numbers come from the catalog;
 * semantic spell behavior comes only from explicit champion/item/trait handlers.
 */
export function calculateDamage(
  input: DamageCalculationInput,
  data: TftSet,
): DamageCalculationResult {
  const result = emptyResult();
  const missing: ("attacker" | "defender")[] = [];
  if (!input.attacker.championId) missing.push("attacker");
  if (!input.defender.championId) missing.push("defender");
  if (missing.length > 0) return { ...result, status: "incomplete", missing };

  const catalog = readCalculatorCatalog(data);
  const attacker = catalog.champions.find(
    (champion) => champion.id === input.attacker.championId,
  );
  const defender = catalog.champions.find(
    (champion) => champion.id === input.defender.championId,
  );
  if (!attacker || !defender) {
    const unsupported: UnsupportedIssue[] = [];
    if (!attacker) {
      unsupported.push({
        scope: "catalog",
        sourceId: input.attacker.championId ?? undefined,
        message: "Attacker was not found in the selected set.",
      });
    }
    if (!defender) {
      unsupported.push({
        scope: "catalog",
        sourceId: input.defender.championId ?? undefined,
        message: "Defender was not found in the selected set.",
      });
    }
    return { ...result, status: "unsupported", unsupported };
  }

  const rules = getPatchRules(catalog.setNumber, catalog.patch);
  const attackerBuild = buildFinalStats({
    champion: attacker,
    starLevel: input.attacker.starLevel,
    itemIds: input.attacker.itemIds,
    traitBuffs: input.buffs.filter((buff) => buff.target === "damage"),
    catalog,
    rules,
    itemContext: {
      holder: "attacker",
      scenario: input.scenario,
      timeSeconds: 0,
      attackCount: 0,
      currentHealth: input.scenario.attackerCurrentHealth,
    },
  });
  const defenderBuild = buildFinalStats({
    champion: defender,
    starLevel: input.defender.starLevel,
    itemIds: input.defender.itemIds,
    traitBuffs: input.buffs.filter((buff) => buff.target === "tank"),
    catalog,
    rules,
    itemContext: {
      holder: "defender",
      scenario: input.scenario,
      timeSeconds: 0,
      attackCount: 0,
      currentHealth: input.scenario.defenderCurrentHealth,
    },
  });
  if (!attackerBuild || !defenderBuild) {
    const unsupported: UnsupportedIssue[] = [];
    if (!attackerBuild) {
      unsupported.push({
        scope: "champion",
        sourceId: attacker.id,
        message: `${attacker.name} has no structured combat stats.`,
      });
    }
    if (!defenderBuild) {
      unsupported.push({
        scope: "champion",
        sourceId: defender.id,
        message: `${defender.name} has no structured combat stats.`,
      });
    }
    return { ...result, status: "unsupported", unsupported };
  }

  result.finalStats = { attacker: attackerBuild.stats, defender: defenderBuild.stats };
  const equippedAttackerItems = catalog.items.filter((item) =>
    input.attacker.itemIds.includes(item.id));
  const initialDefenses = snapshotDefenses(
    defenderBuild.stats,
    equippedAttackerItems,
    input,
    false,
  );
  result.effectiveDefenses = { armor: initialDefenses.armor, magicResist: initialDefenses.magicResist };
  result.modifiers = [...attackerBuild.modifiers, ...defenderBuild.modifiers];
  result.unsupported.push(...attackerBuild.unsupported, ...defenderBuild.unsupported);
  result.assumptions.push(...rules.assumptions);
  if (rules.id === "unverified-fallback") {
    result.unsupported.push({
      scope: "rules",
      message: `No exact patch rules were found for set ${catalog.setNumber}.`,
    });
  }

  let pool: DamagePool = {
    shield: finiteNonNegative(input.scenario.defenderShield),
    health: Math.min(
      defenderBuild.stats.hp,
      finiteNonNegative(input.scenario.defenderCurrentHealth ?? defenderBuild.stats.hp),
    ),
  };
  const basicCrit = calculateCritDamage(
    attackerBuild.stats.attackDamage,
    attackerBuild.stats.critChance,
    attackerBuild.stats.critMultiplier,
    input.scenario.critMode,
  );
  const basic = resolveDamageEvent(
    {
      sourceId: attacker.id,
      sourceName: `${attacker.name} basic attack`,
      damageType: "physical",
      rawDamage: basicCrit.damage,
    },
    "basic-attack",
    basicCrit.state,
    defenderBuild.stats,
    pool,
    0,
    initialDefenses,
    attackerBuild.stats.damageAmp,
    defenderBuild.stats.durability,
    defenderBuild.stats.attackDamageReduction,
  );
  pool = basic.pool;
  result.basicAttack = basic.event;
  result.events.push(basic.event);

  const abilityResult = calculateAuthoredAbility({
    champion: attacker,
    starLevel: input.attacker.starLevel,
    attacker: attackerBuild.stats,
  });
  result.assumptions.push(...abilityResult.assumptions);
  result.unsupported.push(...abilityResult.unsupported);
  for (const [index, packet] of abilityResult.packets.entries()) {
    const precisionCount = equippedAttackerItems.filter((item) =>
      itemRuleKind(item.id) === "precision").length;
    const abilityCrit = precisionCount > 0
      ? calculateCritDamage(
          packet.rawDamage,
          attackerBuild.stats.critChance,
          attackerBuild.stats.critMultiplier + Math.max(0, precisionCount - 1) * 0.1,
          input.scenario.critMode,
        )
      : { damage: packet.rawDamage, state: "ineligible" as const };
    const onDamageDefenses = snapshotDefenses(
      defenderBuild.stats,
      equippedAttackerItems,
      input,
      true,
    );
    const resolved = resolveDamageEvent(
      { ...packet, rawDamage: abilityCrit.damage },
      "ability",
      abilityCrit.state,
      defenderBuild.stats,
      pool,
      index,
      onDamageDefenses,
      attackerBuild.stats.damageAmp,
      defenderBuild.stats.durability,
      0,
    );
    pool = resolved.pool;
    result.ability.push(resolved.event);
    result.events.push(resolved.event);
  }

  result.manaEstimate = estimateFirstCast({
    stats: attackerBuild.stats,
    rawRole: attacker.role,
    startingMana: input.scenario.attackerStartingMana,
    rules,
    bonusManaPerAttack: itemManaPerAttack(equippedAttackerItems, attackerBuild.stats, input),
    manaGainMultiplier: attackerBuild.stats.manaGainMultiplier,
  });
  if (result.manaEstimate.warning) {
    result.warnings.push(result.manaEstimate.warning);
  }
  const simulation = simulateCombat({ input, catalog, attacker, defender, rules });
  result.checkpoints = simulation.checkpoints;
  result.activeItemEffects = simulation.activeItemEffects;
  result.defenseDebuffs = simulation.defenseDebuffs;
  result.tankStats = simulation.tankStats;
  result.timeToKillSeconds = simulation.timeToKillSeconds;
  result.assumptions.push(...simulation.assumptions);
  result.warnings.push(...simulation.warnings);
  result.unsupported.push(...simulation.unsupported);
  result.unsupported = dedupeIssues(result.unsupported);
  result.effectiveDefenses = {
    armor: simulation.defenseDebuffs.effectiveArmor,
    magicResist: simulation.defenseDebuffs.effectiveMagicResist,
  };
  for (const event of result.events) addEventToTotals(result, event);
  result.status = result.unsupported.length > 0 ? "partial" : "complete";
  return result;
}

function resolveDamageEvent(
  packet: AbilityDamagePacket,
  category: DamageEventResult["category"],
  crit: DamageEventResult["crit"],
  defender: FinalCombatStats,
  pool: DamagePool,
  index: number,
  effectiveDefenses?: { armor: number; magicResist: number },
  damageAmp = 0,
  durability = 0,
  attackDamageReduction = 0,
): { event: DamageEventResult; pool: DamagePool } {
  const resistance = packet.damageType === "physical"
    ? effectiveDefenses?.armor ?? defender.armor
    : packet.damageType === "magic"
      ? effectiveDefenses?.magicResist ?? defender.magicResist
      : null;
  const multiplier = resistance === null ? 1 : resistanceMultiplier(resistance);
  const categoryReduction = category === "basic-attack" ? attackDamageReduction : 0;
  const mitigatedDamage = finiteNonNegative(packet.rawDamage) *
    (1 + damageAmp) * multiplier * (1 - durability) * (1 - categoryReduction);
  const applied = applyDamageToPool(pool, mitigatedDamage);
  return {
    event: {
      id: `${category}:${packet.sourceId}:${index}`,
      category,
      sourceId: packet.sourceId,
      sourceName: packet.sourceName,
      damageType: packet.damageType,
      rawDamage: finiteNonNegative(packet.rawDamage),
      crit,
      effectiveResistance: resistance,
      resistanceMultiplier: multiplier,
      mitigatedDamage,
      absorbedDamage: applied.absorbedDamage,
      healthDamage: applied.healthDamage,
    },
    pool: { shield: applied.shield, health: applied.health },
  };
}

function addEventToTotals(result: DamageCalculationResult, event: DamageEventResult): void {
  result.totals[event.damageType] += event.mitigatedDamage;
  result.totals.absorbed += event.absorbedDamage;
  result.totals.health += event.healthDamage;
}

function emptyResult(): DamageCalculationResult {
  return {
    status: "incomplete",
    missing: [],
    totals: { physical: 0, magic: 0, true: 0, absorbed: 0, health: 0 },
    basicAttack: null,
    ability: [],
    finalStats: { attacker: null, defender: null },
    effectiveDefenses: null,
    events: [],
    modifiers: [],
    manaEstimate: null,
    checkpoints: [],
    activeItemEffects: [],
    defenseDebuffs: null,
    tankStats: null,
    timeToKillSeconds: null,
    assumptions: [],
    warnings: [],
    unsupported: [],
  };
}

function snapshotDefenses(
  defender: FinalCombatStats,
  attackerItems: ReturnType<typeof readCalculatorCatalog>["items"],
  input: DamageCalculationInput,
  onDamageActive: boolean,
): { armor: number; magicResist: number } {
  const sunder = [
    input.scenario.externalArmorSunder.enabled ? input.scenario.externalArmorSunder.percent : 0,
    ...attackerItems.map((item) => {
      const kind = itemRuleKind(item.id);
      if (kind === "evenshroud" && itemConditionEnabled(input.scenario.attackerItemConditions, item.id)) {
        return numeric(item.effects.ARReductionAmount);
      }
      if (kind === "last-whisper" && onDamageActive) return numeric(item.effects.ArmorReductionPercent);
      return 0;
    }),
  ];
  const shred = [
    input.scenario.externalMagicShred.enabled ? input.scenario.externalMagicShred.percent : 0,
    ...attackerItems.map((item) => {
      const kind = itemRuleKind(item.id);
      if (kind === "ionic-spark" && itemConditionEnabled(input.scenario.attackerItemConditions, item.id)) {
        return numeric(item.effects.MRShred);
      }
      if (kind === "void-staff" && onDamageActive) return numeric(item.effects.MRShred);
      return 0;
    }),
  ];
  return {
    armor: defender.armor * (1 - Math.max(0, ...sunder) / 100),
    magicResist: defender.magicResist * (1 - Math.max(0, ...shred) / 100),
  };
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function itemManaPerAttack(
  items: ReturnType<typeof readCalculatorCatalog>["items"],
  stats: FinalCombatStats,
  input: DamageCalculationInput,
): number {
  let total = 0;
  const critWeight = input.scenario.critMode === "force-crit"
    ? 1
    : input.scenario.critMode === "force-no-crit"
      ? 0
      : stats.critChance;
  for (const item of items) {
    const kind = itemRuleKind(item.id);
    if (kind === "shojin") total += numeric(item.effects.FlatManaRestore);
    if (kind === "nashor") {
      const base = numeric(item.effects.BaseManaOnHit);
      total += base + (numeric(item.effects.ManaOnCrit) - base) * critWeight;
    }
  }
  return total;
}

function dedupeIssues(issues: UnsupportedIssue[]): UnsupportedIssue[] {
  return [...new Map(issues.map((issue) => [`${issue.scope}:${issue.sourceId}:${issue.message}`, issue])).values()];
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
