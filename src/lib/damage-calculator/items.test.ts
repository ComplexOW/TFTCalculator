import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { CalculatorCatalog, CatalogChampion, CatalogItem } from "./catalog";
import { simulateCombat } from "./combat-simulation";
import { estimateFirstCast } from "./mana";
import { getItemConditionDefinitions, itemRuleKind } from "./item-rules";
import type { DamageCalculationInput, DamageScenario, HeroLoadout } from "./model";
import { getPatchRules } from "./patch-rules";
import { buildFinalStats } from "./stats";

const rules = getPatchRules(17, "17.8");

test("Adaptive Helm uses normalized role families and its separate Mana multiplier", () => {
  const adaptive = item("TFT_Item_AdaptiveHelm", {
    MagicResist: 20,
    ManaRegen: 3,
    ManaPercIncrease: 0.15,
    FrontlineResists: 30,
    BacklineADAP: 10,
  });
  const caster = stats([adaptive], { role: "APCaster" });
  approximately(caster.attackDamage, 55);
  approximately(caster.abilityPower, 110);
  approximately(caster.manaGainMultiplier, 1.15);

  const tank = stats([adaptive], { role: "HTank" });
  assert.equal(tank.armor, 60);
  assert.equal(tank.magicResist, 80);

  const radiant = item("TFT5_Item_AdaptiveHelmRadiant", {
    MagicResist: 40,
    ManaPercIncrease: 0.3,
    FrontlineResists: 80,
    BacklineADAP: 40,
  });
  const assassin = stats([radiant], { role: "APAssassin" });
  assert.equal(assassin.attackDamage, 50);
  assert.equal(assassin.abilityPower, 100);
  const marksman = stats([radiant], { role: "ADCarry" });
  assert.equal(marksman.attackDamage, 70);
  assert.equal(marksman.abilityPower, 140);
});

test("Blue Buff multiplies total AD/AP and Omnivamp combines across different items", () => {
  const blue = item("TFT_Item_BlueBuff", { AD: 0.15, AP: 15, ModifiedADAP: 0.1 });
  const bloodthirster = item("TFT_Item_Bloodthirster", { StatOmnivamp: 0.2 });
  const gunblade = item("TFT_Item_HextechGunblade", { Omnivamp: 18, StatOmnivamp: 0.15 });
  const result = stats([blue, bloodthirster, gunblade]);
  approximately(result.attackDamage, 63.25);
  approximately(result.abilityPower, 126.5);
  approximately(result.omnivamp, 0.38);
});

test("max-Health bucket precedes Hand of Justice Health-ratio choice", () => {
  const warmog = item("TFT_Item_WarmogsArmor", { Health: 500, BonusPercentHP: 0.18 });
  const hand = item("TFT_Item_UnstableConcoction", {
    AD_NotStatBar: 0.15,
    AP_NotStatBar: 15,
    HealthThreshold: 0.5,
    StatOmnivamp_NotStatBar: 0.12,
  });
  const result = stats([warmog, hand], { currentHealth: 800 });
  assert.equal(result.hp, 1770);
  approximately(result.attackDamage, 57.5);
  assert.equal(result.abilityPower, 115);
  approximately(result.omnivamp, 0.24);
});

test("Archangel and Guinsoo expose their exact time-scaled checkpoint stats", () => {
  const archangel = item("TFT_Item_ArchangelsStaff", {
    AP: 30,
    APPerInterval: 20,
    IntervalSeconds: 5,
  });
  const guinsoo = item("TFT_Item_GuinsoosRageblade", {
    AP: 10,
    AS: 10,
    AttackSpeedPerStack: 7,
  });
  const result = stats([archangel, guinsoo], { timeSeconds: 10 });
  assert.equal(result.abilityPower, 180);
  approximately(result.attackSpeed, 1.35);
});

test("dynamic Radiant Attack Speed is capped by the selected patch rules", () => {
  const guinsoo = item("TFT5_Item_GuinsoosRagebladeRadiant", {
    AS: 25,
    AttackSpeedPerStack: 16,
  });
  const quicksilver = item("TFT5_Item_QuicksilverRadiant", {
    AS: 40,
    ProcAttackSpeed: 0.06,
  });
  const red = item("TFT5_Item_RapidFirecannonRadiant", { AS: 80 });
  const result = stats([guinsoo, quicksilver, red], { timeSeconds: 20 });
  assert.equal(result.attackSpeed, 5);
});

test("strongest Sunder is used and Last Whisper begins after the first damage event", () => {
  const whisper = item("TFT_Item_LastWhisper", {
    ArmorReductionPercent: 30,
    ArmorBreakDuration: 3,
  });
  const result = simulate([whisper], [], {
    duration: 2,
    checkpoints: [0, 1, 2],
    defenderArmor: 100,
    attackerAttackDamage: 100,
    attackerAttackSpeed: 1,
  });
  approximately(result.checkpoints[1].physicalDamage, 50);
  approximately(result.checkpoints[2].physicalDamage, 50 + 100 / 1.7);
  assert.equal(result.checkpoints[2].effectiveArmor, 70);

  const external = simulate([whisper], [], {
    duration: 1,
    checkpoints: [1],
    defenderArmor: 100,
    attackerAttackDamage: 100,
    attackerAttackSpeed: 1,
    scenario: { externalArmorSunder: { enabled: true, percent: 40 } },
  });
  assert.equal(external.checkpoints[0].effectiveArmor, 60);
  approximately(external.checkpoints[0].physicalDamage, 62.5);
});

test("standard on-damage Sunder expires without a refresh", () => {
  const whisper = item("TFT_Item_LastWhisper", {
    ArmorReductionPercent: 30,
    ArmorBreakDuration: 3,
  });
  const result = simulate([whisper], [], {
    duration: 9,
    checkpoints: [5, 9],
    defenderArmor: 100,
    attackerAttackDamage: 100,
    attackerAttackSpeed: 0.2,
  });
  assert.equal(result.checkpoints[0].effectiveArmor, 70);
  assert.equal(result.checkpoints[1].effectiveArmor, 100);
});

test("aura Shred is active before the first spell and Precision crits abilities", () => {
  const ionic = item("TFT_Item_IonicSpark", { MRShred: 30 });
  const ie = item("TFT_Item_InfinityEdge", {});
  const jg = item("TFT_Item_JeweledGauntlet", {});
  const result = simulate([ionic, ie, jg], [], {
    duration: 0,
    checkpoints: [0],
    attackerMaxMana: 40,
    attackerStartingMana: 40,
    attackerAttackSpeed: 0,
    defenderMagicResist: 100,
    scenario: { critMode: "expected" },
  });
  // Two Precision items: expected spell crit is 100 * (75% + 25% * 1.5) = 112.5.
  approximately(result.checkpoints[0].magicDamage, 112.5 / 1.7);
  assert.equal(result.checkpoints[0].effectiveMagicResist, 70);
  assert.equal(result.checkpoints[0].casts, 1);
});

test("threshold shields activate at combat start and layered expiry preserves manual shields", () => {
  const sterak = item("TFT_Item_SteraksGage", {
    HealthThreshold: 60,
    PercentHealthShield: 0.4,
    ShieldDuration: 4,
  });
  const initial = simulate([], [sterak], {
    duration: 0,
    checkpoints: [0],
    defenderCurrentHealth: 500,
  });
  assert.equal(initial.tankStats.thresholdShieldsGranted, 400);
  assert.equal(initial.checkpoints[0].defenderShield, 400);

  const crown = item("TFT_Item_Crownguard", {
    ShieldSize: 25,
    ShieldDuration: 1.5,
  });
  const layered = simulate([], [crown], {
    duration: 1.5,
    checkpoints: [0, 1, 1.5],
    defenderShield: 100,
    attackerAttackDamage: 250,
    attackerAttackSpeed: 1,
  });
  assert.equal(layered.tankStats.startingShield, 350);
  assert.equal(layered.checkpoints[1].defenderShield, 100);
  assert.equal(layered.checkpoints[2].defenderShield, 100);
});

test("duplicate lifelines and regeneration use slot identity instead of collapsing by item ID", () => {
  const sterak = item("TFT_Item_SteraksGage", {
    HealthThreshold: 60,
    PercentHealthShield: 0.4,
    ShieldDuration: 4,
  });
  const shields = simulate([], [sterak, sterak], {
    duration: 0,
    checkpoints: [0],
    defenderCurrentHealth: 500,
  });
  assert.equal(shields.tankStats.thresholdShieldsGranted, 800);

  const claw = item("TFT_Item_DragonsClaw", {
    HealthRegenInterval: 2,
    PercentHealthDamage: 2.5,
  });
  const heals = simulate([], [claw, claw], {
    duration: 2,
    checkpoints: [2],
    attackerAttackDamage: 100,
    attackerAttackSpeed: 1,
  });
  assert.equal(heals.tankStats.healing, 50);
});

test("Protector's Vow reports threshold Mana and Edge of Night blocks a t=0 cast", () => {
  const vow = item("TFT_Item_FrozenHeart", {
    CombatStartMana: 20,
    HealthThreshold: 40,
    TriggerMana: 15,
    ShieldHealthPercent: 20,
    ShieldDuration: 60,
  });
  const mana = simulate([], [vow], {
    duration: 0,
    checkpoints: [0],
    defenderCurrentHealth: 300,
  });
  assert.equal(mana.tankStats.startingMana, 20);
  assert.equal(mana.tankStats.endingMana, 35);
  assert.equal(mana.tankStats.thresholdManaGranted, 15);

  const edge = item("TFT_Item_GuardianAngel", {
    HealthThreshold: 60,
    MissingHealthRestore: 0.2,
    StealthDuration: 1,
  });
  const blocked = simulate([], [edge], {
    duration: 0,
    checkpoints: [0],
    attackerMaxMana: 40,
    attackerStartingMana: 40,
    defenderCurrentHealth: 500,
  });
  assert.equal(blocked.checkpoints[0].casts, 0);
  assert.equal(blocked.checkpoints[0].cumulativeDamage, 0);
});

test("Burn starts one second after application and Wound reduces periodic healing", () => {
  const morello = item("TFT_Item_Morellonomicon", {
    BurnPercent: 1,
    BurnDuration: 10,
    GrievousWoundsPercent: 33,
  });
  const claw = item("TFT_Item_DragonsClaw", {
    HealthRegenInterval: 2,
    PercentHealthDamage: 2.5,
  });
  const result = simulate([morello], [claw], {
    duration: 2,
    checkpoints: [1.5, 2],
    attackerAttackDamage: 100,
    attackerAttackSpeed: 1,
  });
  assert.equal(result.checkpoints[0].trueDamage, 0);
  assert.equal(result.checkpoints[1].trueDamage, 10);
  approximately(result.tankStats.healing, 25 * 0.67);
});

test("Adaptive and Shojin feed the standalone first-cast estimate consistently", () => {
  const adaptive = item("TFT_Item_AdaptiveHelm", {
    ManaPercIncrease: 0.15,
    FrontlineResists: 30,
    BacklineADAP: 10,
  });
  const shojin = item("TFT_Item_SpearOfShojin", { FlatManaRestore: 5 });
  const final = stats([adaptive, shojin], { role: "APCaster" });
  const estimate = estimateFirstCast({
    stats: final,
    rawRole: "APCaster",
    rules,
    bonusManaPerAttack: 5,
    manaGainMultiplier: final.manaGainMultiplier,
  });
  approximately(estimate.manaPerAttack ?? 0, 13.8);
});

test("condition descriptors are limited to mechanics relevant to each holder", () => {
  const ids = [
    "TFT_Item_SpectralGauntlet",
    "TFT_Item_Bloodthirster",
    "TFT_Item_TitansResolve",
  ];
  assert.deepEqual(
    getItemConditionDefinitions(ids, "damage").map((entry) => entry.itemId),
    ["TFT_Item_SpectralGauntlet", "TFT_Item_TitansResolve"],
  );
  assert.deepEqual(
    getItemConditionDefinitions(ids, "tank").map((entry) => entry.itemId),
    ["TFT_Item_Bloodthirster", "TFT_Item_TitansResolve"],
  );
});

test("every generated Full/Radiant item has an explicit rule classification", () => {
  const data = JSON.parse(
    readFileSync(new URL("../../data/tft-set.fallback.json", import.meta.url), "utf8"),
  ) as { items: Array<{ id: string }> };
  const missing = data.items.filter((entry) => itemRuleKind(entry.id) === "unsupported");
  assert.deepEqual(missing, []);
  assert.equal(data.items.length, 75);
});

function stats(
  items: CatalogItem[],
  options: {
    role?: string;
    timeSeconds?: number;
    currentHealth?: number;
  } = {},
) {
  const unit = champion("TFT17_Lissandra", options.role ?? "APCaster");
  const catalog = catalogWith(unit, champion("TFT17_Defender", "HTank"), items);
  const result = buildFinalStats({
    champion: unit,
    starLevel: 1,
    itemIds: items.map((entry) => entry.id),
    traitBuffs: [],
    catalog,
    rules,
    itemContext: {
      holder: "attacker",
      scenario: scenario(),
      timeSeconds: options.timeSeconds ?? 0,
      attackCount: 0,
      currentHealth: options.currentHealth,
    },
  });
  assert.ok(result);
  return result.stats;
}

function simulate(
  attackerItems: CatalogItem[],
  defenderItems: CatalogItem[],
  options: {
    duration: number;
    checkpoints: number[];
    attackerAttackDamage?: number;
    attackerAttackSpeed?: number;
    attackerMaxMana?: number;
    attackerStartingMana?: number;
    defenderArmor?: number;
    defenderMagicResist?: number;
    defenderCurrentHealth?: number;
    defenderShield?: number;
    scenario?: Partial<DamageScenario>;
  },
) {
  const attacker = champion("TFT17_Lissandra", "APCaster", {
    attackDamage: options.attackerAttackDamage ?? 50,
    attackSpeed: options.attackerAttackSpeed ?? 0.75,
    maxMana: options.attackerMaxMana ?? 999,
    startingMana: options.attackerStartingMana ?? 0,
  });
  const defender = champion("TFT17_Defender", "HTank", {
    armor: options.defenderArmor ?? 0,
    magicResist: options.defenderMagicResist ?? 0,
    maxMana: 999,
  });
  const catalog = catalogWith(attacker, defender, [...attackerItems, ...defenderItems]);
  const input: DamageCalculationInput = {
    attacker: loadout(attacker.id, attackerItems),
    defender: loadout(defender.id, defenderItems),
    buffs: [],
    scenario: scenario({
      combatDurationSeconds: options.duration,
      timeCheckpoints: options.checkpoints,
      attackerStartingMana: options.attackerStartingMana,
      defenderCurrentHealth: options.defenderCurrentHealth,
      defenderShield: options.defenderShield ?? 0,
      ...options.scenario,
    }),
  };
  return simulateCombat({ input, catalog, attacker, defender, rules });
}

function scenario(overrides: Partial<DamageScenario> = {}): DamageScenario {
  return {
    critMode: "force-no-crit",
    combatDurationSeconds: 20,
    timeCheckpoints: [0, 5, 10, 15, 20],
    defenderShield: 0,
    enemiesTargetingAttacker: 1,
    enemiesTargetingDefender: 1,
    incomingHitsPerSecond: 1,
    attackerItemConditions: {},
    defenderItemConditions: {},
    externalArmorSunder: { enabled: false, percent: 30 },
    externalMagicShred: { enabled: false, percent: 30 },
    ...overrides,
  };
}

function champion(
  id: string,
  role: string,
  overrides: Partial<NonNullable<CatalogChampion["stats"]>> = {},
): CatalogChampion {
  return {
    id,
    name: id,
    role,
    stats: {
      health: 1000,
      attackDamage: 50,
      armor: 30,
      magicResist: 30,
      attackSpeed: 0.75,
      range: 4,
      startingMana: 0,
      maxMana: 999,
      critChance: 0.25,
      critMultiplier: 1.4,
      ...overrides,
    },
    ability: id === "TFT17_Lissandra"
      ? {
          name: "Test spell",
          variables: [{ name: "Damage", rawValues: [0, 100, 200, 300], starValues: [100, 200, 300] }],
        }
      : null,
  };
}

function item(id: string, effects: Record<string, unknown>): CatalogItem {
  return { id, name: id, unique: false, effects };
}

function catalogWith(
  attacker: CatalogChampion,
  defender: CatalogChampion,
  items: CatalogItem[],
): CalculatorCatalog {
  return { setNumber: 17, patch: "17.8", champions: [attacker, defender], traits: [], items };
}

function loadout(championId: string, items: CatalogItem[]): HeroLoadout {
  const ids = items.map((entry) => entry.id).slice(0, 3);
  return {
    championId,
    starLevel: 1,
    itemIds: [ids[0] ?? null, ids[1] ?? null, ids[2] ?? null],
  };
}

function approximately(actual: number, expected: number, epsilon = 1e-6): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be close to ${expected}`);
}
