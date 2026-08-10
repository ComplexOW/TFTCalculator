import assert from "node:assert/strict";
import test from "node:test";
import { calculateCritDamage } from "./crit";
import { resistanceMultiplier } from "./resistance";
import { applyDamageToPool } from "./shields";

test("resistance multiplier handles positive, zero, and negative resistance", () => {
  approximately(resistanceMultiplier(50), 2 / 3);
  assert.equal(resistanceMultiplier(0), 1);
  approximately(resistanceMultiplier(-50), 4 / 3);
});

test("expected crit uses probability-weighted damage", () => {
  const result = calculateCritDamage(100, 0.25, 1.4, "expected");
  assert.equal(result.state, "expected");
  approximately(result.damage, 110);
  assert.equal(calculateCritDamage(100, 0.25, 1.4, "force-crit").damage, 140);
  assert.equal(calculateCritDamage(100, 0.25, 1.4, "force-no-crit").damage, 100);
});

test("shields absorb post-mitigation damage before health", () => {
  assert.deepEqual(applyDamageToPool({ shield: 30, health: 100 }, 50), {
    shield: 0,
    health: 80,
    absorbedDamage: 30,
    healthDamage: 20,
    overkillDamage: 0,
  });
});

function approximately(actual: number, expected: number, epsilon = 1e-9): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be close to ${expected}`);
}
