"use client";

import Image from "next/image";
import { clsx } from "clsx";
import type { DragSource } from "@/lib/drag-ids";
import { useChampionsById, useItemsById, useTeamBuilder } from "./state";
import { costClass } from "./cost-color";

export function DragGhost({ source }: { source: DragSource }) {
  const champById = useChampionsById();
  const itemsById = useItemsById();
  const { state } = useTeamBuilder();

  if (source.kind === "champion") {
    const champ = champById[source.championId];
    if (!champ) return null;
    return (
      <div
        className={clsx(
          "hex relative h-[var(--hex-w,90px)] w-[var(--hex-w,90px)] overflow-hidden ring-2",
          costClass(champ.cost, "ring"),
        )}
        style={{ "--hex-w": "90px" } as React.CSSProperties}
      >
        <Image src={champ.iconUrl} alt="" fill sizes="90px" className="hex object-cover" />
      </div>
    );
  }

  if (source.kind === "placed") {
    const unit = state.cells[source.cell];
    if (!unit) return null;
    const champ = champById[unit.championId];
    if (!champ) return null;
    return (
      <div
        className={clsx(
          "hex relative h-[90px] w-[90px] overflow-hidden ring-2",
          costClass(champ.cost, "ring"),
        )}
      >
        <Image src={champ.iconUrl} alt="" fill sizes="90px" className="hex object-cover" />
      </div>
    );
  }

  if (source.kind === "item") {
    const item = itemsById[source.itemId];
    if (!item) return null;
    return (
      <div className="relative h-10 w-10 overflow-hidden rounded border border-amber-400/80 bg-zinc-900">
        <Image src={item.iconUrl} alt="" fill sizes="40px" className="object-cover" />
      </div>
    );
  }

  return null;
}
