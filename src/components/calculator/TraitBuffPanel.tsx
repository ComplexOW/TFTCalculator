"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TftSet, Trait } from "@/data/types";
import type { CalculatorTarget, ManualTraitBuff } from "@/lib/damage-calculator/model";

type TraitBuffPanelProps = {
  data: TftSet;
  buffs: ManualTraitBuff[];
  onAdd: (buff: ManualTraitBuff) => void;
  onSetTier: (target: CalculatorTarget, traitId: string, tierMin: number) => void;
  onRemove: (target: CalculatorTarget, traitId: string) => void;
};

const TARGET_LABEL: Record<CalculatorTarget, string> = {
  tank: "Tank",
  damage: "Damage hero",
};

function BuffRow({
  buff,
  trait,
  onSetTier,
  onRemove,
}: {
  buff: ManualTraitBuff;
  trait: Trait;
  onSetTier: (tierMin: number) => void;
  onRemove: () => void;
}) {
  const activeTier = trait.tiers.find((tier) => tier.min === buff.tierMin);
  const variableSummary = activeTier
    ? Object.entries(activeTier.variables)
        .filter(([, value]) => value !== null && value !== "")
        .slice(0, 3)
    : [];

  return (
    <li className="rounded-md border border-border bg-background/60 p-2">
      <div className="flex items-center gap-2">
        <Image src={trait.iconUrl} alt="" aria-hidden width={32} height={32} className="size-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{trait.name}</p>
          <p className="text-[11px] text-muted-foreground">Buffs {TARGET_LABEL[buff.target]}</p>
        </div>
        <label className="sr-only" htmlFor={`${buff.target}-${buff.traitId}-tier`}>
          {trait.name} tier
        </label>
        <select
          id={`${buff.target}-${buff.traitId}-tier`}
          value={buff.tierMin}
          onChange={(event) => onSetTier(Number(event.target.value))}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {trait.tiers.map((tier) => (
            <option key={tier.min} value={tier.min}>
              {tier.min} · {tier.style}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Remove ${trait.name} from ${TARGET_LABEL[buff.target]}`}
        >
          <X aria-hidden />
        </Button>
      </div>
      {variableSummary.length > 0 && (
        <p className="mt-2 truncate border-t border-border/70 pt-2 font-mono text-[9px] text-muted-foreground" title={variableSummary.map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}>
          {variableSummary.map(([key, value]) => `${key} ${String(value)}`).join(" · ")}
        </p>
      )}
    </li>
  );
}

export function TraitBuffPanel({ data, buffs, onAdd, onSetTier, onRemove }: TraitBuffPanelProps) {
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<CalculatorTarget>("damage");

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return data.traits
      .filter((trait) => trait.name.toLowerCase().includes(normalized))
      .slice(0, 6);
  }, [data.traits, query]);

  return (
    <Card className="border border-amber-500/20 bg-amber-500/[0.035]">
      <CardHeader className="flex-row items-start gap-3 border-b border-border/70">
        <div className="grid size-9 shrink-0 place-items-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300">
          <Sparkles className="size-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold">Manual trait buffs</h2>
          <p className="text-xs text-muted-foreground">
            Add only the traits that should affect this matchup, then choose their active tier.
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="space-y-3">
          <div className="flex gap-2" aria-label="Trait buff target">
            {(["damage", "tank"] as const).map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={target === option ? "default" : "outline"}
                onClick={() => setTarget(option)}
                aria-pressed={target === option}
              >
                Buff {TARGET_LABEL[option]}
              </Button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search traits..."
              aria-label="Search traits"
              className="pl-8"
            />
          </div>
          {query.trim() ? (
            <div className="grid gap-2 rounded-md border border-border bg-background/40 p-2 sm:grid-cols-2">
              {results.map((trait) => {
                const added = buffs.some(
                  (buff) => buff.traitId === trait.id && buff.target === target,
                );
                return (
                  <button
                    key={trait.id}
                    type="button"
                    disabled={added || trait.tiers.length === 0}
                    onClick={() => {
                      onAdd({ traitId: trait.id, target, tierMin: trait.tiers[0].min });
                      setQuery("");
                    }}
                    className="flex min-w-0 items-center gap-2 rounded-md border border-border p-2 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Image src={trait.iconUrl} alt="" aria-hidden width={28} height={28} className="size-7" />
                    <span className="min-w-0 flex-1 truncate text-sm">{trait.name}</span>
                    {added && <Badge variant="secondary">Added</Badge>}
                  </button>
                );
              })}
              {results.length === 0 && (
                <p className="col-span-full py-3 text-center text-xs text-muted-foreground">
                  No traits match “{query}”.
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              Search the current set&apos;s traits. A trait can target both heroes independently.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider">Applied buffs</h3>
            <span className="font-mono text-[11px] text-muted-foreground">{buffs.length} active</span>
          </div>
          {buffs.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {buffs.map((buff) => {
                const trait = data.traits.find((candidate) => candidate.id === buff.traitId);
                if (!trait) return null;
                return (
                  <BuffRow
                    key={`${buff.target}-${buff.traitId}`}
                    buff={buff}
                    trait={trait}
                    onSetTier={(tierMin) => onSetTier(buff.target, buff.traitId, tierMin)}
                    onRemove={() => onRemove(buff.target, buff.traitId)}
                  />
                );
              })}
            </ul>
          ) : (
            <div className="grid min-h-28 place-items-center rounded-md border border-dashed border-border text-center">
              <div>
                <Sparkles className="mx-auto mb-2 size-4 text-muted-foreground" aria-hidden />
                <p className="text-xs text-muted-foreground">No manual buffs applied yet.</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
