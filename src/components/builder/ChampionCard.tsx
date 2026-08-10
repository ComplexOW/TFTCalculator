"use client";

import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";
import type { Champion } from "@/data/types";
import { dragId } from "@/lib/drag-ids";
import { costClass } from "./cost-color";

type Props = { champion: Champion };

export function ChampionCard({ champion }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId({ kind: "champion", championId: champion.id }),
    data: { kind: "champion", championId: champion.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-label={`${champion.name}, cost ${champion.cost}`}
      title={`${champion.name} — ${champion.traits.join(", ")}`}
      className={clsx(
        "group relative aspect-square cursor-grab touch-none overflow-hidden rounded border-2 transition-transform",
        costClass(champion.cost, "border"),
        isDragging ? "opacity-30" : "hover:scale-105",
      )}
    >
      <Image
        src={champion.iconUrl}
        alt={champion.name}
        fill
        sizes="(max-width: 1024px) 64px, 80px"
        className="object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-[10px] font-medium leading-tight text-white truncate">
        {champion.name}
      </div>
      <div
        className={clsx(
          "absolute top-0.5 left-0.5 rounded px-1 text-[10px] font-bold",
          costClass(champion.cost, "bg"),
        )}
      >
        {champion.cost}
      </div>
    </div>
  );
}
