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
  excludedWarning?: string;
}): AbilityHandler {
  return (context) => {
    const values = requiredValues(context, [config.adVariable, config.apVariable]);
    if ("unsupported" in values) return values.unsupported;
    const [adDamage, apDamage] = values.values;
    return {
      packets: [
        {
          sourceId: context.champion.id,
          sourceName: context.champion.ability?.name ?? "Ability",
          damageType: "physical",
          rawDamage:
            context.attacker.attackDamage * (adDamage / 100) +
            apDamage * (context.attacker.abilityPower / 100),
        },
      ],
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
