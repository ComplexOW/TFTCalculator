"use client";

import { useDroppable } from "@dnd-kit/core";
import { clsx } from "clsx";
import type { HexId } from "./state";
import { dropId } from "@/lib/drag-ids";
import { PlacedChampion } from "./PlacedChampion";
import { useTeamBuilder, useChampionsById } from "./state";

type Props = {
  cell: HexId;
  row: number;
  col: number;
};

export function HexCell({ cell, row, col }: Props) {
  const { state } = useTeamBuilder();
  const champById = useChampionsById();
  const unit = state.cells[cell];
  const champion = unit ? champById[unit.championId] : null;

  const { isOver, setNodeRef } = useDroppable({
    id: dropId({ kind: "cell", cell }),
    data: { kind: "cell", cell },
  });

  const ariaLabel = champion
    ? `Row ${row + 1}, Column ${col + 1}, ${champion.name}`
    : `Row ${row + 1}, Column ${col + 1}, empty`;

  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={ariaLabel}
      className={clsx(
        "hex relative grid place-items-center",
        "h-[var(--hex-h)] w-[var(--hex-w)]",
        "bg-zinc-800/70 transition-colors",
        isOver && !unit && "bg-emerald-700/60 ring-2 ring-emerald-300",
        isOver && unit && "bg-amber-700/60",
      )}
    >
      {unit && champion ? (
        <PlacedChampion cell={cell} unit={unit} champion={champion} />
      ) : (
        <span className="text-xs text-zinc-500 select-none">
          {row + 1}-{col + 1}
        </span>
      )}
    </div>
  );
}
