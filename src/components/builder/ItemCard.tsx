"use client";

import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";
import type { Item } from "@/data/types";
import { dragId } from "@/lib/drag-ids";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = { item: Item };

export function ItemCard({ item }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId({ kind: "item", itemId: item.id }),
    data: { kind: "item", itemId: item.id },
  });

  const card = (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-label={item.name}
      className={clsx(
        "relative aspect-square cursor-grab touch-none overflow-hidden rounded border border-amber-500/60 bg-zinc-900",
        isDragging ? "opacity-30" : "hover:scale-105 transition-transform",
      )}
    >
      <Image src={item.iconUrl} alt={item.name} fill sizes="48px" className="object-cover" />
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={card} />
      <TooltipContent side="top" className="max-w-xs text-xs">
        <div className="font-semibold mb-1">{item.name}</div>
        <div className="text-muted-foreground">{item.description || "No description."}</div>
      </TooltipContent>
    </Tooltip>
  );
}
