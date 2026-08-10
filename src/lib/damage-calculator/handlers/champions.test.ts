import assert from "node:assert/strict";
import test from "node:test";
import fallbackData from "@/data/tft-set.fallback.json";
import type { TftSet } from "@/data/types";
import { readCalculatorCatalog } from "../catalog";
import { calculateAuthoredAbility } from "./champions";

test("every Set 17 catalog unit has an authored primary ability packet", () => {
  const catalog = readCalculatorCatalog(fallbackData as unknown as TftSet);
  const attacker = {
    hp: 1000,
    attackDamage: 100,
    abilityPower: 100,
    attackSpeed: 1,
    armor: 50,
    magicResist: 50,
    critChance: 0,
    critMultiplier: 1.4,
    initialMana: 0,
    maxMana: 100,
    manaRegen: 10,
    range: 4,
    damageAmp: 0,
    durability: 0,
    attackDamageReduction: 0,
    omnivamp: 0,
    manaGainMultiplier: 1,
  };

  for (const champion of catalog.champions) {
    const result = calculateAuthoredAbility({ champion, starLevel: 1, attacker });
    assert.ok(result.packets.length > 0, `${champion.id} returned no primary packet`);
  }
});

test("Corki models all 21 authored missiles", () => {
  const catalog = readCalculatorCatalog(fallbackData as unknown as TftSet);
  const corki = catalog.champions.find((champion) => champion.id === "TFT17_Corki");
  assert.ok(corki);

  const result = calculateAuthoredAbility({
    champion: corki,
    starLevel: 1,
    attacker: {
      hp: 1000,
      attackDamage: 100,
      abilityPower: 100,
      attackSpeed: 1,
      armor: 50,
      magicResist: 50,
      critChance: 0,
      critMultiplier: 1.4,
      initialMana: 0,
      maxMana: 100,
      manaRegen: 10,
      range: 4,
      damageAmp: 0,
      durability: 0,
      attackDamageReduction: 0,
      omnivamp: 0,
      manaGainMultiplier: 1,
    },
  });

  assert.equal(result.packets.length, 21);
  assert.equal(result.packets[0]?.rawDamage, 33);
});
