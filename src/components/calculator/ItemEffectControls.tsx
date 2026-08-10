"use client";

import { Activity, Clock3, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Item, TftSet } from "@/data/types";
import { getItemConditionDefinitions, itemRuleKind } from "@/lib/damage-calculator/item-rules";
import type {
  CalculatorTarget,
  DamageCalculatorAction,
  DamageScenario,
  HeroLoadout,
  ItemConditionState,
} from "@/lib/damage-calculator/model";
import { cn } from "@/lib/utils";

type ItemEffectControlsProps = {
  data: TftSet;
  attacker: HeroLoadout;
  defender: HeroLoadout;
  scenario: DamageScenario;
  dispatch: (action: DamageCalculatorAction) => void;
};

function numberValue(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function Toggle({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked ? "border-rose-400/60 bg-rose-500/70" : "border-border bg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[17px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function itemName(items: Item[], itemId: string) {
  return items.find((item) => item.id === itemId)?.name ?? itemId;
}

const AUTO_EFFECT_COPY: Partial<Record<ReturnType<typeof itemRuleKind>, string>> = {
  adaptive: "Mode is derived from the holder's normalized class.",
  archangel: "Ability Power increases automatically every 5 seconds.",
  "blue-buff": "Additional AD and AP gained from all sources is amplified automatically.",
  crownguard: "Shield-active and post-expiry states follow combat time.",
  "dragon-claw": "Periodic healing is resolved automatically over combat time.",
  gargoyle: "Defenses use the enemies-targeting count above.",
  guinsoo: "Attack Speed stacks automatically each second.",
  "hand-of-justice": "Damage and healing mode follows the holder's current Health.",
  kraken: "Attack stacks are derived from the combat timeline.",
  nashor: "Mana gain per attack is applied automatically, with the critical-hit bonus included.",
  quicksilver: "Timed Attack Speed and immunity use combat time.",
  "spirit-visage": "Periodic healing is resolved automatically over combat time.",
  steadfast: "Damage reduction follows the holder's current Health.",
};

function CheckpointInput({ values, onCommit }: { values: number[]; onCommit: (values: number[]) => void }) {
  const commit = (draft: string) => {
    const parsed = draft
      .split(",")
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isFinite(entry) && entry >= 0);
    onCommit(parsed);
  };

  return (
    <Input
      defaultValue={values.join(", ")}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(event.currentTarget.value);
          event.currentTarget.blur();
        }
      }}
      aria-label="DPS checkpoints in seconds, comma separated"
      className="mt-2 font-mono text-foreground"
    />
  );
}

function ConditionGroup({
  title,
  target,
  loadout,
  items,
  scenario,
  dispatch,
}: {
  title: string;
  target: CalculatorTarget;
  loadout: HeroLoadout;
  items: Item[];
  scenario: DamageScenario;
  dispatch: (action: DamageCalculatorAction) => void;
}) {
  const itemIds = loadout.itemIds.filter((itemId): itemId is string => Boolean(itemId));
  const definitions = getItemConditionDefinitions(itemIds, target);
  const automaticItems = itemIds.flatMap((itemId) => {
    const description = AUTO_EFFECT_COPY[itemRuleKind(itemId)];
    return description ? [{ itemId, description }] : [];
  });
  const conditions = target === "damage"
    ? scenario.attackerItemConditions
    : scenario.defenderItemConditions;

  if (definitions.length === 0 && automaticItems.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-background/30 px-3 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">No equipped items need scenario controls.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <Badge variant="outline" className="font-mono text-[9px]">{definitions.length + automaticItems.length}</Badge>
      </div>
      <div className="grid gap-2">
        {definitions.map((definition, index) => {
          const condition: ItemConditionState = conditions[definition.itemId] ?? { enabled: true };
          const setCondition = (next: ItemConditionState) => dispatch({
            type: "SET_ITEM_CONDITION",
            target,
            itemId: definition.itemId,
            state: next,
          });

          return (
            <div key={`${definition.itemId}-${definition.label}-${index}`} className="rounded-md border border-border bg-background/55 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{itemName(items, definition.itemId)}</p>
                  <p className="mt-0.5 text-[11px] text-foreground/80">{definition.label}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{definition.description}</p>
                </div>
                {definition.hasToggle ? (
                  <Toggle
                    checked={condition.enabled}
                    onCheckedChange={(enabled) => setCondition({ ...condition, enabled })}
                    label={`${condition.enabled ? "Disable" : "Enable"} ${definition.label}`}
                  />
                ) : (
                  <Badge variant="secondary" className="shrink-0 text-[9px]">Auto</Badge>
                )}
              </div>
              {definition.stackLabel && (
                <label className="mt-3 flex items-center justify-between gap-3 text-[10px] font-medium text-muted-foreground">
                  {definition.stackLabel}
                  <Input
                    type="number"
                    min={definition.minStacks ?? 0}
                    max={definition.maxStacks}
                    value={condition.stacks ?? ""}
                    placeholder="Auto"
                    onChange={(event) => setCondition({
                      ...condition,
                      stacks: event.target.value === "" ? undefined : numberValue(event.target.value),
                    })}
                    className="h-8 w-24 font-mono text-foreground"
                  />
                </label>
              )}
            </div>
          );
        })}
        {automaticItems.map(({ itemId, description }, index) => (
          <div key={`auto-${itemId}-${index}`} className="flex items-start gap-3 rounded-md border border-sky-500/20 bg-sky-500/[0.04] p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{itemName(items, itemId)}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{description}</p>
            </div>
            <Badge variant="secondary" className="shrink-0 text-[9px]">Auto</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ItemEffectControls({ data, attacker, defender, scenario, dispatch }: ItemEffectControlsProps) {
  return (
    <Card className="border border-border bg-card/80">
      <CardHeader className="flex-row items-start gap-3 border-b border-border/70">
        <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-background/70 text-amber-300">
          <Sparkles className="size-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold">Item effect board</h2>
          <p className="text-xs text-muted-foreground">Automatic role and health checks stay automatic; switches only override conditional effects.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.1fr]">
          <label className="rounded-md border border-border bg-background/50 p-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-2"><Clock3 className="size-3.5 text-sky-300" aria-hidden /> Combat duration</span>
            <div className="relative mt-2">
              <Input
                type="number"
                min={1}
                max={120}
                value={scenario.combatDurationSeconds}
                onChange={(event) => dispatch({ type: "SET_COMBAT_DURATION", value: numberValue(event.target.value, 15) })}
                className="font-mono text-foreground"
              />
              <span className="pointer-events-none absolute right-3 top-2 text-[10px] normal-case tracking-normal">sec</span>
            </div>
            <span className="mt-1 block normal-case tracking-normal">Drives stacking and timed item effects.</span>
          </label>

          <label className="rounded-md border border-border bg-background/50 p-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-2"><Activity className="size-3.5 text-sky-300" aria-hidden /> DPS checkpoints</span>
            <CheckpointInput
              key={scenario.timeCheckpoints.join("-")}
              values={scenario.timeCheckpoints}
              onCommit={(values) => dispatch({ type: "SET_TIME_CHECKPOINTS", values })}
            />
            <span className="mt-1 block normal-case tracking-normal">Comma-separated seconds, such as 5, 10, 15, 20.</span>
          </label>

          <div className="rounded-md border border-border bg-background/50 p-3">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><ShieldAlert className="size-3.5 text-amber-300" aria-hidden /> Incoming pressure</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {([
                ["On DPS", scenario.enemiesTargetingAttacker, "damage"],
                ["On tank", scenario.enemiesTargetingDefender, "tank"],
              ] as const).map(([label, value, target]) => (
                <label key={target} className="text-[9px] text-muted-foreground">
                  {label}
                  <Input type="number" min={0} value={value} onChange={(event) => dispatch({ type: "SET_ENEMIES_TARGETING", target, value: numberValue(event.target.value) })} className="mt-1 h-8 font-mono text-foreground" />
                </label>
              ))}
              <label className="text-[9px] text-muted-foreground">
                Hits / sec
                <Input type="number" min={0} step={0.25} value={scenario.incomingHitsPerSecond} onChange={(event) => dispatch({ type: "SET_INCOMING_HITS_PER_SECOND", value: numberValue(event.target.value) })} className="mt-1 h-8 font-mono text-foreground" />
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ConditionGroup title="Attacker item conditions" target="damage" loadout={attacker} items={data.items} scenario={scenario} dispatch={dispatch} />
          <ConditionGroup title="Defender item conditions" target="tank" loadout={defender} items={data.items} scenario={scenario} dispatch={dispatch} />
        </div>

        <div className="grid gap-3 border-t border-border/70 pt-5 lg:grid-cols-2">
          {([
            ["Armor sunder", "Simulate an allied effect reducing the tank's Armor.", scenario.externalArmorSunder, "SET_EXTERNAL_ARMOR_SUNDER"],
            ["Magic shred", "Simulate an allied effect reducing the tank's Magic Resist.", scenario.externalMagicShred, "SET_EXTERNAL_MAGIC_SHRED"],
          ] as const).map(([label, description, debuff, action]) => (
            <div key={label} className="flex items-center gap-3 rounded-md border border-border bg-background/50 p-3">
              <Toggle checked={debuff.enabled} onCheckedChange={(enabled) => dispatch({ type: action, value: { ...debuff, enabled } })} label={`${debuff.enabled ? "Disable" : "Enable"} external ${label}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">External {label}</p>
                <p className="text-[10px] text-muted-foreground">{description}</p>
              </div>
              <label className="relative w-24 shrink-0">
                <span className="sr-only">{label} percent</span>
                <Input type="number" min={0} max={100} value={debuff.percent} disabled={!debuff.enabled} onChange={(event) => dispatch({ type: action, value: { ...debuff, percent: numberValue(event.target.value) } })} className="h-8 pr-7 font-mono" />
                <span className="pointer-events-none absolute right-2 top-2 text-[10px] text-muted-foreground">%</span>
              </label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
