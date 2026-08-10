import assert from "node:assert/strict";
import test from "node:test";
import { groupConsecutiveDamageEvents } from "./event-groups";
import type { DamageEventResult } from "./types";

function event(overrides: Partial<DamageEventResult> = {}): DamageEventResult {
  return {
    id: "event-1",
    category: "ability",
    sourceId: "TFT17_Corki_Ability",
    sourceName: "Corki - Missile Barrage",
    damageType: "physical",
    rawDamage: 10,
    crit: "no",
    effectiveResistance: 20,
    resistanceMultiplier: 0.8,
    mitigatedDamage: 8,
    absorbedDamage: 3,
    healthDamage: 5,
    ...overrides,
  };
}

test("groups a Corki-like run of 21 ability hits", () => {
  const events = Array.from({ length: 21 }, (_, index) => event({ id: `corki-${index + 1}` }));

  const groups = groupConsecutiveDamageEvents(events);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].events.length, 21);
  assert.deepEqual(groups[0].events.map(({ id }) => id), events.map(({ id }) => id));
});

test("keeps singleton events as singleton groups", () => {
  const singleton = event({ id: "single" });

  assert.deepEqual(groupConsecutiveDamageEvents([singleton]), [{
    events: [singleton],
    aggregate: { rawDamage: 10, mitigatedDamage: 8, absorbedDamage: 3, healthDamage: 5 },
  }]);
});

test("does not merge non-consecutive abilities or abilities with a different type", () => {
  const events = [
    event({ id: "physical-1" }),
    event({ id: "item", category: "item" }),
    event({ id: "physical-2" }),
    event({ id: "magic", damageType: "magic" }),
  ];

  const groups = groupConsecutiveDamageEvents(events);

  assert.deepEqual(groups.map((group) => group.events.map(({ id }) => id)), [
    ["physical-1"],
    ["item"],
    ["physical-2"],
    ["magic"],
  ]);
});

test("sums ledger values while preserving the original event order and values", () => {
  const events = [
    event({ id: "hit-1", rawDamage: 2, mitigatedDamage: 1.5, absorbedDamage: 0.5, healthDamage: 1 }),
    event({ id: "hit-2", rawDamage: 4, mitigatedDamage: 3, absorbedDamage: 1, healthDamage: 2 }),
    event({ id: "hit-3", rawDamage: 8, mitigatedDamage: 6, absorbedDamage: 2, healthDamage: 4 }),
  ];

  const [group] = groupConsecutiveDamageEvents(events);

  assert.deepEqual(group.aggregate, {
    rawDamage: 14,
    mitigatedDamage: 10.5,
    absorbedDamage: 3.5,
    healthDamage: 7,
  });
  assert.deepEqual(group.events, events);
});
