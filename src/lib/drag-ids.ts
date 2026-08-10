import type { HexId } from "@/components/builder/state";

export type DragSource =
  | { kind: "champion"; championId: string }
  | { kind: "placed"; cell: HexId }
  | { kind: "item"; itemId: string };

export type DropTarget =
  | { kind: "cell"; cell: HexId }
  | { kind: "slot"; cell: HexId; slot: number }
  | { kind: "picker" };

export function dragId(s: DragSource): string {
  switch (s.kind) {
    case "champion":
      return `champion:${s.championId}`;
    case "placed":
      return `placed:${s.cell}`;
    case "item":
      return `item:${s.itemId}`;
  }
}

export function dropId(t: DropTarget): string {
  switch (t.kind) {
    case "cell":
      return `cell:${t.cell}`;
    case "slot":
      return `slot:${t.cell}:${t.slot}`;
    case "picker":
      return `picker`;
  }
}

export function parseDragId(id: string): DragSource | null {
  if (id.startsWith("champion:")) return { kind: "champion", championId: id.slice("champion:".length) };
  if (id.startsWith("placed:")) return { kind: "placed", cell: id.slice("placed:".length) as HexId };
  if (id.startsWith("item:")) return { kind: "item", itemId: id.slice("item:".length) };
  return null;
}

export function parseDropId(id: string): DropTarget | null {
  if (id === "picker") return { kind: "picker" };
  if (id.startsWith("cell:")) return { kind: "cell", cell: id.slice("cell:".length) as HexId };
  if (id.startsWith("slot:")) {
    const rest = id.slice("slot:".length);
    const lastColon = rest.lastIndexOf(":");
    const cell = rest.slice(0, lastColon) as HexId;
    const slot = Number(rest.slice(lastColon + 1));
    return { kind: "slot", cell, slot };
  }
  return null;
}
