import assert from "node:assert/strict";
import test from "node:test";
import {
  createDamageCalculationInput,
  createInitialCalculatorState,
  damageCalculatorReducer,
} from "./model";

test("calculator model exposes deterministic star and scenario actions", () => {
  let state = createInitialCalculatorState();
  state = damageCalculatorReducer(state, {
    type: "SET_STAR_LEVEL",
    target: "damage",
    starLevel: 3,
  });
  state = damageCalculatorReducer(state, { type: "SET_CRIT_MODE", critMode: "force-crit" });
  state = damageCalculatorReducer(state, { type: "SET_ATTACKER_STARTING_MANA", value: 25 });
  state = damageCalculatorReducer(state, { type: "SET_DEFENDER_CURRENT_HEALTH", value: 600 });
  state = damageCalculatorReducer(state, { type: "SET_DEFENDER_SHIELD", value: -10 });
  state = damageCalculatorReducer(state, { type: "SET_COMBAT_DURATION", value: 10 });
  state = damageCalculatorReducer(state, {
    type: "SET_ITEM_CONDITION",
    target: "damage",
    itemId: "TFT_Item_TitansResolve",
    state: { enabled: true, stacks: 12 },
  });
  state = damageCalculatorReducer(state, {
    type: "SET_EXTERNAL_ARMOR_SUNDER",
    value: { enabled: true, percent: 140 },
  });

  const input = createDamageCalculationInput(state);
  assert.equal(input.attacker.starLevel, 3);
  assert.deepEqual(input.scenario, {
    critMode: "force-crit",
    combatDurationSeconds: 10,
    timeCheckpoints: [0, 5, 10],
    attackerStartingMana: 25,
    defenderCurrentHealth: 600,
    defenderShield: 0,
    enemiesTargetingAttacker: 1,
    enemiesTargetingDefender: 1,
    incomingHitsPerSecond: 1,
    attackerItemConditions: {
      TFT_Item_TitansResolve: { enabled: true, stacks: 12 },
    },
    defenderItemConditions: {},
    externalArmorSunder: { enabled: true, percent: 100 },
    externalMagicShred: { enabled: false, percent: 30 },
  });
});
