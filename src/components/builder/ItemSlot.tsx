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
    "relative h-3.5 w-3.5 rounded-sm border border-zinc-600/80 bg-zinc-900/80 transition-colors",
    isOver && "ring-1 ring-emerald-300 border-emerald-300",
    item && "border-amber-400/70",
  );

  const inner = item ? (
    <Image src={item.iconUrl} alt={item.name} fill sizes="14px" className="rounded-sm object-cover" />
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
