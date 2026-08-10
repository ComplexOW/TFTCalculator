import type { Cost } from "@/data/types";

const RING: Record<Cost, string> = {
  1: "ring-zinc-400",
  2: "ring-emerald-400",
  3: "ring-sky-400",
  4: "ring-fuchsia-400",
  5: "ring-amber-300",
};

const BG: Record<Cost, string> = {
  1: "bg-zinc-700 text-zinc-100",
  2: "bg-emerald-700 text-emerald-50",
  3: "bg-sky-700 text-sky-50",
  4: "bg-fuchsia-700 text-fuchsia-50",
  5: "bg-amber-600 text-amber-50",
};

const BORDER: Record<Cost, string> = {
  1: "border-zinc-400",
  2: "border-emerald-400",
  3: "border-sky-400",
  4: "border-fuchsia-400",
  5: "border-amber-300",
};

const TEXT: Record<Cost, string> = {
  1: "text-zinc-300",
  2: "text-emerald-400",
  3: "text-sky-400",
  4: "text-fuchsia-400",
  5: "text-amber-300",
};

export function costClass(cost: Cost, kind: "ring" | "bg" | "border" | "text"): string {
  switch (kind) {
    case "ring":
      return RING[cost];
    case "bg":
      return BG[cost];
    case "border":
      return BORDER[cost];
    case "text":
      return TEXT[cost];
  }
}
