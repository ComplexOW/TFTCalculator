import { abilityValue, type CatalogChampion } from "../catalog";
import type { StarLevel } from "../model";
import type { DamageType, FinalCombatStats, UnsupportedIssue } from "../types";

export type AbilityDamagePacket = {
  sourceId: string;
  sourceName: string;
  damageType: DamageType;
  rawDamage: number;
};

export type AbilityHandlerResult = {
  packets: AbilityDamagePacket[];
  assumptions: string[];
  unsupported: UnsupportedIssue[];
};

type AbilityContext = {
  champion: CatalogChampion;
  starLevel: StarLevel;
  attacker: FinalCombatStats;
};

type AbilityHandler = (context: AbilityContext) => AbilityHandlerResult;

/**
 * Every entry is keyed by champion API name and names its structured variables explicitly.
 * Do not add a description-text fallback here.
 */
const ABILITY_HANDLERS: Readonly<Record<string, AbilityHandler>> = {
  TFT17_Aatrox: adOnlyPhysicalDamage("DamageAD", "Armor scaling and healing are excluded."),
  TFT17_Caitlyn: adOnlyPhysicalDamage("Damage", "N.O.V.A. headshot effects are excluded."),
  TFT17_Chogath: directDamageFromVariable({
    variableName: "BonusDamage",
    damageType: "magic",
    excludedWarning: "Permanent health gain and kill scaling are excluded.",
  }),
  TFT17_Leona: directDamageFromVariable({
    variableName: "Damage",
    damageType: "magic",
    excludedWarning: "Shield, defense scaling, and stun are excluded.",
  }),
  TFT17_Lissandra: directDamageFromVariable({ variableName: "Damage", damageType: "magic" }),
  TFT17_RekSai: directDamageFromVariable({ variableName: "Damage", damageType: "magic" }),
  TFT17_Veigar: directDamageFromVariable({
    variableName: "Damage",
    damageType: "magic",
    excludedWarning: "Conditional Meep mini damage is excluded.",
  }),
  TFT17_Gragas: directDamageFromVariable({ variableName: "Damage", damageType: "magic" }),
  TFT17_Milio: directDamageFromVariable({
    variableName: "Damage",
    damageType: "magic",
    excludedWarning: "Stochastic bounce damage is excluded; only the primary hit is calculated.",
  }),
  TFT17_Zoe: directDamageFromVariable({
    variableName: "Damage",
    damageType: "magic",
    excludedWarning: "Secondary effects are excluded; only the primary hit is calculated.",
  }),
  TFT17_Lulu: directDamageFromVariable({ variableName: "Damage", damageType: "magic" }),
  TFT17_Nasus: directDamageFromVariable({
    variableName: "DamageAP",
    damageType: "magic",
    hits: 6,
    excludedWarning: "Transformation and bonus-health effects are excluded; six periodic damage ticks are modeled.",
  }),
  TFT17_Poppy: directDamageFromVariable({
    variableName: "MeepShield",
    damageType: "magic",
    scalesWithAbilityPower: false,
    excludedWarning: "Poppy's shield and allied defense aura are excluded.",
  }),
  TFT17_Talon: adApPhysicalDamage({
    adVariable: "ADBleedDamage",
    apVariable: "APBleedDamage",
    assumption: "Talon models the full authored bleed as one physical packet.",
    excludedWarning: "Bleed duration and leap targeting are excluded.",
  }),
  TFT17_Teemo: directDamageFromVariable({
    variableName: "HitDamage",
    damageType: "magic",
    excludedWarning: "Attack poison stacks and the active attack-speed window are excluded.",
  }),
  TFT17_Akali: adApPhysicalDamage({
    adVariable: "DamageAD",
    apVariable: "DamageAP",
    assumption: "Akali models the five kunai as one primary physical packet.",
    hits: 5,
    excludedWarning: "Repositioning, falloff, armor shred, and N.O.V.A. bleed are excluded.",
  }),
  TFT17_Belveth: adApPhysicalDamage({
    adVariable: "ADDamage",
    apVariable: "APDamage",
    assumption: "Bel'Veth models the authored slash damage for twelve slashes.",
    hits: 12,
    excludedWarning: "Bonus-attack-speed slash count changes are excluded.",
  }),
  TFT17_Gnar: adApPhysicalDamage({
    adVariable: "DamageAD",
    apVariable: "DamageAP",
    assumption: "Gnar models the first boomerang hit.",
    excludedWarning: "Boomerang falloff and Meep attacks are excluded.",
  }),
  TFT17_Gwen: directDamageFromVariable({
    variableName: "Damage",
    damageType: "magic",
    excludedWarning: "Cone damage, reset casts, dashes, and Groove state are excluded.",
  }),
  TFT17_Jax: directDamageFromVariable({
    variableName: "ArmorMRScale",
    damageType: "magic",
    excludedWarning: "Defensive stance, shield, damage reduction, and stun are excluded.",
  }),
  TFT17_Jinx: adOnlyPhysicalDamage("ADDamage", "Rocket count and cone targeting are excluded."),
  TFT17_IvernMinion: directDamageFromVariable({
    variableName: "Damage",
    damageType: "magic",
    excludedWarning: "Healing, row-wide impact, and Meep amplification are excluded.",
  }),
  TFT17_Mordekaiser: directDamageFromVariable({
    variableName: "DamagePerProc",
    damageType: "magic",
    hits: 6,
    excludedWarning: "Shielding, adjacent targeting, and healing refund are excluded.",
  }),
  TFT17_MissFortune: directDamageFromVariable({
    variableName: "Tier1Damage",
    damageType: "magic",
    excludedWarning: "Arsenal tier selection and cone channel timing are excluded.",
  }),
  TFT17_Morgana: directDamageFromVariable({
    variableName: "APDamage",
    damageType: "magic",
    excludedWarning: "Health gain, healing, and multi-target effects are excluded.",
  }),
  TFT17_Pantheon: directDamageFromVariable({
    variableName: "TrueDamagePerSecond",
    damageType: "true",
    hits: 4,
    scalesWithAbilityPower: false,
    excludedWarning: "Shield, durability, and cone targeting are excluded.",
  }),
  TFT17_Pyke: directDamageFromVariable({
    variableName: "TargetDamage",
    damageType: "physical",
    scalesWithAbilityPower: false,
    excludedWarning: "Spear, execute, and area damage are excluded; only the primary target is modeled.",
  }),
  TFT17_Aurora: directDamageFromVariable({
    variableName: "Damage",
    damageType: "magic",
    excludedWarning: "Split targets and Hex duration are excluded.",
  }),
  TFT17_Fizz: directDamageFromVariable({
    variableName: "BiteDamageAP",
    damageType: "magic",
    excludedWarning: "Dash, Meep bite, and stun effects are excluded.",
  }),
  TFT17_Illaoi: directDamageFromVariable({
    variableName: "Damage",
    damageType: "magic",
    excludedWarning: "Shield and multi-target health drain are excluded.",
  }),
  TFT17_Kaisa: adApPhysicalDamage({
    adVariable: "ADDamage",
    apVariable: "APDamage",
    assumption: "Kai'Sa models one primary missile hit.",
    excludedWarning: "Missile count, spread, and mana refund are excluded.",
  }),
  TFT17_Maokai: directDamageFromVariable({
    variableName: "Damage",
    damageType: "magic",
    excludedWarning: "Passive healing, stun, and health-damage aura are excluded.",
  }),
  TFT17_Ornn: directDamageFromVariable({
    variableName: "Damage",
    damageType: "magic",
    excludedWarning: "Shield and Groove effects are excluded.",
  }),
  TFT17_Rhaast: directDamageFromVariable({
    variableName: "Damage",
    damageType: "physical",
    scalesWithAbilityPower: false,
    excludedWarning: "Durability, healing, and knock-up are excluded.",
  }),
  TFT17_Samira: adOnlyPhysicalDamage("PassiveAD", "Spin damage, stun, and Groove effects are excluded."),
  TFT17_Urgot: directDamageFromVariable({
    variableName: "ShotgunDamage",
    damageType: "physical",
    scalesWithAbilityPower: false,
    excludedWarning: "Shotgun cooldown, falloff, and shield are excluded.",
  }),
  TFT17_TwistedFate: averageVariableDamage(
    "DamageMin",
    "DamageMax",
    "Twisted Fate uses the expected midpoint of the structured minimum and maximum damage.",
  ),
  TFT17_Karma: karmaPrimaryDamage,
  TFT17_Viktor: viktorCenterDamage,
  TFT17_Briar: briarPhysicalDamage,
  TFT17_Ezreal: adApPhysicalDamage({
    adVariable: "ADDamage",
    apVariable: "APDamage",
    assumption: "Ezreal uses final AD * ADDamage / 100 + APDamage * displayed AP / 100.",
    excludedWarning: "Conditional drone damage is excluded; only the primary hit is calculated.",
  }),
  TFT17_AurelionSol: directDamageFromVariable({
    variableName: "DamagePerSecond",
    damageType: "magic",
    hits: 3,
    excludedWarning: "Beam falloff, magic penetration, and target reduction are excluded.",
  }),
  TFT17_Corki: adApPhysicalDamage({
    adVariable: "MissileAD",
    apVariable: "MissileAP",
    assumption: "Corki models one authored missile.",
    excludedWarning: "Attack-triggered missile volleys, procs, and Meep cooldowns are excluded.",
  }),
  TFT17_Kindred: adApPhysicalDamage({
    adVariable: "ADDamage",
    apVariable: "APDamage",
    assumption: "Kindred models one primary target's authored damage.",
    excludedWarning: "Marks, spell damage, target count, and Nova repeats are excluded.",
  }),
  TFT17_Leblanc: directDamageFromVariable({
    variableName: "BoltDamage",
    damageType: "magic",
    hits: 5,
    excludedWarning: "Clone creation and attack-count state are excluded.",
  }),
  TFT17_MasterYi: adApPhysicalDamage({
    adVariable: "DamageAD",
    apVariable: "DamageAP",
    assumption: "Master Yi models one authored strike.",
    excludedWarning: "Passive damage, omnivamp, attack speed, and duration are excluded.",
  }),
  TFT17_Nami: directDamageFromVariable({
    variableName: "Damage",
    damageType: "magic",
    excludedWarning: "Projectile count, bounces, and Groove effects are excluded.",
  }),
  TFT17_Nunu: directDamageFromVariable({
    variableName: "InitialDamage",
    damageType: "magic",
    excludedWarning: "Shield, stun, and follow-up damage are excluded.",
  }),
  TFT17_Rammus: directDamageFromVariable({
    variableName: "DamageAP",
    damageType: "magic",
    excludedWarning: "Armor scaling, shield, and passive triggers are excluded.",
  }),
  TFT17_Riven: directDamageFromVariable({
    variableName: "WaveDamage",
    damageType: "magic",
    excludedWarning: "Dash, shield, passive strikes, and repeated casts are excluded.",
  }),
  TFT17_TahmKench: directDamageFromVariable({
    variableName: "DamageAP",
    damageType: "magic",
    excludedWarning: "Health scaling, healing, and threshold shield are excluded.",
  }),
  TFT17_Galio: directDamageFromVariable({
    variableName: "Heal",
    damageType: "magic",
    excludedWarning: "Durability aura and healing target selection are excluded.",
  }),
  TFT17_Xayah: adApPhysicalDamage({
    adVariable: "ADDamage",
    apVariable: "APDamage",
    assumption: "Xayah models one primary feather hit.",
    excludedWarning: "Attack volleys, feather recall, and target falloff are excluded.",
  }),
  TFT17_Bard: directDamageFromVariable({
    variableName: "DamagePerSecond",
    damageType: "magic",
    hits: 4,
    excludedWarning: "Split damage, abduction, and tank amplification are excluded.",
  }),
  TFT17_Blitzcrank: directDamageFromVariable({
    variableName: "UppercutDamage",
    damageType: "magic",
    excludedWarning: "Bolt cooldown, explosion, and Groove effects are excluded.",
  }),
  TFT17_Fiora: directDamageFromVariable({
    variableName: "VitalDamage",
    damageType: "true",
    scalesWithAbilityPower: false,
    hits: 2,
    excludedWarning: "Vital targeting and aura healing are excluded.",
  }),
  TFT17_Graves: adApPhysicalDamage({
    adVariable: "Damage",
    apVariable: "SecondaryDamageAP",
    assumption: "Graves models the primary shotgun damage.",
    excludedWarning: "Projectile spread and secondary cone damage are excluded.",
  }),
  TFT17_Jhin: adApPhysicalDamage({
    adVariable: "ADDamage",
    apVariable: "APDamage",
    assumption: "Jhin models one authored attack shot.",
    excludedWarning: "Fixed attack speed conversion, shot count, and final-shot amplification are excluded.",
  }),
  TFT17_Shen: directDamageFromVariable({
    variableName: "BonusDamageOnAttack",
    damageType: "physical",
    scalesWithAbilityPower: false,
    excludedWarning: "Shield, attack-speed, slow, and health-scaling effects are excluded.",
  }),
  TFT17_Sona: directDamageFromVariable({
    variableName: "SlamDamage",
    damageType: "magic",
    excludedWarning: "Debris, repeated casts, and stun are excluded.",
  }),
  TFT17_Vex: directDamageFromVariable({
    variableName: "ShadowHandMagicDamage",
    damageType: "magic",
    excludedWarning: "Strike count and passive shadow hands are excluded.",
  }),
  TFT17_Zed: directDamageFromVariable({
    variableName: "HPPenalty",
    damageType: "physical",
    scalesWithAbilityPower: false,
    excludedWarning: "Clone transformation and mana-cost changes are excluded.",
  }),
};

export function calculateAuthoredAbility(context: AbilityContext): AbilityHandlerResult {
  const handler = ABILITY_HANDLERS[context.champion.id];
  if (!handler) {
    return {
      packets: [],
      assumptions: [],
      unsupported: [
        {
          scope: "ability",
          sourceId: context.champion.id,
          message: `${context.champion.name} has no authored ability handler.`,
        },
      ],
    };
  }
  return handler(context);
}

export function directDamageFromVariable(config: {
  variableName: string;
  damageType: DamageType;
  scalesWithAbilityPower?: boolean;
  hits?: number;
  excludedWarning?: string;
}): AbilityHandler {
  return (context) => {
    const value = abilityValue(context.champion, config.variableName, context.starLevel);
    if (value === null) {
      return {
        packets: [],
        assumptions: [],
        unsupported: [
          {
            scope: "ability",
            sourceId: context.champion.id,
            message: `${context.champion.name} is missing ability variable '${config.variableName}'.`,
          },
        ],
      };
    }
    const apMultiplier = config.scalesWithAbilityPower === false
      ? 1
      : context.attacker.abilityPower / 100;
    const rawDamage = Math.max(0, value * apMultiplier);
    const hits = Math.max(1, Math.trunc(config.hits ?? 1));
    return {
      packets: Array.from({ length: hits }, () => ({
        sourceId: context.champion.id,
        sourceName: context.champion.ability?.name ?? "Ability",
        damageType: config.damageType,
        rawDamage,
      })),
      assumptions: config.scalesWithAbilityPower === false
        ? []
        : ["The authored ability's structured base-damage variable scales by displayed AP / 100."],
      unsupported: config.excludedWarning
        ? [{ scope: "ability", sourceId: context.champion.id, message: config.excludedWarning }]
        : [],
    };
  };
}

function adOnlyPhysicalDamage(variableName: string, excludedWarning: string): AbilityHandler {
  return (context) => {
    const value = abilityValue(context.champion, variableName, context.starLevel);
    if (value === null) {
      return {
        packets: [],
        assumptions: [],
        unsupported: [{
          scope: "ability",
          sourceId: context.champion.id,
          message: `${context.champion.name} is missing ability variable '${variableName}'.`,
        }],
      };
    }
    return {
      packets: [{
        sourceId: context.champion.id,
        sourceName: context.champion.ability?.name ?? "Ability",
        damageType: "physical",
        rawDamage: context.attacker.attackDamage * (value / 100),
      }],
      assumptions: ["The authored AD coefficient scales by final attack damage."],
      unsupported: [{ scope: "ability", sourceId: context.champion.id, message: excludedWarning }],
    };
  };
}

function averageVariableDamage(
  minimumName: string,
  maximumName: string,
  assumption: string,
): AbilityHandler {
  return (context) => {
    const values = requiredValues(context, [minimumName, maximumName]);
    if ("unsupported" in values) return values.unsupported;
    return magicPacket(context, (values.values[0] + values.values[1]) / 2, [assumption]);
  };
}

function karmaPrimaryDamage(context: AbilityContext): AbilityHandlerResult {
  const values = requiredValues(context, ["Damage", "NumEnemies", "SecondaryDamage"]);
  if ("unsupported" in values) return values.unsupported;
  const [damage, numEnemies, secondaryDamage] = values.values;
  const divisor = Math.max(1, numEnemies + 1);
  return magicPacket(context, damage / divisor + secondaryDamage, [
    "Karma calculates one primary target share as Damage / (NumEnemies + 1) + SecondaryDamage.",
  ]);
}

function viktorCenterDamage(context: AbilityContext): AbilityHandlerResult {
  const values = requiredValues(context, ["Damage", "Duration"]);
  if ("unsupported" in values) return values.unsupported;
  return magicPacket(context, values.values[0] * values.values[1], [
    "Viktor calculates the authored center target as Damage multiplied by Duration.",
  ]);
}

function briarPhysicalDamage(context: AbilityContext): AbilityHandlerResult {
  return adApPhysicalDamage({
    adVariable: "ADDamage",
    apVariable: "APDamage",
    assumption: "Briar uses final AD * ADDamage / 100 + APDamage * displayed AP / 100.",
    excludedWarning: "Briar's conditional Tank bonus is excluded.",
  })(context);
}

function adApPhysicalDamage(config: {
  adVariable: string;
  apVariable: string;
  assumption: string;
  hits?: number;
  excludedWarning?: string;
}): AbilityHandler {
  return (context) => {
    const values = requiredValues(context, [config.adVariable, config.apVariable]);
    if ("unsupported" in values) return values.unsupported;
    const [adDamage, apDamage] = values.values;
    return {
      packets: Array.from({ length: Math.max(1, Math.trunc(config.hits ?? 1)) }, () => ({
          sourceId: context.champion.id,
          sourceName: context.champion.ability?.name ?? "Ability",
          damageType: "physical",
          rawDamage:
            context.attacker.attackDamage * (adDamage / 100) +
            apDamage * (context.attacker.abilityPower / 100),
        })),
      assumptions: [config.assumption],
      unsupported: config.excludedWarning
        ? [{ scope: "ability", sourceId: context.champion.id, message: config.excludedWarning }]
        : [],
    };
  };
}

function magicPacket(
  context: AbilityContext,
  structuredBaseDamage: number,
  assumptions: string[],
): AbilityHandlerResult {
  return {
    packets: [
      {
        sourceId: context.champion.id,
        sourceName: context.champion.ability?.name ?? "Ability",
        damageType: "magic",
        rawDamage: Math.max(0, structuredBaseDamage * (context.attacker.abilityPower / 100)),
      },
    ],
    assumptions: [
      ...assumptions,
      "The authored structured ability amount scales by displayed AP / 100.",
    ],
    unsupported: [],
  };
}

function requiredValues(
  context: AbilityContext,
  names: string[],
):
  | { values: number[] }
  | { unsupported: AbilityHandlerResult } {
  const values = names.map((name) => abilityValue(context.champion, name, context.starLevel));
  const missingIndex = values.findIndex((value) => value === null);
  if (missingIndex >= 0) {
    return {
      unsupported: {
        packets: [],
        assumptions: [],
        unsupported: [
          {
            scope: "ability",
            sourceId: context.champion.id,
            message: `${context.champion.name} is missing ability variable '${names[missingIndex]}'.`,
          },
        ],
      },
    };
  }
  return { values: values as number[] };
}
