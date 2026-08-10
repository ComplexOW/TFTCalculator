import type { CalculatorCatalog, CatalogChampion, CatalogItem } from "./catalog";
import { calculateCritDamage } from "./crit";
import { calculateAuthoredAbility, type AbilityDamagePacket } from "./handlers/champions";
import { itemConditionEnabled, itemRuleKind } from "./item-rules";
import type { DamageCalculationInput } from "./model";
import type { PatchRules } from "./patch-rules";
import { normalizeRole } from "./patch-rules";
import { resistanceMultiplier } from "./resistance";
import type {
  ActiveItemEffect,
  DamageCheckpoint,
  DefenseDebuffSource,
  DefenseDebuffSummary,
  FinalCombatStats,
  TankStats,
  UnsupportedIssue,
} from "./types";
import { buildFinalStats } from "./stats";

type Totals = {
  damage: number;
  health: number;
  physical: number;
  magic: number;
  true: number;
};

type TimedShield = {
  itemId: string;
  amount: number;
  expiry: number;
  decayPerSecond: number;
};

type BurnStatus = {
  percent: number;
  woundPercent: number;
  expires: number;
};

type WeightedCrit = { time: number; weight: number };
type EquippedItem = CatalogItem & { slotKey: string };

export type CombatSimulationResult = {
  checkpoints: DamageCheckpoint[];
  activeItemEffects: ActiveItemEffect[];
  defenseDebuffs: DefenseDebuffSummary;
  tankStats: TankStats;
  timeToKillSeconds: number | null;
  assumptions: string[];
  warnings: string[];
  unsupported: UnsupportedIssue[];
};

/**
 * Fixed-step deterministic combat projection. The 50ms step is small enough to preserve
 * TFT's second-granularity item rules while keeping the result stable and inexpensive.
 */
export function simulateCombat(args: {
  input: DamageCalculationInput;
  catalog: CalculatorCatalog;
  attacker: CatalogChampion;
  defender: CatalogChampion;
  rules: PatchRules;
}): CombatSimulationResult {
  const { input, catalog, attacker, defender, rules } = args;
  const duration = clamp(input.scenario.combatDurationSeconds, 0, 120);
  const checkpoints = normalizeCheckpoints(input.scenario.timeCheckpoints, duration);
  const attackerItems = readItems(input.attacker.itemIds, catalog);
  const defenderItems = readItems(input.defender.itemIds, catalog);
  const unsupported: UnsupportedIssue[] = [];
  const assumptions = [
    "Timeline DPS uses a deterministic 50 ms simulation step; Attack Speed is attacks per second.",
    "Ability casts repeat whenever generated Mana reaches maximum; casts reset Mana to zero immediately. Cast animation and the one-second Mana-lock window are not simulated.",
    "Damage modifiers use raw → crit → additive Damage Amp → resistance after the strongest Sunder/Shred → Durability/attack reduction → shield → Health.",
  ];
  const warnings: string[] = [];

  const initialDefenderBuild = buildFinalStats({
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
  const initialAttackerBuild = buildFinalStats({
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
  if (!initialDefenderBuild || !initialAttackerBuild) {
    throw new Error("simulateCombat requires champions with structured stats");
  }
  const initialDefenderStats = initialDefenderBuild.stats;

  const maxHealth = initialDefenderStats.hp;
  const startingHealth = Math.min(
    maxHealth,
    finiteNonNegative(input.scenario.defenderCurrentHealth ?? maxHealth),
  );
  let health = startingHealth;
  const manualShield = finiteNonNegative(input.scenario.defenderShield);
  let manualShieldRemaining = manualShield;
  const timedShields: TimedShield[] = [];
  let thresholdShieldsGranted = 0;
  let defenderMana = initialDefenderBuild.stats.initialMana;
  let thresholdManaGranted = 0;
  let healing = 0;
  let timeToKillSeconds: number | null = null;
  const triggered = new Set<string>();
  const totals: Totals = { damage: 0, health: 0, physical: 0, magic: 0, true: 0 };
  let attacks = 0;
  let casts = 0;
  let attackProgress = 0;
  let mana = clamp(
    input.scenario.attackerStartingMana ?? initialAttackerBuild.stats.initialMana,
    0,
    initialAttackerBuild.stats.maxMana,
  );
  const burns = new Map<string, BurnStatus>();
  let nextBurnTick: number | null = null;
  let lastSunfireProc = 0;
  const lastDragonHeal = new Map<string, number>();
  const lastSpiritHeal = new Map<string, number>();
  const sunderExpiries = new Map<string, number>();
  const shredExpiries = new Map<string, number>();
  const recentCrits: WeightedCrit[] = [];
  let untargetableUntil = 0;
  const output: DamageCheckpoint[] = [];

  // Combat-start defender shields are separate timed pools so expiry is modeled.
  for (const item of defenderItems) {
    if (itemRuleKind(item.id) !== "crownguard") continue;
    const amount = maxHealth * number(item.effects.ShieldSize) / 100;
    grantShield(item, amount, number(item.effects.ShieldDuration, 8), 0);
  }

  let latestAttacker = initialAttackerBuild.stats;
  let latestDefender = initialDefenderBuild.stats;
  triggerThresholdEffects(maxHealth, startingHealth, 0);
  const startingShield = totalShield();

  let latestDebuffs = collectDebuffs(0);
  if (
    mana >= latestAttacker.maxMana &&
    latestAttacker.maxMana > 0 &&
    untargetableUntil <= 0
  ) {
    casts += 1;
    mana = 0;
    const ability = calculateAuthoredAbility({
      champion: attacker,
      starLevel: input.attacker.starLevel,
      attacker: latestAttacker,
    });
    unsupported.push(...ability.unsupported);
    for (const packet of ability.packets) {
      const untargetableBeforeHit = untargetableUntil;
      applyPacket(
        precisionPacket(packet, latestAttacker, attackerItems, input.scenario.critMode),
        false,
        latestAttacker,
        latestDefender,
        latestDebuffs,
        0,
      );
      if (untargetableUntil <= untargetableBeforeHit) {
        activateOnDamageDebuffs(0);
        applyOnHitBurn(0);
      }
    }
  }
  recordDueCheckpoints(0);

  const dt = 0.05;
  for (let time = dt; time <= duration + 1e-9 && health > 0; time = roundStep(time + dt)) {
    updateTimedShields(time, dt);
    while (recentCrits.length > 0 && recentCrits[0].time + 5 < time - 1e-9) recentCrits.shift();
    const recentCriticalAttacks = recentCrits.reduce((sum, crit) => sum + crit.weight, 0);

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
        timeSeconds: time,
        attackCount: attacks,
        currentHealth: input.scenario.attackerCurrentHealth,
        recentCriticalAttacks,
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
        timeSeconds: time,
        attackCount: 0,
        currentHealth: health,
      },
    });
    if (!attackerBuild || !defenderBuild) break;
    latestAttacker = attackerBuild.stats;
    latestDefender = defenderBuild.stats;
    mana = Math.min(
      latestAttacker.maxMana,
      mana + passiveManaPerSecond(attacker, latestAttacker, rules) * dt,
    );
    attackProgress += latestAttacker.attackSpeed * dt;

    if (time < untargetableUntil) {
      attackProgress = Math.min(attackProgress, 0.999999);
      applyBurnTicks(time);
      applyDefenderHealing(time, latestDefender);
      recordDueCheckpoints(time);
      continue;
    }

    while (attackProgress >= 1 && health > 0) {
      attackProgress -= 1;
      attacks += 1;
      latestDebuffs = collectDebuffs(time);
      const crit = calculateCritDamage(
        latestAttacker.attackDamage,
        latestAttacker.critChance,
        latestAttacker.critMultiplier,
        input.scenario.critMode,
      );
      const untargetableBeforeHit = untargetableUntil;
      applyPacket(
        { sourceId: attacker.id, sourceName: `${attacker.name} basic attack`, damageType: "physical", rawDamage: crit.damage },
        true,
        latestAttacker,
        latestDefender,
        latestDebuffs,
        time,
      );
      recentCrits.push({ time, weight: critWeight(input.scenario.critMode, latestAttacker.critChance) });
      if (untargetableUntil <= Math.max(time, untargetableBeforeHit)) {
        activateOnDamageDebuffs(time);
        applyOnHitBurn(time);
      }
      mana = Math.min(
        latestAttacker.maxMana,
        mana + attackManaGain(
          attacker,
          latestAttacker,
          attackerItems,
          rules,
          input.scenario.critMode,
        ),
      );
      if (untargetableUntil > time) break;
    }

    if (
      health > 0 &&
      time >= untargetableUntil &&
      latestAttacker.maxMana > 0 &&
      mana >= latestAttacker.maxMana
    ) {
      casts += 1;
      mana = 0;
      const ability = calculateAuthoredAbility({
        champion: attacker,
        starLevel: input.attacker.starLevel,
        attacker: latestAttacker,
      });
      if (casts === 1) unsupported.push(...ability.unsupported);
      for (const packet of ability.packets) {
        latestDebuffs = collectDebuffs(time);
        const untargetableBeforeHit = untargetableUntil;
        applyPacket(
          precisionPacket(packet, latestAttacker, attackerItems, input.scenario.critMode),
          false,
          latestAttacker,
          latestDefender,
          latestDebuffs,
          time,
        );
        if (untargetableUntil <= Math.max(time, untargetableBeforeHit)) {
          activateOnDamageDebuffs(time);
          applyOnHitBurn(time);
        }
        if (untargetableUntil > time) break;
      }
    }

    if (health > 0) {
      if (time >= untargetableUntil) applySunfire(time);
      applyBurnTicks(time);
      applyDefenderHealing(time, latestDefender);
    }
    recordDueCheckpoints(time);
  }

  // Fill later requested checkpoints after death with the terminal state.
  recordDueCheckpoints(duration, true);
  const finalDebuffs = collectDebuffs(duration);
  const horizonAttacker = buildFinalStats({
    champion: attacker,
    starLevel: input.attacker.starLevel,
    itemIds: input.attacker.itemIds,
    traitBuffs: input.buffs.filter((buff) => buff.target === "damage"),
    catalog,
    rules,
    itemContext: {
      holder: "attacker",
      scenario: input.scenario,
      timeSeconds: duration,
      attackCount: attacks,
      currentHealth: input.scenario.attackerCurrentHealth,
      recentCriticalAttacks: recentCrits.reduce((sum, crit) => sum + crit.weight, 0),
    },
  });
  const horizonDefender = buildFinalStats({
    champion: defender,
    starLevel: input.defender.starLevel,
    itemIds: input.defender.itemIds,
    traitBuffs: input.buffs.filter((buff) => buff.target === "tank"),
    catalog,
    rules,
    itemContext: {
      holder: "defender",
      scenario: input.scenario,
      timeSeconds: duration,
      attackCount: 0,
      currentHealth: health,
    },
  });

  return {
    checkpoints: output,
    activeItemEffects: [
      ...(horizonAttacker?.activeItemEffects ?? []),
      ...(horizonDefender?.activeItemEffects ?? []),
    ],
    defenseDebuffs: finalDebuffs,
    tankStats: {
      maxHealth,
      startingHealth,
      endingHealth: health,
      startingShield,
      endingShield: totalShield(),
      armor: latestDefender.armor,
      magicResist: latestDefender.magicResist,
      durability: latestDefender.durability,
      attackDamageReduction: latestDefender.attackDamageReduction,
      healing,
      thresholdShieldsGranted,
      startingMana: initialDefenderBuild.stats.initialMana,
      endingMana: defenderMana,
      thresholdManaGranted,
    },
    timeToKillSeconds,
    assumptions,
    warnings,
    unsupported: dedupeIssues(unsupported),
  };

  function applyPacket(
    packet: AbilityDamagePacket,
    isAttack: boolean,
    attackerStats: FinalCombatStats,
    defenderStats: FinalCombatStats,
    debuffs: DefenseDebuffSummary,
    time: number,
  ): void {
    let amp = attackerStats.damageAmp;
    if (
      attackerItems.some((item) =>
        itemRuleKind(item.id) === "giant-slayer" &&
        itemConditionEnabled(input.scenario.attackerItemConditions, item.id)) &&
      normalizeRole(defender.role, rules) === "tank"
    ) {
      amp += Math.max(
        ...attackerItems
          .filter((item) =>
            itemRuleKind(item.id) === "giant-slayer" &&
            itemConditionEnabled(input.scenario.attackerItemConditions, item.id))
          .map((item) => number(item.effects.DamageAmp)),
        0,
      );
    }
    const amplified = finiteNonNegative(packet.rawDamage) * (1 + amp);
    const resistance = packet.damageType === "physical"
      ? debuffs.effectiveArmor
      : packet.damageType === "magic"
        ? debuffs.effectiveMagicResist
        : null;
    let mitigated = amplified * (resistance === null ? 1 : resistanceMultiplier(resistance));
    mitigated *= 1 - defenderStats.durability;
    if (isAttack) mitigated *= 1 - defenderStats.attackDamageReduction;
    mitigated = finiteNonNegative(mitigated);
    totals.damage += mitigated;
    totals[packet.damageType] += mitigated;
    const absorbed = consumeShield(mitigated);
    const healthDamage = Math.min(health, mitigated - absorbed);
    const previousHealth = health;
    health -= healthDamage;
    totals.health += healthDamage;
    triggerThresholdEffects(previousHealth, health, time);
    if (health <= 0 && timeToKillSeconds === null) timeToKillSeconds = time;
  }

  function triggerThresholdEffects(previousHealth: number, nextHealth: number, time: number): void {
    for (const item of defenderItems) {
      if (!itemConditionEnabled(input.scenario.defenderItemConditions, item.id)) continue;
      const kind = itemRuleKind(item.id);
      if (!["bloodthirster", "edge-of-night", "protectors-vow", "sterak"].includes(kind)) continue;
      if (triggered.has(item.slotKey)) continue;
      const threshold = number(item.effects.HealthThreshold) / 100;
      const crossed = previousHealth / Math.max(1, maxHealth) > threshold &&
        nextHealth / Math.max(1, maxHealth) <= threshold;
      if (!crossed) continue;
      triggered.add(item.slotKey);
      if (kind === "edge-of-night") {
        burns.clear();
        nextBurnTick = null;
        sunderExpiries.clear();
        shredExpiries.clear();
        const missing = maxHealth - health;
        const restored = missing * number(item.effects.MissingHealthRestore);
        heal(restored, time);
        untargetableUntil = Math.max(
          untargetableUntil,
          time + number(item.effects.StealthDuration, 1),
        );
      } else {
        const percent = kind === "sterak"
          ? number(item.effects.PercentHealthShield)
          : number(item.effects.ShieldHealthPercent) / 100;
        const amount = maxHealth * percent;
        const durationSeconds = kind === "protectors-vow"
          ? Infinity
          : number(item.effects.ShieldDuration, 5);
        grantShield(item, amount, durationSeconds, kind === "sterak" ? amount / durationSeconds : 0, time);
        thresholdShieldsGranted += amount;
        if (kind === "protectors-vow") {
          const granted = Math.max(
            0,
            Math.min(latestDefender.maxMana - defenderMana, number(item.effects.TriggerMana)),
          );
          defenderMana += granted;
          thresholdManaGranted += granted;
        }
      }
    }
  }

  function grantShield(
    item: CatalogItem,
    amount: number,
    durationSeconds: number,
    decayPerSecond: number,
    startTime = 0,
  ): void {
    if (amount <= 0) return;
    timedShields.push({ itemId: item.id, amount, expiry: startTime + durationSeconds, decayPerSecond });
  }

  function updateTimedShields(time: number, delta: number): void {
    for (let index = timedShields.length - 1; index >= 0; index -= 1) {
      const entry = timedShields[index];
      const remove = time >= entry.expiry
        ? entry.amount
        : Math.min(entry.amount, entry.decayPerSecond * delta);
      entry.amount -= remove;
      if (entry.amount <= 1e-9 || time >= entry.expiry) timedShields.splice(index, 1);
    }
  }

  function activateOnDamageDebuffs(time: number): void {
    for (const item of attackerItems) {
      const kind = itemRuleKind(item.id);
      if (kind === "last-whisper") {
        const durationSeconds = item.id.startsWith("TFT5_")
          ? Infinity
          : number(item.effects.ArmorBreakDuration, 3);
        sunderExpiries.set(item.id, time + durationSeconds);
      }
      if (kind === "void-staff") {
        const durationSeconds = item.id.startsWith("TFT5_")
          ? Infinity
          : number(item.effects.MRShredDuration, 5);
        shredExpiries.set(item.id, time + durationSeconds);
      }
    }
  }

  function collectDebuffs(time: number): DefenseDebuffSummary {
    const sources: DefenseDebuffSource[] = [];
    if (input.scenario.externalArmorSunder.enabled) {
      sources.push(source("external:sunder", "External allied Sunder", "sunder", input.scenario.externalArmorSunder.percent, "external", true));
    }
    if (input.scenario.externalMagicShred.enabled) {
      sources.push(source("external:shred", "External allied Shred", "shred", input.scenario.externalMagicShred.percent, "external", true));
    }
    for (const item of attackerItems) {
      const enabled = itemConditionEnabled(input.scenario.attackerItemConditions, item.id);
      const kind = itemRuleKind(item.id);
      if (kind === "evenshroud") {
        sources.push(source(item.id, item.name, "sunder", number(item.effects.ARReductionAmount), "aura", enabled));
      } else if (kind === "ionic-spark") {
        sources.push(source(item.id, item.name, "shred", number(item.effects.MRShred), "aura", enabled));
      } else if (kind === "last-whisper") {
        sources.push(source(
          item.id,
          item.name,
          "sunder",
          number(item.effects.ArmorReductionPercent),
          "on-damage",
          (sunderExpiries.get(item.id) ?? -Infinity) + 1e-9 >= time,
        ));
      } else if (kind === "void-staff") {
        sources.push(source(
          item.id,
          item.name,
          "shred",
          number(item.effects.MRShred),
          "on-damage",
          (shredExpiries.get(item.id) ?? -Infinity) + 1e-9 >= time,
        ));
      }
    }
    const sunder = strongest(sources, "sunder");
    const shred = strongest(sources, "shred");
    return {
      armorSunderPercent: sunder,
      magicShredPercent: shred,
      baseArmor: latestDefender?.armor ?? initialDefenderStats.armor,
      baseMagicResist: latestDefender?.magicResist ?? initialDefenderStats.magicResist,
      effectiveArmor: (latestDefender?.armor ?? initialDefenderStats.armor) * (1 - sunder / 100),
      effectiveMagicResist: (latestDefender?.magicResist ?? initialDefenderStats.magicResist) * (1 - shred / 100),
      sources,
    };
  }

  function applyOnHitBurn(time: number): void {
    for (const item of attackerItems) {
      const kind = itemRuleKind(item.id);
      if (kind !== "burn-on-hit" && kind !== "red-buff") continue;
      setBurn(
        item,
        time,
        number(item.effects.BurnDuration ?? item.effects.Duration, 5),
        number(item.effects.GrievousWoundsPercent ?? item.effects.HealingReductionPct, 33),
      );
    }
  }

  function applySunfire(time: number): void {
    for (const item of attackerItems) {
      if (itemRuleKind(item.id) !== "sunfire") continue;
      if (!itemConditionEnabled(input.scenario.attackerItemConditions, item.id)) continue;
      const interval = number(item.effects.ICD, 2);
      if (time - lastSunfireProc + 1e-9 < interval) continue;
      lastSunfireProc = time;
      setBurn(
        item,
        time,
        number(item.effects.BurnDuration, 10),
        number(item.effects.GrievousWoundsPercent, 33),
      );
    }
  }

  function applyBurnTicks(time: number): void {
    removeExpiredBurns(time);
    while (nextBurnTick !== null && time + 1e-9 >= nextBurnTick && health > 0) {
      const tickAt = nextBurnTick;
      const active = [...burns.values()].filter((status) => status.expires + 1e-9 >= tickAt);
      if (active.length === 0) {
        nextBurnTick = null;
        break;
      }
      const burnPercent = Math.max(...active.map((status) => status.percent));
      const damage = maxHealth * burnPercent / 100;
      applyPacket(
        { sourceId: "item:burn", sourceName: "Burn", damageType: "true", rawDamage: damage },
        false,
        { ...latestAttacker, damageAmp: 0 },
        latestDefender,
        latestDebuffs,
        tickAt,
      );
      nextBurnTick = tickAt + 1;
    }
  }

  function setBurn(
    item: CatalogItem,
    time: number,
    durationSeconds: number,
    woundPercent: number,
  ): void {
    removeExpiredBurns(time);
    if (burns.size === 0 || nextBurnTick === null) nextBurnTick = time + 1;
    burns.set(item.id, {
      percent: number(item.effects.BurnPercent),
      woundPercent,
      expires: time + durationSeconds,
    });
  }

  function removeExpiredBurns(time: number): void {
    for (const [id, status] of burns) {
      if (status.expires + 1e-9 < time) burns.delete(id);
    }
    if (burns.size === 0) nextBurnTick = null;
  }

  function applyDefenderHealing(time: number, stats: FinalCombatStats): void {
    for (const item of defenderItems) {
      const kind = itemRuleKind(item.id);
      if (kind === "dragon-claw") {
        const interval = number(item.effects.HealthRegenInterval, 2);
        if (time - (lastDragonHeal.get(item.slotKey) ?? 0) + 1e-9 >= interval) {
          lastDragonHeal.set(item.slotKey, time);
          heal(maxHealth * number(item.effects.PercentHealthDamage) / 100, time);
        }
      } else if (kind === "spirit-visage") {
        const interval = number(item.effects.HealTickRate, 1);
        if (time - (lastSpiritHeal.get(item.slotKey) ?? 0) + 1e-9 >= interval) {
          lastSpiritHeal.set(item.slotKey, time);
          heal((stats.hp - health) * number(item.effects.MissingHealthHeal), time);
        }
      }
    }
  }

  function heal(amount: number, time: number): void {
    removeExpiredBurns(time);
    const wound = Math.max(
      0,
      ...[...burns.values()].map((status) => status.woundPercent / 100),
    );
    const actual = Math.min(maxHealth - health, finiteNonNegative(amount) * (1 - wound));
    health += actual;
    healing += actual;
  }

  function recordDueCheckpoints(time: number, force = false): void {
    while (output.length < checkpoints.length) {
      const checkpoint = checkpoints[output.length];
      if (!force && checkpoint > time + 1e-9) break;
      const debuffs = collectDebuffs(checkpoint);
      output.push({
        timeSeconds: checkpoint,
        cumulativeDamage: totals.damage,
        cumulativeHealthDamage: totals.health,
        averageDps: checkpoint <= 0 ? 0 : totals.damage / checkpoint,
        physicalDamage: totals.physical,
        magicDamage: totals.magic,
        trueDamage: totals.true,
        attacks,
        casts,
        defenderHealth: health,
        defenderShield: totalShield(),
        effectiveArmor: debuffs.effectiveArmor,
        effectiveMagicResist: debuffs.effectiveMagicResist,
        attackerAttackDamage: latestAttacker.attackDamage,
        attackerAbilityPower: latestAttacker.abilityPower,
        attackerAttackSpeed: latestAttacker.attackSpeed,
        defenderDurability: latestDefender.durability,
        defenderAttackDamageReduction: latestDefender.attackDamageReduction,
      });
    }
  }

  function totalShield(): number {
    return manualShieldRemaining + timedShields.reduce((sum, entry) => sum + entry.amount, 0);
  }

  function consumeShield(damage: number): number {
    let remaining = finiteNonNegative(damage);
    let absorbed = 0;
    for (let index = 0; index < timedShields.length && remaining > 0; index += 1) {
      const entry = timedShields[index];
      const amount = Math.min(entry.amount, remaining);
      entry.amount -= amount;
      remaining -= amount;
      absorbed += amount;
    }
    for (let index = timedShields.length - 1; index >= 0; index -= 1) {
      if (timedShields[index].amount <= 1e-9) timedShields.splice(index, 1);
    }
    const manualAmount = Math.min(manualShieldRemaining, remaining);
    manualShieldRemaining -= manualAmount;
    return absorbed + manualAmount;
  }
}

function precisionPacket(
  packet: AbilityDamagePacket,
  stats: FinalCombatStats,
  items: CatalogItem[],
  mode: DamageCalculationInput["scenario"]["critMode"],
): AbilityDamagePacket {
  const count = items.filter((item) => itemRuleKind(item.id) === "precision").length;
  if (count === 0) return packet;
  const crit = calculateCritDamage(
    packet.rawDamage,
    stats.critChance,
    stats.critMultiplier + Math.max(0, count - 1) * 0.1,
    mode,
  );
  return { ...packet, rawDamage: crit.damage };
}

function attackManaGain(
  champion: CatalogChampion,
  stats: FinalCombatStats,
  items: CatalogItem[],
  rules: PatchRules,
  critMode: DamageCalculationInput["scenario"]["critMode"],
): number {
  const role = normalizeRole(champion.role, rules);
  const base = role ? rules.roleMana[role].manaPerAttack ?? 0 : 0;
  let itemBonus = 0;
  for (const item of items) {
    const kind = itemRuleKind(item.id);
    if (kind === "shojin") itemBonus += number(item.effects.FlatManaRestore);
    if (kind === "nashor") {
      itemBonus += number(item.effects.BaseManaOnHit) +
        (number(item.effects.ManaOnCrit) - number(item.effects.BaseManaOnHit)) *
          critWeight(critMode, stats.critChance);
    }
  }
  return (base + itemBonus) * stats.manaGainMultiplier;
}

function critWeight(
  mode: DamageCalculationInput["scenario"]["critMode"],
  critChance: number,
): number {
  if (mode === "force-crit") return 1;
  if (mode === "force-no-crit") return 0;
  return clamp(critChance, 0, 1);
}

function passiveManaPerSecond(
  champion: CatalogChampion,
  stats: FinalCombatStats,
  rules: PatchRules,
): number {
  const role = normalizeRole(champion.role, rules);
  const rolePassive = role ? rules.roleMana[role].passiveManaPerSecond : 0;
  return (rolePassive + stats.manaRegen) * stats.manaGainMultiplier;
}

function readItems(itemIds: readonly (string | null)[], catalog: CalculatorCatalog): EquippedItem[] {
  return itemIds.flatMap((id, slot) => {
    if (!id) return [];
    const item = catalog.items.find((candidate) => candidate.id === id);
    return item ? [{ ...item, slotKey: `${slot}:${item.id}` }] : [];
  });
}

function normalizeCheckpoints(values: readonly number[], duration: number): number[] {
  const normalized = values
    .filter(Number.isFinite)
    .map((value) => clamp(value, 0, duration));
  normalized.push(duration);
  return [...new Set(normalized)].sort((a, b) => a - b);
}

function source(
  sourceId: string,
  sourceName: string,
  kind: DefenseDebuffSource["kind"],
  percent: number,
  timing: DefenseDebuffSource["timing"],
  active: boolean,
): DefenseDebuffSource {
  return { sourceId, sourceName, kind, percent: clamp(percent, 0, 100), timing, active };
}

function strongest(sources: DefenseDebuffSource[], kind: DefenseDebuffSource["kind"]): number {
  return Math.max(0, ...sources.filter((entry) => entry.kind === kind && entry.active).map((entry) => entry.percent));
}

function dedupeIssues(issues: UnsupportedIssue[]): UnsupportedIssue[] {
  return [...new Map(issues.map((issue) => [`${issue.scope}:${issue.sourceId}:${issue.message}`, issue])).values()];
}

function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function roundStep(value: number): number {
  return Math.round(value * 100) / 100;
}
