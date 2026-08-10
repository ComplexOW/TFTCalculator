import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ChevronRight,
  Clock3,
  Info,
  Sparkles,
  Swords,
  TimerReset,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  groupConsecutiveDamageEvents,
  type DamageEventGroup,
} from "@/lib/damage-calculator/event-groups";
import type {
  CalculationStatus,
  ActiveItemEffect,
  DamageCheckpoint,
  DamageCalculationResult,
  DamageEventResult,
  DefenseDebuffSummary,
  FinalCombatStats,
  TankStats,
} from "@/lib/damage-calculator/types";
import { cn } from "@/lib/utils";

type CalculationResultsProps = {
  result: DamageCalculationResult;
};

const STATUS_COPY: Record<CalculationStatus, { label: string; className: string }> = {
  incomplete: { label: "Setup required", className: "border-border text-muted-foreground" },
  unsupported: { label: "Unsupported", className: "border-amber-500/40 bg-amber-500/10 text-amber-200" },
  partial: { label: "Partial result", className: "border-amber-500/40 bg-amber-500/10 text-amber-200" },
  complete: { label: "Complete", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" },
};

function number(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

function DamageTypeDot({ type }: { type: DamageEventResult["damageType"] }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 rounded-full",
        type === "physical" && "bg-orange-400",
        type === "magic" && "bg-sky-400",
        type === "true" && "bg-zinc-100",
      )}
    />
  );
}

function EventLedger({ event }: { event: DamageEventResult }) {
  return (
    <li className="rounded-md border border-border bg-background/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <DamageTypeDot type={event.damageType} />
            <h4 className="text-sm font-medium">{event.sourceName}</h4>
          </div>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {event.category.replace("-", " ")} · {event.damageType} · {event.crit === "ineligible" ? "cannot crit" : `${event.crit} crit`}
          </p>
        </div>
        <span className="font-mono text-lg font-semibold tabular-nums">{number(event.healthDamage)}</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
        {[
          ["Raw", event.rawDamage],
          ["Mitigated", event.mitigatedDamage],
          ["Shield", event.absorbedDamage],
          ["Health", event.healthDamage],
        ].map(([label, value]) => (
          <div key={label} className="bg-card px-2 py-1.5">
            <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="font-mono text-xs font-semibold tabular-nums">{number(value as number)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {event.effectiveResistance === null ? "True damage bypassed defenses" : `${number(event.effectiveResistance)} effective resistance · ${number(event.resistanceMultiplier, 3)}× multiplier`}
      </p>
    </li>
  );
}

function MultiHitEventLedger({ group }: { group: DamageEventGroup }) {
  const firstEvent = group.events[0];
  const hitCount = group.events.length;

  return (
    <li>
      <details className="group rounded-md border border-border bg-background/60">
        <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-2 rounded-md p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
              <DamageTypeDot type={firstEvent.damageType} />
              <h4 className="text-sm font-medium">{firstEvent.sourceName}</h4>
              <Badge variant="outline" className="font-mono text-[9px] tabular-nums">
                {hitCount} hits
              </Badge>
            </div>
            <p className="mt-1 pl-6 text-[10px] uppercase tracking-wider text-muted-foreground">
              {firstEvent.category.replace("-", " ")} · {firstEvent.damageType} · {firstEvent.crit === "ineligible" ? "cannot crit" : `${firstEvent.crit} crit`}
            </p>
          </div>
          <span className="font-mono text-lg font-semibold tabular-nums">{number(group.aggregate.healthDamage)}</span>
          <dl className="basis-full grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
            {[
              ["Raw", group.aggregate.rawDamage],
              ["Mitigated", group.aggregate.mitigatedDamage],
              ["Shield", group.aggregate.absorbedDamage],
              ["Health", group.aggregate.healthDamage],
            ].map(([label, value]) => (
              <div key={label} className="bg-card px-2 py-1.5">
                <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</dt>
                <dd className="font-mono text-xs font-semibold tabular-nums">{number(value as number)}</dd>
              </div>
            ))}
          </dl>
          <p className="basis-full text-[10px] text-muted-foreground">
            Combined damage across {hitCount} hits · expand for the ordered breakdown
          </p>
        </summary>
        <div className="border-t border-border p-3">
          <ol className="space-y-2">
            {group.events.map((event, index) => (
              <li key={event.id}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Hit {index + 1} of {hitCount}
                </p>
                <ul><EventLedger event={event} /></ul>
              </li>
            ))}
          </ol>
        </div>
      </details>
    </li>
  );
}

function CombatStats({ title, stats }: { title: string; stats: FinalCombatStats }) {
  const rows = [
    ["HP", stats.hp],
    ["AD", stats.attackDamage],
    ["AP", stats.abilityPower],
    ["AS", stats.attackSpeed],
    ["Armor", stats.armor],
    ["MR", stats.magicResist],
    ["Crit", stats.critChance * 100, "%"],
    ["Crit dmg", stats.critMultiplier * 100, "%"],
    ["Mana", stats.initialMana, `/${number(stats.maxMana)}`],
    ["Dmg amp", stats.damageAmp * 100, "%"],
    ["Durability", stats.durability * 100, "%"],
    ["AA DR", stats.attackDamageReduction * 100, "%"],
    ["Omnivamp", stats.omnivamp * 100, "%"],
    ["Mana gain", (stats.manaGainMultiplier - 1) * 100, "%"],
  ] as const;

  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <dl className="grid grid-cols-3 gap-1">
        {rows.map(([label, value, suffix]) => (
          <div key={label} className="rounded-md border border-border bg-background/50 px-2 py-1.5">
            <dt className="text-[9px] text-muted-foreground">{label}</dt>
            <dd className="font-mono text-[11px] font-semibold tabular-nums">{number(value)}{suffix}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TimelineResults({ checkpoints, timeToKill }: { checkpoints: DamageCheckpoint[]; timeToKill: number | null }) {
  if (checkpoints.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-background/45">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
        <BarChart3 className="size-4 text-rose-300" aria-hidden />
        <h3 className="text-xs font-semibold">Combat timeline</h3>
        {timeToKill !== null && (
          <Badge variant="outline" className="ml-auto gap-1 border-rose-500/30 bg-rose-500/[0.07] font-mono text-[9px] text-rose-200">
            <TimerReset className="size-3" aria-hidden /> TTK {number(timeToKill)}s
          </Badge>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[11px]">
          <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border/70">
              <th scope="col" className="px-3 py-2 font-medium">Time</th>
              <th scope="col" className="px-3 py-2 font-medium">Avg DPS</th>
              <th scope="col" className="px-3 py-2 font-medium">Total damage</th>
              <th scope="col" className="px-3 py-2 font-medium">Health damage</th>
              <th scope="col" className="px-3 py-2 font-medium">P / M / T</th>
              <th scope="col" className="px-3 py-2 font-medium">Attacks / casts</th>
              <th scope="col" className="px-3 py-2 font-medium">AD / AP / AS</th>
              <th scope="col" className="px-3 py-2 font-medium">Tank HP / shield</th>
              <th scope="col" className="px-3 py-2 font-medium">Armor / MR</th>
              <th scope="col" className="px-3 py-2 font-medium">Dur / AA DR</th>
            </tr>
          </thead>
          <tbody>
            {checkpoints.map((checkpoint) => (
              <tr key={checkpoint.timeSeconds} className="border-b border-border/50 last:border-0">
                <td className="px-3 py-2.5 font-mono font-semibold text-sky-200">{number(checkpoint.timeSeconds)}s</td>
                <td className="px-3 py-2.5 font-mono font-semibold text-rose-200">{number(checkpoint.averageDps)}</td>
                <td className="px-3 py-2.5 font-mono">{number(checkpoint.cumulativeDamage)}</td>
                <td className="px-3 py-2.5 font-mono">{number(checkpoint.cumulativeHealthDamage)}</td>
                <td className="px-3 py-2.5 font-mono text-[10px]">
                  <span className="text-orange-300">{number(checkpoint.physicalDamage)}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="text-sky-300">{number(checkpoint.magicDamage)}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span>{number(checkpoint.trueDamage)}</span>
                </td>
                <td className="px-3 py-2.5 font-mono">{checkpoint.attacks} / {checkpoint.casts}</td>
                <td className="px-3 py-2.5 font-mono">{number(checkpoint.attackerAttackDamage)} / {number(checkpoint.attackerAbilityPower)} / {number(checkpoint.attackerAttackSpeed)}</td>
                <td className="px-3 py-2.5 font-mono">{number(checkpoint.defenderHealth)} / {number(checkpoint.defenderShield)}</td>
                <td className="px-3 py-2.5 font-mono">{number(checkpoint.effectiveArmor)} / {number(checkpoint.effectiveMagicResist)}</td>
                <td className="px-3 py-2.5 font-mono">{number(checkpoint.defenderDurability * 100)}% / {number(checkpoint.defenderAttackDamageReduction * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-border/70 px-3 py-2 text-[9px] text-muted-foreground">
        <span><i className="mr-1 inline-block size-1.5 rounded-full bg-orange-400" />Physical</span>
        <span><i className="mr-1 inline-block size-1.5 rounded-full bg-sky-400" />Magic</span>
        <span><i className="mr-1 inline-block size-1.5 rounded-full bg-zinc-100" />True</span>
        <span className="ml-auto">Cumulative totals include shield absorption; health damage does not.</span>
      </div>
    </div>
  );
}

function ActiveEffects({ effects }: { effects: ActiveItemEffect[] }) {
  if (effects.length === 0) return null;
  return (
    <details className="group rounded-md border border-border bg-background/40 p-3" open>
      <summary className="cursor-pointer text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Item effect states <span className="ml-1 font-mono text-muted-foreground">({effects.filter((effect) => effect.active).length}/{effects.length} active)</span>
      </summary>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {effects.map((effect, index) => (
          <li key={`${effect.holder}-${effect.itemId}-${effect.label}-${index}`} className="flex items-center gap-2 rounded-md border border-border bg-card/70 p-2">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", effect.active ? "bg-emerald-400" : "bg-zinc-600")} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-medium">{effect.itemName}</span>
              <span className="block truncate text-[9px] text-muted-foreground">{effect.holder} · {effect.label}</span>
            </span>
            {effect.value !== undefined && (
              <Badge variant="outline" className="font-mono text-[9px]">
                {number(effect.unit === "percent" ? effect.value * 100 : effect.value)}{effect.unit === "percent" ? "%" : effect.unit === "stacks" ? " stacks" : ""}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function TankSummary({ stats }: { stats: TankStats }) {
  const rows = [
    ["Starting HP", stats.startingHealth],
    ["Ending HP", stats.endingHealth],
    ["Starting shield", stats.startingShield],
    ["Ending shield", stats.endingShield],
    ["Threshold shields", stats.thresholdShieldsGranted],
    ["Healing", stats.healing],
    ["Starting mana", stats.startingMana],
    ["Ending mana", stats.endingMana],
    ["Threshold mana", stats.thresholdManaGranted],
    ["Armor", stats.armor],
    ["Magic resist", stats.magicResist],
    ["Durability", stats.durability * 100, "%"],
    ["Attack DR", stats.attackDamageReduction * 100, "%"],
  ] as const;
  return (
    <div className="rounded-md border border-border bg-background/45 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold">Tank survival</h3>
        <Badge variant="outline" className="font-mono text-[9px]">Max {number(stats.maxHealth)} HP</Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-4">
        {rows.map(([label, value, suffix]) => (
          <div key={label} className="rounded-md border border-border bg-card/70 px-2 py-1.5">
            <dt className="text-[9px] text-muted-foreground">{label}</dt>
            <dd className="font-mono text-[11px] font-semibold">{number(value)}{suffix}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DefenseDebuffs({ summary }: { summary: DefenseDebuffSummary }) {
  return (
    <div className="rounded-md border border-border bg-background/45 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold">Defense debuffs</h3>
        <Badge variant="outline" className="ml-auto font-mono text-[9px]">{number(summary.armorSunderPercent)}% sunder</Badge>
        <Badge variant="outline" className="font-mono text-[9px]">{number(summary.magicShredPercent)}% shred</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border bg-card/70 p-2 text-[9px] text-muted-foreground">Armor <span className="float-right font-mono text-[11px] font-semibold text-foreground">{number(summary.baseArmor)} → {number(summary.effectiveArmor)}</span></div>
        <div className="rounded-md border border-border bg-card/70 p-2 text-[9px] text-muted-foreground">Magic resist <span className="float-right font-mono text-[11px] font-semibold text-foreground">{number(summary.baseMagicResist)} → {number(summary.effectiveMagicResist)}</span></div>
      </div>
      {summary.sources.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {summary.sources.map((source, index) => (
            <li key={`${source.sourceId}-${source.kind}-${index}`} className="flex items-center gap-2 text-[10px]">
              <span aria-hidden className={cn("size-1.5 rounded-full", source.active ? "bg-emerald-400" : "bg-zinc-600")} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{source.sourceName}</span>
              <span className="font-mono">{number(source.percent)}% {source.kind}</span>
              <Badge variant="secondary" className="text-[8px]">{source.timing.replace("-", " ")}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyResults({ result }: CalculationResultsProps) {
  const missing = result.missing.map((entry) => entry === "attacker" ? "an attacker" : "a defender");
  return (
    <section aria-labelledby="calculation-results-heading" aria-live="polite">
      <Card className="border border-dashed border-border bg-card/40">
        <CardContent className="flex min-h-32 items-center justify-center py-8 text-center">
          <div>
            <Swords className="mx-auto mb-3 size-5 text-muted-foreground" aria-hidden />
            <h2 id="calculation-results-heading" className="text-sm font-medium">Calculation results</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose {missing.join(" and ")} to calculate this matchup.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function CalculationResults({ result }: CalculationResultsProps) {
  if (result.status === "incomplete") return <EmptyResults result={result} />;

  const status = STATUS_COPY[result.status];
  const groupedEvents = groupConsecutiveDamageEvents(result.events);
  const castRaw = result.ability.reduce((total, event) => total + event.rawDamage, 0);
  const castMitigated = result.ability.reduce((total, event) => total + event.mitigatedDamage, 0);
  const castHealth = result.ability.reduce((total, event) => total + event.healthDamage, 0);
  const finalCheckpoint = result.checkpoints[result.checkpoints.length - 1];
  const messages = [
    ...result.unsupported.map((issue) => issue.message),
    ...result.warnings,
  ];

  return (
    <section aria-labelledby="calculation-results-heading" aria-live="polite">
      <Card className="border border-rose-500/20 bg-card/90">
        <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border/70">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300">
              <Swords className="size-4" aria-hidden />
            </div>
            <div>
              <h2 id="calculation-results-heading" className="text-base font-semibold">Calculation results</h2>
              <p className="text-xs text-muted-foreground">Timeline damage, item states, mitigation, and tank survival for the configured scenario.</p>
            </div>
          </div>
          <Badge variant="outline" className={status.className}>{status.label}</Badge>
        </CardHeader>

        <CardContent className="space-y-5">
          {messages.length > 0 && (
            <div role="status" className="rounded-md border border-amber-500/30 bg-amber-500/[0.07] p-3">
              <div className="flex items-center gap-2 text-amber-200">
                <AlertTriangle className="size-4" aria-hidden />
                <h3 className="text-xs font-semibold">Unsupported or estimated mechanics</h3>
              </div>
              <ul className="mt-2 space-y-1 pl-6 text-xs text-amber-100/80">
                {messages.map((message, index) => <li key={`${message}-${index}`} className="list-disc">{message}</li>)}
              </ul>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-rose-500/30 bg-rose-500/[0.07] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-200/70">Opening basic</p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{number(result.basicAttack?.healthDamage ?? 0)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">health damage</p>
              <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
                {number(result.basicAttack?.rawDamage ?? 0)} raw <ArrowRight className="size-3" aria-hidden /> {number(result.basicAttack?.mitigatedDamage ?? 0)} mitigated
              </p>
            </div>
            <div className="rounded-md border border-sky-500/30 bg-sky-500/[0.07] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-200/70">Opening cast</p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{number(castHealth)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">health damage · {result.ability.length} event{result.ability.length === 1 ? "" : "s"}</p>
              <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
                {number(castRaw)} raw <ArrowRight className="size-3" aria-hidden /> {number(castMitigated)} mitigated
              </p>
            </div>
            <div className="rounded-md border border-border bg-background/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Timeline total</p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{number(finalCheckpoint?.cumulativeDamage ?? result.totals.health)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{number(finalCheckpoint?.cumulativeHealthDamage ?? result.totals.health)} health damage</p>
              <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="size-3" aria-hidden /> through {number(finalCheckpoint?.timeSeconds ?? 0)}s</p>
            </div>
            <div className="rounded-md border border-border bg-background/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Effective defenses</p>
              <dl className="mt-2 grid grid-cols-2 gap-2">
                <div><dt className="text-[10px] text-muted-foreground">Armor</dt><dd className="font-mono text-xl font-semibold">{result.effectiveDefenses ? number(result.effectiveDefenses.armor) : "—"}</dd></div>
                <div><dt className="text-[10px] text-muted-foreground">MR</dt><dd className="font-mono text-xl font-semibold">{result.effectiveDefenses ? number(result.effectiveDefenses.magicResist) : "—"}</dd></div>
              </dl>
            </div>
          </div>

          <TimelineResults checkpoints={result.checkpoints} timeToKill={result.timeToKillSeconds} />

          {(result.tankStats || result.defenseDebuffs) && (
            <div className="grid gap-3 lg:grid-cols-2">
              {result.tankStats && <TankSummary stats={result.tankStats} />}
              {result.defenseDebuffs && <DefenseDebuffs summary={result.defenseDebuffs} />}
            </div>
          )}

          <ActiveEffects effects={result.activeItemEffects} />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider">Damage ledger</h3>
                <span className="font-mono text-[10px] text-muted-foreground">{result.events.length} event{result.events.length === 1 ? "" : "s"}</span>
              </div>
              {result.events.length > 0 ? (
                <ul className="space-y-2">
                  {groupedEvents.map((group) => group.events.length > 1
                    ? <MultiHitEventLedger key={group.events[0].id} group={group} />
                    : <EventLedger key={group.events[0].id} event={group.events[0]} />)}
                </ul>
              ) : (
                <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No supported damage events were produced.</p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider">Damage by type</h3>
                <dl className="grid grid-cols-3 gap-2">
                  {([
                    ["Physical", result.totals.physical, "bg-orange-400"],
                    ["Magic", result.totals.magic, "bg-sky-400"],
                    ["True", result.totals.true, "bg-zinc-100"],
                  ] as const).map(([label, value, color]) => (
                    <div key={label} className="rounded-md border border-border bg-background/50 p-2">
                      <dt className="flex items-center gap-1.5 text-[9px] text-muted-foreground"><span className={cn("size-1.5 rounded-full", color)} aria-hidden />{label}</dt>
                      <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">{number(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {result.finalStats.attacker && <CombatStats title="Final attacker stats" stats={result.finalStats.attacker} />}
              {result.finalStats.defender && <CombatStats title="Final defender stats" stats={result.finalStats.defender} />}
            </div>
          </div>

          {result.manaEstimate && (
            <div className="rounded-md border border-border bg-background/50 p-3">
              <div className="flex items-center gap-2">
                <Clock3 className="size-4 text-sky-300" aria-hidden />
                <h3 className="text-xs font-semibold">Mana estimate</h3>
                <Badge variant="outline" className="ml-auto">{result.manaEstimate.normalizedRole ?? "Unknown role"}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div><dt className="text-[9px] uppercase tracking-wider text-muted-foreground">Starting</dt><dd className="font-mono text-sm font-semibold">{number(result.manaEstimate.startingMana)}/{number(result.manaEstimate.maxMana)}</dd></div>
                <div><dt className="text-[9px] uppercase tracking-wider text-muted-foreground">Per attack</dt><dd className="font-mono text-sm font-semibold">{result.manaEstimate.manaPerAttack === null ? "—" : number(result.manaEstimate.manaPerAttack)}</dd></div>
                <div><dt className="text-[9px] uppercase tracking-wider text-muted-foreground">Passive / sec</dt><dd className="font-mono text-sm font-semibold">{number(result.manaEstimate.passiveManaPerSecond)}</dd></div>
                <div><dt className="text-[9px] uppercase tracking-wider text-muted-foreground">Attacks to cast</dt><dd className="font-mono text-sm font-semibold">{result.manaEstimate.attacksUntilCast ?? "—"}</dd></div>
                <div><dt className="text-[9px] uppercase tracking-wider text-muted-foreground">Seconds to cast</dt><dd className="font-mono text-sm font-semibold">{result.manaEstimate.secondsUntilCast === null ? "—" : `${number(result.manaEstimate.secondsUntilCast)}s`}</dd></div>
              </dl>
              {result.manaEstimate.events.length > 0 && (
                <ol className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Mana timeline">
                  {result.manaEstimate.events.map((event, index) => (
                    <li key={`${event.timeSeconds}-${event.kind}-${index}`} className="min-w-28 rounded-md border border-border bg-card px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{number(event.timeSeconds)}s · {event.kind}</p>
                      <p className="mt-0.5 font-mono text-[11px] font-semibold">{number(event.manaBefore)} → {number(event.manaAfter)}</p>
                    </li>
                  ))}
                </ol>
              )}
              {result.manaEstimate.warning && <p className="mt-2 text-[10px] text-amber-200">{result.manaEstimate.warning}</p>}
            </div>
          )}

          <Separator />

          <div className="grid gap-4 lg:grid-cols-2">
            <details className="group rounded-md border border-border bg-background/40 p-3" open={result.modifiers.length > 0}>
              <summary className="cursor-pointer text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Applied modifiers <span className="ml-1 font-mono text-muted-foreground">({result.modifiers.length})</span></summary>
              {result.modifiers.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {result.modifiers.map((modifier, index) => (
                    <li key={`${modifier.sourceId}-${modifier.stat}-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="min-w-0 truncate text-muted-foreground">{modifier.sourceName} · {modifier.stat}</span>
                      <span className="shrink-0 font-mono">{modifier.operation} {number(modifier.value)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-xs text-muted-foreground">No supported stat modifiers applied.</p>}
            </details>

            <details className="group rounded-md border border-border bg-background/40 p-3" open={result.assumptions.length > 0}>
              <summary className="cursor-pointer text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Assumptions <span className="ml-1 font-mono text-muted-foreground">({result.assumptions.length})</span></summary>
              {result.assumptions.length > 0 ? (
                <ul className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
                  {result.assumptions.map((assumption, index) => <li key={`${assumption}-${index}`} className="flex gap-2"><Info className="mt-0.5 size-3 shrink-0" aria-hidden />{assumption}</li>)}
                </ul>
              ) : <p className="mt-2 text-xs text-muted-foreground">No additional assumptions reported.</p>}
            </details>
          </div>

          {result.status !== "complete" && (
            <p className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Sparkles className="size-3" aria-hidden /> Partial and unsupported results include only mechanics the engine can explain.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
