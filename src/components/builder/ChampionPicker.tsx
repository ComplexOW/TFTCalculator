"use client";

import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { clsx } from "clsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTeamBuilder } from "./state";
import { ChampionCard } from "./ChampionCard";
import { ItemCard } from "./ItemCard";
import { costClass } from "./cost-color";
import { dropId } from "@/lib/drag-ids";
import type { Cost } from "@/data/types";

const COSTS: Cost[] = [1, 2, 3, 4, 5];

export function ChampionPicker() {
  const { data } = useTeamBuilder();
  const [search, setSearch] = useState("");
  const [costFilter, setCostFilter] = useState<Set<Cost>>(new Set());
  const [traitFilter, setTraitFilter] = useState<string | null>(null);

  const { isOver, setNodeRef } = useDroppable({
    id: dropId({ kind: "picker" }),
    data: { kind: "picker" },
  });

  const champions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.champions.filter((c) => {
      if (costFilter.size > 0 && !costFilter.has(c.cost)) return false;
      if (traitFilter && !c.traits.includes(traitFilter)) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.champions, search, costFilter, traitFilter]);

  const traitNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of data.champions) for (const t of c.traits) names.add(t);
    return Array.from(names).sort();
  }, [data.champions]);

  const toggleCost = (c: Cost) => {
    setCostFilter((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <aside
      ref={setNodeRef}
      className={clsx(
        "flex h-full flex-col border-r border-border bg-card/50 backdrop-blur",
        "w-[clamp(280px,28vw,380px)]",
        isOver && "ring-2 ring-destructive/70",
      )}
      aria-label="Champion and item picker"
    >
      <Tabs defaultValue="champions" className="flex h-full flex-col">
        <div className="border-b border-border p-3">
          <TabsList className="w-full">
            <TabsTrigger value="champions" className="flex-1">
              Champions
            </TabsTrigger>
            <TabsTrigger value="items" className="flex-1">
              Items
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="champions" className="m-0 flex flex-1 flex-col overflow-hidden">
          <div className="space-y-2 border-b border-border p-3">
            <Input
              placeholder="Search champions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search champions"
            />
            <div className="flex flex-wrap gap-1">
              {COSTS.map((c) => (
                <Badge
                  key={c}
                  variant={costFilter.has(c) ? "default" : "outline"}
                  onClick={() => toggleCost(c)}
                  className={clsx(
                    "cursor-pointer select-none",
                    costFilter.has(c) && costClass(c, "bg"),
                  )}
                >
                  {c}-cost
                </Badge>
              ))}
            </div>
            <select
              value={traitFilter ?? ""}
              onChange={(e) => setTraitFilter(e.target.value || null)}
              aria-label="Filter by trait"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              <option value="">All traits</option>
              {traitNames.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4">
              {champions.map((champ) => (
                <ChampionCard key={champ.id} champion={champ} />
              ))}
              {champions.length === 0 && (
                <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                  No champions match your filters.
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="items" className="m-0 flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-border p-3 text-xs text-muted-foreground">
            Drag items onto a placed champion. Click an equipped item to remove it.
          </div>
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-5 gap-2 p-3 sm:grid-cols-6">
              {data.items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      <Separator />
      <div className="bg-card/80 p-2 text-center text-[11px] text-muted-foreground">
        Drop a placed unit here to remove it.
      </div>
    </aside>
  );
}
