"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  TeamBuilderProvider,
  useTeamBuilder,
  type HexId,
} from "./state";
import type { TftSet } from "@/data/types";
import { HexBoard } from "./HexBoard";
import { ChampionPicker } from "./ChampionPicker";
import { TraitsPanel } from "./TraitsPanel";
import { DragGhost } from "./DragGhost";
import { parseDragId, parseDropId, type DragSource } from "@/lib/drag-ids";
import { getPlacedUnitCount } from "@/lib/selectors";

const hybridCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length > 0) return within;
  return closestCenter(args);
};

function ClearButton() {
  const { state, dispatch } = useTeamBuilder();
  const placed = getPlacedUnitCount(state.cells);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={placed === 0}
      onClick={() => {
        dispatch({ type: "CLEAR_BOARD" });
        toast.success("Board cleared", { duration: 1800 });
      }}
    >
      Clear board ({placed})
    </Button>
  );
}

function BuilderShell() {
  const { dispatch, state } = useTeamBuilder();
  const [activeSource, setActiveSource] = useState<DragSource | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const src = parseDragId(String(e.active.id));
    setActiveSource(src);
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveSource(null);
      const src = parseDragId(String(e.active.id));
      const tgt = e.over ? parseDropId(String(e.over.id)) : null;
      if (!src || !tgt) return;

      if (src.kind === "champion") {
        if (tgt.kind === "cell") {
          dispatch({ type: "PLACE_FROM_PICKER", cell: tgt.cell, championId: src.championId });
        }
        return;
      }

      if (src.kind === "placed") {
        if (tgt.kind === "cell") {
          dispatch({ type: "MOVE_ON_BOARD", from: src.cell, to: tgt.cell });
        } else if (tgt.kind === "picker") {
          dispatch({ type: "REMOVE", cell: src.cell });
        }
        return;
      }

      if (src.kind === "item") {
        if (tgt.kind === "slot") {
          const unit = state.cells[tgt.cell];
          if (!unit) {
            toast.error("Drop on a placed unit's slot.", { duration: 1500 });
            return;
          }
          if (unit.items[tgt.slot]) {
            toast.error("Slot already filled. Click an equipped item to remove it.", {
              duration: 1800,
            });
            return;
          }
          dispatch({ type: "ATTACH_ITEM", cell: tgt.cell, itemId: src.itemId, slot: tgt.slot });
        } else if (tgt.kind === "cell") {
          const unit = state.cells[tgt.cell as HexId];
          if (!unit) {
            toast.error("Place a champion before attaching items.", { duration: 1800 });
            return;
          }
          const emptySlot = unit.items.findIndex((s) => s === null);
          if (emptySlot < 0) {
            toast.error("All 3 slots are full.", { duration: 1800 });
            return;
          }
          dispatch({ type: "ATTACH_ITEM", cell: tgt.cell as HexId, itemId: src.itemId });
        }
      }
    },
    [dispatch, state.cells],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={hybridCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveSource(null)}
    >
      <div className="flex min-h-0 w-full flex-1">
        <ChampionPicker />
        <main className="flex flex-1 flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b border-border px-4 py-2">
            <div>
              <h1 className="text-base font-semibold">TFT Team Builder</h1>
            </div>
            <ClearButton />
          </header>
          <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
            <div className="flex flex-col items-center">
              <HexBoard />
            </div>
            <TraitsPanel />
          </div>
        </main>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeSource ? <DragGhost source={activeSource} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export function TeamBuilder({ data }: { data: TftSet }) {
  return (
    <TeamBuilderProvider data={data}>
      <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/60 px-4 text-xs text-muted-foreground">
          <span>
            Set {data.setNumber}
            {data.setName ? ` — ${data.setName}` : ""}
          </span>
          <span className="hidden sm:inline">
            Drag champions onto the hex grid. Drop items on placed units. Drag a placed unit to the
            sidebar to remove it.
          </span>
        </div>
        <BuilderShell />
      </div>
    </TeamBuilderProvider>
  );
}
