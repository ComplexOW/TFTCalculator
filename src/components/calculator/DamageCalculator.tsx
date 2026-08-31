"use client";

import Link from "next/link";
import { useMemo, useReducer } from "react";
import { ArrowLeft, Gauge, RotateCcw, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TftSet } from "@/data/types";
import { calculateDamage } from "@/lib/damage-calculator/engine";
import {
  createDamageCalculationInput,
  createInitialCalculatorState,
  damageCalculatorReducer,
  type CalculatorTarget,
  type CritMode,
} from "@/lib/damage-calculator/model";
import { cn } from "@/lib/utils";
import { CalculationResults } from "./CalculationResults";
import { HeroSlot } from "./HeroSlot";
import { ItemEffectControls } from "./ItemEffectControls";
import { TraitBuffPanel } from "./TraitBuffPanel";

const CRIT_MODES: { value: CritMode; label: string; description: string }[] = [
  { value: "expected", label: "Expected", description: "Chance-weighted average" },
  { value: "force-crit", label: "Force crit", description: "Every eligible hit crits" },
  { value: "force-no-crit", label: "No crit", description: "No eligible hit crits" },
];

function optionalNumber(value: string) {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function DamageCalculator({ data }: { data: TftSet }) {
  const [state, dispatch] = useReducer(
    damageCalculatorReducer,
    undefined,
    createInitialCalculatorState,
  );
  const calculationInput = useMemo(() => createDamageCalculationInput(state), [state]);
  const result = useMemo(() => calculateDamage(calculationInput, data), [calculationInput, data]);
  const matchupReady = Boolean(
    calculationInput.attacker.championId && calculationInput.defender.championId,
  );

  const attacker = data.champions.find((champion) => champion.id === state.damage.championId);

  const slotProps = (target: CalculatorTarget) => ({
    target,
    loadout: state[target],
    data,
    onSelectChampion: (championId: string) =>
      dispatch({ type: "SELECT_CHAMPION", target, championId }),
    onClearChampion: () => dispatch({ type: "CLEAR_CHAMPION", target }),
    onSetStarLevel: (starLevel: 1 | 2 | 3) =>
      dispatch({ type: "SET_STAR_LEVEL", target, starLevel }),
    onEquipItem: (itemId: string) => dispatch({ type: "EQUIP_ITEM", target, itemId }),
    onRemoveItem: (slot: number) => dispatch({ type: "REMOVE_ITEM", target, slot }),
  });

  const hasState =
    Boolean(state.tank.championId || state.damage.championId) ||
    state.traitBuffs.length > 0 ||
    state.scenario.critMode !== "expected" ||
    state.scenario.attackerStartingMana !== undefined ||
    state.scenario.attackerCurrentHealth !== undefined ||
    state.scenario.defenderCurrentHealth !== undefined ||
    state.scenario.defenderShield !== 0 ||
    state.scenario.combatDurationSeconds !== 20 ||
    state.scenario.externalArmorSunder.enabled ||
    state.scenario.externalMagicShred.enabled;

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-background text-foreground">
      <div className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}>
            <ArrowLeft aria-hidden />
            Team builder
          </Link>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Set {data.setNumber}{data.setName ? ` · ${data.setName}` : ""} · Patch {data.provenance?.patch ?? "current"}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-[90rem] space-y-6 px-4 py-6 sm:px-6 lg:py-8">
        <header className="relative overflow-hidden rounded-md border border-border bg-card px-5 py-6 sm:px-7">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-2/5 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.14),transparent_68%)]" />
          <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-rose-300">
                <Swords className="size-4" aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-[0.24em]">Combat workbench</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Damage calculator</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Simulate a timed fight against a configured defender. Track DPS growth, casts, shields, conditional item states, mitigation, and unsupported mechanics.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => dispatch({ type: "RESET" })} disabled={!hasState}>
              <RotateCcw aria-hidden />
              Reset matchup
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="space-y-6 lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:pr-1">
            <section aria-labelledby="matchup-heading">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 id="matchup-heading" className="text-sm font-semibold">Matchup loadout</h2>
                  <p className="text-xs text-muted-foreground">Choose one unit for each combat role.</p>
                </div>
                <Badge variant={matchupReady ? "default" : "outline"}>{matchupReady ? "Matchup ready" : "2 heroes required"}</Badge>
              </div>
              <div className="grid items-stretch gap-4">
                <HeroSlot {...slotProps("tank")} />
                <HeroSlot {...slotProps("damage")} />
              </div>
            </section>

            <Card className="border border-border bg-card/80">
              <CardHeader className="flex-row items-start gap-3 border-b border-border/70">
                <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-background/70 text-rose-300">
                  <Gauge className="size-4" aria-hidden />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Combat scenario</h2>
                  <p className="text-xs text-muted-foreground">Set starting resources and health used by the combat timeline.</p>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5">
                <fieldset>
                  <legend className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Crit handling</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {CRIT_MODES.map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => dispatch({ type: "SET_CRIT_MODE", critMode: mode.value })}
                        aria-pressed={state.scenario.critMode === mode.value}
                        className={cn(
                          "rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          state.scenario.critMode === mode.value
                            ? "border-rose-500/50 bg-rose-500/10"
                            : "border-border bg-background/60 hover:bg-muted",
                        )}
                      >
                        <span className="block text-xs font-medium">{mode.label}</span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">{mode.description}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Attacker mana
                    <Input
                      type="number"
                      min={0}
                      max={attacker?.stats?.maxMana}
                      value={state.scenario.attackerStartingMana ?? ""}
                      onChange={(event) => dispatch({ type: "SET_ATTACKER_STARTING_MANA", value: optionalNumber(event.target.value) })}
                      placeholder={attacker?.stats ? String(attacker.stats.startingMana) : "Auto"}
                      aria-describedby="attacker-mana-hint"
                      className="font-mono text-foreground"
                    />
                    <span id="attacker-mana-hint" className="block normal-case tracking-normal text-muted-foreground">Blank uses unit start mana.</span>
                  </label>
                  <label className="space-y-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Attacker health
                    <Input
                      type="number"
                      min={0}
                      value={state.scenario.attackerCurrentHealth ?? ""}
                      onChange={(event) => dispatch({ type: "SET_ATTACKER_CURRENT_HEALTH", value: optionalNumber(event.target.value) })}
                      placeholder="Auto"
                      className="font-mono text-foreground"
                    />
                    <span className="block normal-case tracking-normal text-muted-foreground">Used for holder health thresholds.</span>
                  </label>
                  <label className="space-y-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Defender health
                    <Input
                      type="number"
                      min={0}
                      value={state.scenario.defenderCurrentHealth ?? ""}
                      onChange={(event) => dispatch({ type: "SET_DEFENDER_CURRENT_HEALTH", value: optionalNumber(event.target.value) })}
                      placeholder="Auto"
                      className="font-mono text-foreground"
                    />
                    <span className="block normal-case tracking-normal text-muted-foreground">Blank uses scaled max HP.</span>
                  </label>
                  <label className="space-y-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Defender shield
                    <Input
                      type="number"
                      min={0}
                      value={state.scenario.defenderShield}
                      onChange={(event) => dispatch({ type: "SET_DEFENDER_SHIELD", value: optionalNumber(event.target.value) ?? 0 })}
                      className="font-mono text-foreground"
                    />
                    <span className="block normal-case tracking-normal text-muted-foreground">Absorbs mitigated damage first.</span>
                  </label>
                </div>
              </CardContent>
            </Card>

            <ItemEffectControls
              data={data}
              attacker={state.damage}
              defender={state.tank}
              scenario={state.scenario}
              dispatch={dispatch}
            />

            <TraitBuffPanel
              data={data}
              buffs={state.traitBuffs}
              onAdd={(buff) => dispatch({ type: "ADD_TRAIT_BUFF", buff })}
              onSetTier={(target, traitId, tierMin) => dispatch({ type: "SET_TRAIT_TIER", target, traitId, tierMin })}
              onRemove={(target, traitId) => dispatch({ type: "REMOVE_TRAIT_BUFF", target, traitId })}
            />
          </div>

          <div className="space-y-6 lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:pr-1">
            <CalculationResults result={result} />
          </div>
        </div>
      </div>
    </main>
  );
}
