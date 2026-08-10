import assert from "node:assert/strict";
import test from "node:test";
import type { TftSet } from "@/data/types";
import { calculateDamage } from "./engine";
import type { DamageCalculationInput, HeroLoadout } from "./model";

test("snapshot calculates expected basic attack, authored cast, resistance, and shield ledger", () => {
  const result = calculateDamage(input(), catalog());
  assert.equal(result.status, "complete");
  assert.equal(result.basicAttack?.crit, "expected");
  approximately(result.basicAttack?.rawDamage ?? 0, 55);
  approximately(result.totals.physical, 55 * (2 / 3));
  approximately(result.totals.magic, 100 * (2 / 3));
  approximately(result.totals.absorbed, 20);
  approximately(result.totals.health, 55 * (2 / 3) - 20 + 100 * (2 / 3));
  assert.equal(result.ability.length, 1);
  assert.equal(result.ability[0].sourceId, "TFT17_Lissandra");
});

test("star scaling keeps HP and attack-damage multipliers separate", () => {
  const result = calculateDamage(
    input({ attacker: { ...loadout("TFT17_Lissandra"), starLevel: 2 } }),
    catalog(),
  );
  assert.equal(result.finalStats.attacker?.hp, 900);
  assert.equal(result.finalStats.attacker?.attackDamage, 75);
});

test("item AS percentage points and ManaRegen feed final stats and cast estimate", () => {
  const result = calculateDamage(
    input({
      attacker: {
        ...loadout("TFT17_Lissandra"),
        itemIds: ["TFT_Item_TestMana", null, null],
      },
    }),
    catalog(),
  );
  approximately(result.finalStats.attacker?.attackSpeed ?? 0, 0.9);
  assert.equal(result.finalStats.attacker?.manaRegen, 2);
  assert.equal(result.manaEstimate?.passiveManaPerSecond, 4);
});

test("duplicate unique items are reported and applied only once", () => {
  const result = calculateDamage(
    input({
      attacker: {
        ...loadout("TFT17_Lissandra"),
        itemIds: ["TFT_Item_TestUnique", "TFT_Item_TestUnique", null],
      },
    }),
    catalog(),
  );
  assert.equal(result.status, "partial");
  assert.equal(result.finalStats.attacker?.attackDamage, 75);
  assert.equal(
    result.modifiers.filter((modifier) => modifier.sourceId === "TFT_Item_TestUnique").length,
    1,
  );
  assert.match(result.unsupported.map((issue) => issue.message).join(" "), /unique.*duplicate/i);
});

test("Twisted Fate handler uses the expected structured damage midpoint", () => {
  const result = calculateDamage(
    input({ attacker: loadout("TFT17_TwistedFate") }),
    catalog(),
  );
  assert.equal(result.status, "complete");
  assert.equal(result.ability[0].rawDamage, 150);
  assert.match(result.assumptions.join(" "), /expected midpoint/i);
});

test("Briar physical handler combines final AD and AP coefficients and reports excluded bonus", () => {
  const result = calculateDamage(input({ attacker: loadout("TFT17_Briar") }), catalog());
  assert.equal(result.status, "partial");
  assert.equal(result.ability[0].damageType, "physical");
  assert.equal(result.ability[0].rawDamage, 90);
  assert.match(result.unsupported.map((issue) => issue.message).join(" "), /Tank bonus/i);
});

test("Ezreal physical handler combines AD and AP coefficients and excludes drones", () => {
  const result = calculateDamage(input({ attacker: loadout("TFT17_Ezreal") }), catalog());
  assert.equal(result.status, "partial");
  assert.equal(result.ability[0].damageType, "physical");
  assert.equal(result.ability[0].rawDamage, 99);
  assert.match(result.unsupported.map((issue) => issue.message).join(" "), /drone damage/i);
});

test("Karma and Viktor use their explicit primary-target formulas", () => {
  const karma = calculateDamage(input({ attacker: loadout("TFT17_Karma") }), catalog());
  assert.equal(karma.ability[0].rawDamage, 150);
  assert.match(karma.assumptions.join(" "), /NumEnemies/i);

  const viktor = calculateDamage(input({ attacker: loadout("TFT17_Viktor") }), catalog());
  assert.equal(viktor.ability[0].rawDamage, 40);
  assert.match(viktor.assumptions.join(" "), /Duration/i);
});

test("authored primary-only handlers surface excluded secondary effects", () => {
  const result = calculateDamage(input({ attacker: loadout("TFT17_Veigar") }), catalog());
  assert.equal(result.ability[0].rawDamage, 100);
  assert.equal(result.status, "partial");
  assert.match(result.unsupported.map((issue) => issue.message).join(" "), /Meep mini/i);
});

test("champions without an authored cast remain useful but explicitly partial", () => {
  const result = calculateDamage(input({ attacker: loadout("TFT17_Unknown") }), catalog());
  assert.equal(result.status, "partial");
  assert.ok(result.basicAttack);
  assert.equal(result.ability.length, 0);
  assert.match(result.unsupported[0]?.message ?? "", /no authored ability handler/i);
});

test("missing selections return an incomplete uniform result", () => {
  const result = calculateDamage(
    input({ attacker: loadout(null), defender: loadout(null) }),
    catalog(),
  );
  assert.equal(result.status, "incomplete");
  assert.deepEqual(result.missing, ["attacker", "defender"]);
  assert.equal(result.basicAttack, null);
});

test("tank mana estimate warns that damage-taken mana is excluded", () => {
  const data = catalog() as unknown as {
    champions: Array<{ id: string; role: string }>;
  };
  const defender = data.champions.find((champion) => champion.id === "TFT17_Defender");
  if (defender) defender.role = "APTank";
  const result = calculateDamage(input({ attacker: loadout("TFT17_Defender") }), data as unknown as TftSet);
  assert.equal(result.manaEstimate?.supported, true);
  assert.match(result.manaEstimate?.warning ?? "", /damage-taken mana is excluded/i);
  assert.match(result.warnings.join(" "), /damage-taken mana is excluded/i);
});

function input(overrides: Partial<DamageCalculationInput> = {}): DamageCalculationInput {
  return {
    attacker: loadout("TFT17_Lissandra"),
    defender: loadout("TFT17_Defender"),
    buffs: [],
    scenario: {
      critMode: "expected",
      combatDurationSeconds: 20,
      timeCheckpoints: [0, 5, 10, 15, 20],
      defenderShield: 20,
      enemiesTargetingAttacker: 1,
      enemiesTargetingDefender: 1,
      incomingHitsPerSecond: 1,
      attackerItemConditions: {},
      defenderItemConditions: {},
      externalArmorSunder: { enabled: false, percent: 30 },
      externalMagicShred: { enabled: false, percent: 30 },
    },
    ...overrides,
  };
}

function loadout(championId: string | null): HeroLoadout {
  return { championId, starLevel: 1, itemIds: [null, null, null] };
}

function catalog(): TftSet {
  const champion = (
    id: string,
    abilityVariables: Array<{ name: string; values: [number, number, number] }>,
    options: { role?: string; attackDamage?: number } = {},
  ) => ({
    id,
    name: id.replace("TFT17_", ""),
    cost: 1,
    traits: ["Test"],
    iconUrl: "https://example.invalid/champion.png",
    role: options.role ?? "APCaster",
    stats: {
      health: 500,
      attackDamage: options.attackDamage ?? 50,
      armor: 30,
      magicResist: 30,
      attackSpeed: 0.75,
      range: 4,
      startingMana: 0,
      maxMana: 40,
      critChance: 0.25,
      critMultiplier: 1.4,
    },
    ability: {
      name: "Test cast",
      description: "Not parsed.",
      iconUrl: "https://example.invalid/ability.png",
      variables: abilityVariables.map((variable) => ({
        name: variable.name,
        rawValues: [0, ...variable.values, 0, 0, 0],
        starValues: variable.values,
      })),
    },
  });

  return {
    schemaVersion: 1,
    provenance: {
      source: "CommunityDragon",
      sourceUrl: "https://example.invalid/tft.json",
      patch: "17.8",
      sourcePatch: "16.15",
      locale: "en_us",
      setMutator: "TFTSet17",
      fetchedAt: "2026-08-10T00:00:00.000Z",
      sourceHash: "test",
    },
    setNumber: 17,
    setName: "Test Set 17",
    champions: [
      champion("TFT17_Lissandra", [{ name: "Damage", values: [100, 200, 300] }]),
      champion("TFT17_TwistedFate", [
        { name: "DamageMin", values: [100, 200, 300] },
        { name: "DamageMax", values: [200, 300, 400] },
      ]),
      champion("TFT17_Briar", [
        { name: "ADDamage", values: [100, 150, 200] },
        { name: "APDamage", values: [40, 60, 80] },
      ], { role: "ADFighter" }),
      champion("TFT17_Ezreal", [
        { name: "ADDamage", values: [170, 255, 380] },
        { name: "APDamage", values: [14, 21, 32] },
      ], { role: "ADCarry" }),
      champion("TFT17_Karma", [
        { name: "Damage", values: [300, 400, 500] },
        { name: "NumEnemies", values: [2, 2, 2] },
        { name: "SecondaryDamage", values: [50, 75, 100] },
      ]),
      champion("TFT17_Viktor", [
        { name: "Damage", values: [10, 20, 30] },
        { name: "Duration", values: [4, 4, 4] },
      ]),
      champion("TFT17_Veigar", [{ name: "Damage", values: [100, 200, 300] }]),
      champion("TFT17_Unknown", []),
      {
        ...champion("TFT17_Defender", []),
        stats: {
          health: 1000,
          attackDamage: 40,
          armor: 50,
          magicResist: 50,
          attackSpeed: 0.6,
          range: 1,
          startingMana: 0,
          maxMana: 100,
          critChance: 0.25,
          critMultiplier: 1.4,
        },
      },
    ],
    traits: [],
    items: [
      {
        id: "TFT_Item_TestMana",
        name: "Test Mana Item",
        description: "Not parsed.",
        iconUrl: "https://example.invalid/item.png",
        unique: false,
        category: "full",
        composition: [],
        effects: { AS: 20, ManaRegen: 2 },
      },
      {
        id: "TFT_Item_TestUnique",
        name: "Test Unique Item",
        description: "Not parsed.",
        iconUrl: "https://example.invalid/item.png",
        unique: true,
        category: "standard",
        composition: [],
        effects: { AD: 0.5 },
      },
    ],
  } as unknown as TftSet;
}

function approximately(actual: number, expected: number, epsilon = 1e-9): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be close to ${expected}`);
}
