"use client";

import Image from "next/image";
import { useMemo } from "react";
import { clsx } from "clsx";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useTeamBuilder } from "./state";
import { getActiveTraits } from "@/lib/selectors";
import type { TraitStyle } from "@/data/types";

const STYLE_BG: Record<TraitStyle, string> = {
  bronze: "bg-[var(--color-tier-bronze)]/30 text-amber-200 border-amber-700",
  silver: "bg-[var(--color-tier-silver)]/30 text-zinc-100 border-zinc-400",
  gold: "bg-[var(--color-tier-gold)]/30 text-amber-100 border-amber-300",
  chromatic: "bg-[var(--color-tier-chromatic)]/30 text-orange-100 border-orange-400",
  prismatic: "bg-[var(--color-tier-prismatic)]/30 text-fuchsia-100 border-fuchsia-300",
};

export function TraitsPanel() {
  const { state, data } = useTeamBuilder();
  const traits = useMemo(() => getActiveTraits(state.cells, data), [state.cells, data]);

  if (traits.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
        Place champions on the board to see active traits.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Active Traits
      </h2>
      <ul className="flex flex-wrap gap-2">
        {traits.map((t) => {
          const chip = (
            <div
              className={clsx(
                "flex items-center gap-2 rounded-md border px-2 py-1 text-sm transition-opacity",
                t.activeTier
                  ? STYLE_BG[t.activeTier.style]
                  : "border-zinc-700 bg-zinc-900/50 text-muted-foreground opacity-70",
              )}
            >
              <Image
                src={t.iconUrl}
                alt=""
                width={20}
                height={20}
                className="size-5"
                aria-hidden
              />
              <span className="font-medium">{t.name}</span>
              <span className="font-mono tabular-nums">
                {t.count}
                {t.nextTier && <span className="opacity-60"> / {t.nextTier.min}</span>}
              </span>
            </div>
          );
          return (
          <li key={t.traitId}>
            <HoverCard>
              <HoverCardTrigger render={chip} delay={120} />
              <HoverCardContent side="bottom" className="w-72 text-xs">
                <div className="mb-2 flex items-center gap-2">
                  <Image src={t.iconUrl} alt="" width={24} height={24} aria-hidden />
                  <div className="font-semibold">{t.name}</div>
                </div>
                <ul className="space-y-0.5">
                  {t.tiers.map((tier) => (
                    <li
                      key={tier.min}
                      className={clsx(
                        "flex justify-between rounded px-2 py-0.5",
                        t.activeTier?.min === tier.min && STYLE_BG[tier.style],
                      )}
                    >
                      <span className="capitalize">{tier.style}</span>
                      <span className="font-mono">{tier.min}</span>
                    </li>
                  ))}
                </ul>
                {t.description && (
                  <p className="mt-2 text-muted-foreground line-clamp-6">{t.description}</p>
                )}
              </HoverCardContent>
            </HoverCard>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
