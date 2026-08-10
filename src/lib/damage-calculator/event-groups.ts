import type { DamageEventResult } from "./types";

export type DamageEventAggregate = Pick<
  DamageEventResult,
  "rawDamage" | "mitigatedDamage" | "absorbedDamage" | "healthDamage"
>;

export type DamageEventGroup = {
  events: DamageEventResult[];
  aggregate: DamageEventAggregate;
};

function canGroupAbilityEvents(previous: DamageEventResult, current: DamageEventResult): boolean {
  return previous.category === "ability"
    && current.category === "ability"
    && previous.sourceId === current.sourceId
    && previous.sourceName === current.sourceName
    && previous.damageType === current.damageType
    && previous.crit === current.crit;
}

function aggregateEvents(events: DamageEventResult[]): DamageEventAggregate {
  return events.reduce<DamageEventAggregate>(
    (total, event) => ({
      rawDamage: total.rawDamage + event.rawDamage,
      mitigatedDamage: total.mitigatedDamage + event.mitigatedDamage,
      absorbedDamage: total.absorbedDamage + event.absorbedDamage,
      healthDamage: total.healthDamage + event.healthDamage,
    }),
    { rawDamage: 0, mitigatedDamage: 0, absorbedDamage: 0, healthDamage: 0 },
  );
}

/**
 * Combines only adjacent ability packets with the same conservative display identity.
 * The original events remain ordered and unchanged for the expanded breakdown.
 */
export function groupConsecutiveDamageEvents(events: DamageEventResult[]): DamageEventGroup[] {
  const groups: DamageEventResult[][] = [];

  for (const event of events) {
    const currentGroup = groups.at(-1);
    const previousEvent = currentGroup?.at(-1);

    if (currentGroup && previousEvent && canGroupAbilityEvents(previousEvent, event)) {
      currentGroup.push(event);
    } else {
      groups.push([event]);
    }
  }

  return groups.map((groupedEvents) => ({
    events: groupedEvents,
    aggregate: aggregateEvents(groupedEvents),
  }));
}
