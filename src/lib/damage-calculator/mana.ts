import { normalizeRole, type PatchRules } from "./patch-rules";
import type { FinalCombatStats, ManaEstimate, ManaTimelineEvent } from "./types";

const MAX_TIMELINE_SECONDS = 180;
const EPSILON = 1e-9;

export function estimateFirstCast(args: {
  stats: FinalCombatStats;
  rawRole: string | null;
  startingMana?: number;
  rules: PatchRules;
  bonusManaPerAttack?: number;
  manaGainMultiplier?: number;
}): ManaEstimate {
  const role = normalizeRole(args.rawRole, args.rules);
  const startingMana = clamp(
    args.startingMana ?? args.stats.initialMana,
    0,
    args.stats.maxMana,
  );
  const common = {
    normalizedRole: role,
    startingMana,
    maxMana: args.stats.maxMana,
  };
  if (args.stats.maxMana <= 0) {
    return unsupported(common, "This champion has no positive maximum mana.");
  }
  if (!role) {
    return unsupported(common, `Role '${args.rawRole ?? "unknown"}' has no validated mana mapping.`);
  }
  const manaRule = args.rules.roleMana[role];
  if (manaRule.manaPerAttack === null) {
    return unsupported(common, `${role} uses champion-specific mana rules.`);
  }
  const multiplier = Math.max(0, args.manaGainMultiplier ?? args.stats.manaGainMultiplier);
  const manaPerAttack = (manaRule.manaPerAttack + (args.bonusManaPerAttack ?? 0)) * multiplier;
  const estimateWarning = role === "tank"
    ? "Tank estimate includes attack and item passive mana only; damage-taken mana is excluded."
    : undefined;
  if (startingMana >= args.stats.maxMana) {
    return {
      supported: true,
      ...common,
      manaPerAttack,
      passiveManaPerSecond: (manaRule.passiveManaPerSecond + args.stats.manaRegen) * multiplier,
      attacksUntilCast: 0,
      secondsUntilCast: 0,
      events: [event(0, "cast", startingMana, startingMana, 0)],
      warning: estimateWarning,
    };
  }
  const passiveManaPerSecond = (manaRule.passiveManaPerSecond + args.stats.manaRegen) * multiplier;
  if (args.stats.attackSpeed <= 0 && passiveManaPerSecond <= 0) {
    return unsupported(common, "Neither attacks nor a passive can generate mana.");
  }

  const events: ManaTimelineEvent[] = [];
  const attackInterval = args.stats.attackSpeed > 0 ? 1 / args.stats.attackSpeed : Infinity;
  let nextAttack = attackInterval;
  let nextPassive = passiveManaPerSecond > 0 ? 1 : Infinity;
  let mana = startingMana;
  let attacks = 0;

  while (Math.min(nextAttack, nextPassive) <= MAX_TIMELINE_SECONDS) {
    const time = Math.min(nextAttack, nextPassive);
    // Passive ticks resolve before attacks at the same timestamp for deterministic estimates.
    if (Math.abs(nextPassive - time) <= EPSILON) {
      const before = mana;
      mana = Math.min(args.stats.maxMana, mana + passiveManaPerSecond);
      events.push(event(time, "passive", before, mana, mana - before));
      nextPassive += 1;
      if (mana >= args.stats.maxMana) {
        return completed(
          common,
          { manaPerAttack, passiveManaPerSecond },
          attacks,
          time,
          events,
          estimateWarning,
        );
      }
    }
    if (Math.abs(nextAttack - time) <= EPSILON) {
      const before = mana;
      mana = Math.min(args.stats.maxMana, mana + manaPerAttack);
      attacks += 1;
      events.push(event(time, "attack", before, mana, mana - before));
      nextAttack += attackInterval;
      if (mana >= args.stats.maxMana) {
        return completed(
          common,
          { manaPerAttack, passiveManaPerSecond },
          attacks,
          time,
          events,
          estimateWarning,
        );
      }
    }
  }

  return {
    supported: false,
    ...common,
    manaPerAttack,
    passiveManaPerSecond,
    attacksUntilCast: null,
    secondsUntilCast: null,
    events,
    warning: `No cast was reached within ${MAX_TIMELINE_SECONDS} seconds.`,
  };
}

function completed(
  common: Pick<ManaEstimate, "normalizedRole" | "startingMana" | "maxMana">,
  rule: { manaPerAttack: number; passiveManaPerSecond: number },
  attacks: number,
  time: number,
  events: ManaTimelineEvent[],
  warning?: string,
): ManaEstimate {
  const mana = events.at(-1)?.manaAfter ?? common.startingMana;
  return {
    supported: true,
    ...common,
    manaPerAttack: rule.manaPerAttack,
    passiveManaPerSecond: rule.passiveManaPerSecond,
    attacksUntilCast: attacks,
    secondsUntilCast: time,
    events: [...events, event(time, "cast", mana, mana, 0)],
    warning,
  };
}

function unsupported(
  common: Pick<ManaEstimate, "normalizedRole" | "startingMana" | "maxMana">,
  warning: string,
): ManaEstimate {
  return {
    supported: false,
    ...common,
    manaPerAttack: null,
    passiveManaPerSecond: 0,
    attacksUntilCast: null,
    secondsUntilCast: null,
    events: [],
    warning,
  };
}

function event(
  timeSeconds: number,
  kind: ManaTimelineEvent["kind"],
  manaBefore: number,
  manaAfter: number,
  manaGained: number,
): ManaTimelineEvent {
  return { timeSeconds, kind, manaBefore, manaAfter, manaGained };
}

function clamp(value: number, min: number, max: number): number {
  const finite = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, finite));
}
