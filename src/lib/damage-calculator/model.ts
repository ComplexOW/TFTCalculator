export type CalculatorTarget = "tank" | "damage";
export type StarLevel = 1 | 2 | 3;
export type CritMode = "expected" | "force-crit" | "force-no-crit";

export type ItemConditionState = {
  /** Disables only the conditional/triggered part of an item, never its base stats. */
  enabled: boolean;
  /** Rule-specific manual stack count. Omit to derive stacks from the timeline. */
  stacks?: number;
};

export type DefenseDebuffInput = {
  enabled: boolean;
  /** Percentage points, e.g. 30 means 30% Sunder/Shred. */
  percent: number;
};

export type HeroLoadout = {
  championId: string | null;
  starLevel: StarLevel;
  itemIds: [string | null, string | null, string | null];
};

export type ManualTraitBuff = {
  traitId: string;
  target: CalculatorTarget;
  tierMin: number;
};

export type DamageCalculatorState = {
  tank: HeroLoadout;
  damage: HeroLoadout;
  traitBuffs: ManualTraitBuff[];
  scenario: DamageScenario;
};

export type DamageScenario = {
  critMode: CritMode;
  combatDurationSeconds: number;
  timeCheckpoints: number[];
  attackerStartingMana?: number;
  attackerCurrentHealth?: number;
  defenderCurrentHealth?: number;
  defenderShield: number;
  enemiesTargetingAttacker: number;
  enemiesTargetingDefender: number;
  incomingHitsPerSecond: number;
  attackerItemConditions: Record<string, ItemConditionState>;
  defenderItemConditions: Record<string, ItemConditionState>;
  externalArmorSunder: DefenseDebuffInput;
  externalMagicShred: DefenseDebuffInput;
};

export type DamageCalculationInput = Readonly<{
  defender: Readonly<HeroLoadout>;
  attacker: Readonly<HeroLoadout>;
  buffs: readonly Readonly<ManualTraitBuff>[];
  scenario: Readonly<DamageScenario>;
}>;

export type DamageCalculatorAction =
  | { type: "SELECT_CHAMPION"; target: CalculatorTarget; championId: string }
  | { type: "CLEAR_CHAMPION"; target: CalculatorTarget }
  | { type: "EQUIP_ITEM"; target: CalculatorTarget; itemId: string; slot?: number }
  | { type: "REMOVE_ITEM"; target: CalculatorTarget; slot: number }
  | { type: "SET_STAR_LEVEL"; target: CalculatorTarget; starLevel: StarLevel }
  | { type: "SET_CRIT_MODE"; critMode: CritMode }
  | { type: "SET_COMBAT_DURATION"; value: number }
  | { type: "SET_TIME_CHECKPOINTS"; values: number[] }
  | { type: "SET_ATTACKER_STARTING_MANA"; value?: number }
  | { type: "SET_ATTACKER_CURRENT_HEALTH"; value?: number }
  | { type: "SET_DEFENDER_CURRENT_HEALTH"; value?: number }
  | { type: "SET_DEFENDER_SHIELD"; value: number }
  | { type: "SET_ENEMIES_TARGETING"; target: CalculatorTarget; value: number }
  | { type: "SET_INCOMING_HITS_PER_SECOND"; value: number }
  | {
      type: "SET_ITEM_CONDITION";
      target: CalculatorTarget;
      itemId: string;
      state: ItemConditionState;
    }
  | { type: "SET_EXTERNAL_ARMOR_SUNDER"; value: DefenseDebuffInput }
  | { type: "SET_EXTERNAL_MAGIC_SHRED"; value: DefenseDebuffInput }
  | { type: "ADD_TRAIT_BUFF"; buff: ManualTraitBuff }
  | { type: "SET_TRAIT_TIER"; target: CalculatorTarget; traitId: string; tierMin: number }
  | { type: "REMOVE_TRAIT_BUFF"; target: CalculatorTarget; traitId: string }
  | { type: "RESET" };

const EMPTY_ITEMS: HeroLoadout["itemIds"] = [null, null, null];

function emptyLoadout(): HeroLoadout {
  return { championId: null, starLevel: 1, itemIds: [...EMPTY_ITEMS] };
}

export function createInitialCalculatorState(): DamageCalculatorState {
  return {
    tank: emptyLoadout(),
    damage: emptyLoadout(),
    traitBuffs: [],
    scenario: {
      critMode: "expected",
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
    },
  };
}

export function damageCalculatorReducer(
  state: DamageCalculatorState,
  action: DamageCalculatorAction,
): DamageCalculatorState {
  switch (action.type) {
    case "SELECT_CHAMPION":
      return {
        ...state,
        [action.target]: { ...state[action.target], championId: action.championId },
      };
    case "CLEAR_CHAMPION":
      return { ...state, [action.target]: emptyLoadout() };
    case "EQUIP_ITEM": {
      const loadout = state[action.target];
      if (!loadout.championId) return state;
      const requestedSlot = action.slot;
      const slot =
        requestedSlot !== undefined && requestedSlot >= 0 && requestedSlot < 3
          ? requestedSlot
          : loadout.itemIds.findIndex((itemId) => itemId === null);
      if (slot < 0 || loadout.itemIds[slot] !== null) return state;
      const itemIds = [...loadout.itemIds] as HeroLoadout["itemIds"];
      itemIds[slot] = action.itemId;
      return { ...state, [action.target]: { ...loadout, itemIds } };
    }
    case "REMOVE_ITEM": {
      if (action.slot < 0 || action.slot > 2) return state;
      const loadout = state[action.target];
      const itemIds = [...loadout.itemIds] as HeroLoadout["itemIds"];
      itemIds[action.slot] = null;
      return { ...state, [action.target]: { ...loadout, itemIds } };
    }
    case "SET_STAR_LEVEL":
      return {
        ...state,
        [action.target]: { ...state[action.target], starLevel: action.starLevel },
      };
    case "SET_CRIT_MODE":
      return { ...state, scenario: { ...state.scenario, critMode: action.critMode } };
    case "SET_COMBAT_DURATION":
      return (() => {
        const duration = bounded(action.value, 0, 120);
        return {
        ...state,
        scenario: {
          ...state.scenario,
          combatDurationSeconds: duration,
          timeCheckpoints: normalizeCheckpoints(state.scenario.timeCheckpoints, duration),
        },
        };
      })();
    case "SET_TIME_CHECKPOINTS":
      return {
        ...state,
        scenario: {
          ...state.scenario,
          timeCheckpoints: normalizeCheckpoints(
            action.values,
            state.scenario.combatDurationSeconds,
          ),
        },
      };
    case "SET_ATTACKER_STARTING_MANA":
      return {
        ...state,
        scenario: { ...state.scenario, attackerStartingMana: finiteOrUndefined(action.value) },
      };
    case "SET_ATTACKER_CURRENT_HEALTH":
      return {
        ...state,
        scenario: { ...state.scenario, attackerCurrentHealth: finiteOrUndefined(action.value) },
      };
    case "SET_DEFENDER_CURRENT_HEALTH":
      return {
        ...state,
        scenario: { ...state.scenario, defenderCurrentHealth: finiteOrUndefined(action.value) },
      };
    case "SET_DEFENDER_SHIELD":
      return {
        ...state,
        scenario: { ...state.scenario, defenderShield: nonNegative(action.value) },
      };
    case "SET_ENEMIES_TARGETING": {
      const key = action.target === "damage"
        ? "enemiesTargetingAttacker"
        : "enemiesTargetingDefender";
      return {
        ...state,
        scenario: { ...state.scenario, [key]: Math.trunc(bounded(action.value, 0, 20)) },
      };
    }
    case "SET_INCOMING_HITS_PER_SECOND":
      return {
        ...state,
        scenario: { ...state.scenario, incomingHitsPerSecond: bounded(action.value, 0, 20) },
      };
    case "SET_ITEM_CONDITION": {
      const key = action.target === "damage"
        ? "attackerItemConditions"
        : "defenderItemConditions";
      return {
        ...state,
        scenario: {
          ...state.scenario,
          [key]: {
            ...state.scenario[key],
            [action.itemId]: {
              enabled: action.state.enabled,
              ...(action.state.stacks === undefined
                ? {}
                : { stacks: Math.trunc(bounded(action.state.stacks, 0, 100)) }),
            },
          },
        },
      };
    }
    case "SET_EXTERNAL_ARMOR_SUNDER":
      return {
        ...state,
        scenario: { ...state.scenario, externalArmorSunder: normalizeDebuff(action.value) },
      };
    case "SET_EXTERNAL_MAGIC_SHRED":
      return {
        ...state,
        scenario: { ...state.scenario, externalMagicShred: normalizeDebuff(action.value) },
      };
    case "ADD_TRAIT_BUFF": {
      const exists = state.traitBuffs.some(
        (buff) => buff.traitId === action.buff.traitId && buff.target === action.buff.target,
      );
      if (exists) return state;
      return { ...state, traitBuffs: [...state.traitBuffs, action.buff] };
    }
    case "SET_TRAIT_TIER":
      return {
        ...state,
        traitBuffs: state.traitBuffs.map((buff) =>
          buff.traitId === action.traitId && buff.target === action.target
            ? { ...buff, tierMin: action.tierMin }
            : buff,
        ),
      };
    case "REMOVE_TRAIT_BUFF":
      return {
        ...state,
        traitBuffs: state.traitBuffs.filter(
          (buff) => buff.traitId !== action.traitId || buff.target !== action.target,
        ),
      };
    case "RESET":
      return createInitialCalculatorState();
  }
}

/** Stable boundary for the future calculation engine. Keep formulas out of UI components. */
export function createDamageCalculationInput(
  state: DamageCalculatorState,
): DamageCalculationInput {
  return {
    defender: state.tank,
    attacker: state.damage,
    buffs: state.traitBuffs,
    scenario: state.scenario,
  };
}

function finiteOrUndefined(value: number | undefined): number | undefined {
  return value === undefined || !Number.isFinite(value) ? undefined : nonNegative(value);
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function bounded(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function normalizeCheckpoints(values: number[], duration: number): number[] {
  return [...new Set([...values.map((value) => bounded(value, 0, duration)), duration])]
    .sort((a, b) => a - b);
}

function normalizeDebuff(value: DefenseDebuffInput): DefenseDebuffInput {
  return { enabled: value.enabled, percent: bounded(value.percent, 0, 100) };
}
