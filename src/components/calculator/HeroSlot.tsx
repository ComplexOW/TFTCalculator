"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Crosshair, Plus, Search, Shield, Star, X } from "lucide-react";
import { costClass } from "@/components/builder/cost-color";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Champion, Item, TftSet } from "@/data/types";
import type { CalculatorTarget, HeroLoadout, StarLevel } from "@/lib/damage-calculator/model";
import { cn } from "@/lib/utils";

type HeroSlotProps = {
  target: CalculatorTarget;
  loadout: HeroLoadout;
  data: TftSet;
  onSelectChampion: (championId: string) => void;
  onClearChampion: () => void;
  onSetStarLevel: (starLevel: StarLevel) => void;
  onEquipItem: (itemId: string) => void;
  onRemoveItem: (slot: number) => void;
};

const ROLE_COPY = {
  tank: {
    eyebrow: "Defender",
    title: "Tank hero",
    description: "The unit receiving incoming damage.",
    accent: "border-sky-500/30 bg-sky-500/5",
    icon: Shield,
  },
  damage: {
    eyebrow: "Attacker",
    title: "Damage hero",
    description: "The unit dealing damage to the defender.",
    accent: "border-rose-500/30 bg-rose-500/5",
    icon: Crosshair,
  },
} as const;

function formatStat(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

function ChampionResult({ champion, onSelect }: { champion: Champion; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex min-w-0 items-center gap-2 rounded-md border border-border bg-background/60 p-2 text-left transition-colors hover:border-foreground/30 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Image
        src={champion.iconUrl}
        alt={champion.name}
        width={40}
        height={40}
        className={cn("size-10 rounded-md object-cover ring-2", costClass(champion.cost, "ring"))}
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{champion.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {champion.traits.join(" · ")}
        </span>
      </span>
    </button>
  );
}

function ItemCategoryBadge({ item }: { item: Item }) {
  return item.category === "radiant" ? (
    <Badge className="border-amber-300/40 bg-amber-300/15 text-[9px] text-amber-200">Radiant</Badge>
  ) : (
    <Badge variant="secondary" className="text-[9px]">Full</Badge>
  );
}

function EquippedItem({ item, onRemove }: { item: Item | undefined; onRemove: () => void }) {
  if (!item) {
    return (
      <div className="flex min-h-14 items-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-2 text-muted-foreground">
        <Plus className="size-4 shrink-0" aria-hidden />
        <span className="text-[11px]">Empty slot</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onRemove}
      title={`Remove ${item.name}`}
      aria-label={`Remove ${item.name}`}
      className="group flex min-h-14 min-w-0 items-center gap-2 rounded-md border border-amber-500/35 bg-background/70 p-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-zinc-900">
        <Image src={item.iconUrl} alt="" aria-hidden fill sizes="40px" className="object-cover" />
        <span className="absolute inset-0 grid place-items-center bg-black/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <X className="size-4 text-white" aria-hidden />
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-medium leading-tight">{item.name}</span>
        <span className={cn("mt-1 block text-[9px] uppercase tracking-wider", item.category === "radiant" ? "text-amber-300" : "text-muted-foreground")}>{item.category === "radiant" ? "Radiant" : "Full item"}</span>
      </span>
    </button>
  );
}

function ChampionStats({ champion }: { champion: Champion }) {
  if (!champion.stats) {
    return (
      <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        Detailed stats are unavailable in this local data snapshot. Refresh the Set 17 catalog.
      </p>
    );
  }

  const rows = [
    ["Health", formatStat(champion.stats.health)],
    ["Attack damage", formatStat(champion.stats.attackDamage)],
    ["Attack speed", formatStat(champion.stats.attackSpeed)],
    ["Armor", formatStat(champion.stats.armor)],
    ["Magic resist", formatStat(champion.stats.magicResist)],
    ["Range", formatStat(champion.stats.range)],
  ] as const;

  return (
    <div>
      <p className="mb-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">Catalog base stats</p>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-background/80 px-2.5 py-2">
            <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 font-mono text-xs font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function HeroSlot({
  target,
  loadout,
  data,
  onSelectChampion,
  onClearChampion,
  onSetStarLevel,
  onEquipItem,
  onRemoveItem,
}: HeroSlotProps) {
  const [championQuery, setChampionQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [choosingChampion, setChoosingChampion] = useState(!loadout.championId);
  const role = ROLE_COPY[target];
  const RoleIcon = role.icon;
  const champion = data.champions.find((candidate) => candidate.id === loadout.championId);
  const equippedItems = loadout.itemIds.map((itemId) =>
    data.items.find((item) => item.id === itemId),
  );
  const hasEmptyItemSlot = loadout.itemIds.some((itemId) => itemId === null);

  const championResults = useMemo(() => {
    const query = championQuery.trim().toLowerCase();
    return data.champions
      .filter((candidate) => !query || candidate.name.toLowerCase().includes(query))
      .slice(0, 10);
  }, [championQuery, data.champions]);

  const itemResults = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    return [...data.items]
      .filter((item) => !query || item.name.toLowerCase().includes(query))
      .sort((left, right) => {
        if (left.category !== right.category) return left.category === "standard" ? -1 : 1;
        return left.name.localeCompare(right.name);
      })
      .slice(0, 12);
  }, [itemQuery, data.items]);

  return (
    <Card className={cn("h-full border", role.accent)}>
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border/70">
        <div className="flex min-w-0 gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-background/70">
            <RoleIcon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{role.eyebrow}</p>
            <h2 className="text-base font-semibold">{role.title}</h2>
            <p className="text-xs text-muted-foreground">{role.description}</p>
          </div>
        </div>
        <Badge variant="outline">{target === "tank" ? "TANK" : "DPS"}</Badge>
      </CardHeader>

      <CardContent className="space-y-5">
        {champion && !choosingChampion ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-md border border-border bg-background/70 p-3">
              <Image
                src={champion.iconUrl}
                alt={champion.name}
                width={72}
                height={72}
                className={cn("size-[72px] rounded-md object-cover ring-2", costClass(champion.cost, "ring"))}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-semibold">{champion.name}</h3>
                  <Badge className={costClass(champion.cost, "bg")}>{champion.cost}-cost</Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{champion.traits.join(" · ")}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Role <span className="font-medium text-foreground">{champion.role || "Unknown"}</span>
                  <span aria-hidden> · </span>
                  Mana <span className="font-mono text-foreground">{champion.stats ? `${champion.stats.startingMana}/${champion.stats.maxMana}` : "—"}</span>
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setChoosingChampion(true)}>Change</Button>
                  <Button variant="ghost" size="sm" onClick={() => { onClearChampion(); setChoosingChampion(true); }}>Clear</Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Star level</span>
              <div className="flex gap-1" aria-label={`${champion.name} star level`}>
                {([1, 2, 3] as const).map((starLevel) => (
                  <Button
                    key={starLevel}
                    type="button"
                    variant={loadout.starLevel === starLevel ? "default" : "outline"}
                    size="sm"
                    onClick={() => onSetStarLevel(starLevel)}
                    aria-pressed={loadout.starLevel === starLevel}
                    aria-label={`${starLevel} star${starLevel > 1 ? "s" : ""}`}
                    className="min-w-12"
                  >
                    {starLevel}<Star className="size-3 fill-current" aria-hidden />
                  </Button>
                ))}
              </div>
            </div>
            <ChampionStats champion={champion} />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor={`${target}-champion-search`}>Choose a champion</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" aria-hidden />
              <Input id={`${target}-champion-search`} value={championQuery} onChange={(event) => setChampionQuery(event.target.value)} placeholder="Search champions..." className="pl-8" />
            </div>
            <ScrollArea className="h-40 rounded-md border border-border bg-background/40">
              <div className="grid gap-2 p-2 sm:grid-cols-2">
                {championResults.map((candidate) => (
                  <ChampionResult key={candidate.id} champion={candidate} onSelect={() => { onSelectChampion(candidate.id); setChampionQuery(""); setChoosingChampion(false); }} />
                ))}
                {championResults.length === 0 && <p className="col-span-full py-6 text-center text-xs text-muted-foreground">No champions match “{championQuery}”.</p>}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider">Items</h3>
              <p className="text-[11px] text-muted-foreground">Full and Radiant items only. Select an equipped item to remove it.</p>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">{loadout.itemIds.filter(Boolean).length}/3</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {equippedItems.map((item, slot) => <EquippedItem key={slot} item={item} onRemove={() => onRemoveItem(slot)} />)}
          </div>
        </div>

        <fieldset disabled={!champion || !hasEmptyItemSlot} className="space-y-2 disabled:opacity-50">
          <legend className="sr-only">Add an item to {role.title}</legend>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" aria-hidden />
            <Input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder={!champion ? "Choose a champion first" : "Search Full and Radiant items..."} aria-label={`Search items for ${role.title}`} className="pl-8" />
          </div>
          <ScrollArea className="h-36 rounded-md border border-border bg-background/40">
            <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
              {itemResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onEquipItem(item.id)}
                  aria-label={`Equip ${item.name}, ${item.category === "radiant" ? "Radiant" : "Full"} item`}
                  className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-background/70 p-1.5 text-left transition-colors hover:border-amber-500/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-zinc-900"><Image src={item.iconUrl} alt="" aria-hidden fill sizes="36px" className="object-cover" /></span>
                  <span className="min-w-0"><span className="block truncate text-[11px] font-medium">{item.name}</span><span className="mt-1 block"><ItemCategoryBadge item={item} /></span></span>
                </button>
              ))}
              {itemResults.length === 0 && <p className="col-span-full py-6 text-center text-xs text-muted-foreground">No items match “{itemQuery}”.</p>}
            </div>
          </ScrollArea>
        </fieldset>
      </CardContent>
    </Card>
  );
}
