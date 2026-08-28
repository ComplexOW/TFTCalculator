"use client";

import Image from "next/image";
import { useDroppable } from "@dnd-kit/core";
import { clsx } from "clsx";
import type { HexId } from "./state";
import { dropId } from "@/lib/drag-ids";
import { useTeamBuilder, useItemsById } from "./state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  cell: HexId;
  slot: number;
  itemId: string | null;
};

export function ItemSlot({ cell, slot, itemId }: Props) {
  const { dispatch } = useTeamBuilder();
  const itemsById = useItemsById();
  const item = itemId ? itemsById[itemId] : null;

  const { isOver, setNodeRef } = useDroppable({
    id: dropId({ kind: "slot", cell, slot }),
    data: { kind: "slot", cell, slot },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (itemId) {
      dispatch({ type: "DETACH_ITEM", cell, slot });
    }
  };

  const buttonClassName = clsx(
    "relative h-6 w-6 shrink-0 rounded-sm border shadow-inner transition-colors",
    "border-zinc-400/40 bg-zinc-950/95 hover:border-zinc-200/60",
    isOver && "border-emerald-300 ring-2 ring-emerald-300",
    item && "border-amber-300/90",
  );

  const inner = item ? (
    <Image src={item.iconUrl} alt={item.name} fill sizes="24px" className="rounded-sm object-cover" />
  ) : null;

  const button = (
    <button
      type="button"
      ref={setNodeRef}
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={item ? `Remove ${item.name}` : `Empty item slot ${slot + 1}`}
      className={buttonClassName}
    >
      {inner}
    </button>
  );

  if (!item) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="top" className="max-w-xs text-xs">
        <div className="font-semibold">{item.name}</div>
        <div className="text-muted-foreground text-[11px]">click to remove</div>
      </TooltipContent>
    </Tooltip>
  );
}
