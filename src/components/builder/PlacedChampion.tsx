"use client";

import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";
import type { HexId, PlacedUnit } from "./state";
import type { Champion } from "@/data/types";
import { dragId } from "@/lib/drag-ids";
import { ItemSlot } from "./ItemSlot";
import { costClass } from "./cost-color";

type Props = {
  cell: HexId;
  unit: PlacedUnit;
  champion: Champion;
};

export function PlacedChampion({ cell, unit, champion }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId({ kind: "placed", cell }),
    data: { kind: "placed", cell },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        "hex relative grid h-full w-full place-items-center cursor-grab touch-none",
        "ring-2 ring-inset",
        costClass(champion.cost, "ring"),
      )}
      aria-label={`${champion.name}, cost ${champion.cost}`}
    >
      <Image
        src={champion.iconUrl}
        alt={champion.name}
        fill
        sizes="(max-width: 768px) 80px, 120px"
        className="hex object-cover pointer-events-none"
      />
      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 pb-1">
        {unit.items.map((itemId, i) => (
          <ItemSlot key={i} cell={cell} slot={i} itemId={itemId} />
        ))}
      </div>
      <div
        className={clsx(
          "absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0 rounded-b px-1.5 text-[10px] font-semibold leading-tight",
          costClass(champion.cost, "bg"),
        )}
      >
        {champion.name}
      </div>
    </div>
  );
}
