import type { BoardState } from "@/components/builder/state";
import type { TftSet, TraitStyle } from "@/data/types";

export type ActiveTrait = {
  traitId: string;
  name: string;
  description: string;
  iconUrl: string;
  count: number;
  activeTier: { min: number; style: TraitStyle } | null;
  nextTier: { min: number; style: TraitStyle } | null;
  tiers: { min: number; style: TraitStyle }[];
};

const TIER_RANK: Record<TraitStyle, number> = {
  bronze: 1,
  silver: 2,
  chromatic: 3,
  gold: 4,
  prismatic: 5,
};

export function getBoardChampionCounts(cells: BoardState["cells"]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const unit of Object.values(cells)) {
    if (!unit) continue;
    counts.set(unit.championId, (counts.get(unit.championId) ?? 0) + 1);
  }
  return counts;
}

export function getActiveTraits(cells: BoardState["cells"], data: TftSet): ActiveTrait[] {
  const uniqueChamps = new Set<string>();
  for (const unit of Object.values(cells)) {
    if (unit) uniqueChamps.add(unit.championId);
  }

  const traitCounts = new Map<string, number>();
  for (const championId of uniqueChamps) {
    const champ = data.champions.find((c) => c.id === championId);
    if (!champ) continue;
    for (const traitName of champ.traits) {
      traitCounts.set(traitName, (traitCounts.get(traitName) ?? 0) + 1);
    }
  }

  const active: ActiveTrait[] = [];
  for (const [traitName, count] of traitCounts) {
    const trait = data.traits.find((t) => t.name === traitName);
    if (!trait) continue;
    let activeTier: ActiveTrait["activeTier"] = null;
    let nextTier: ActiveTrait["nextTier"] = null;
    for (const tier of trait.tiers) {
      if (count >= tier.min) activeTier = tier;
      else if (!nextTier) nextTier = tier;
    }
    active.push({
      traitId: trait.id,
      name: trait.name,
      description: trait.description,
      iconUrl: trait.iconUrl,
      count,
      activeTier,
      nextTier,
      tiers: trait.tiers,
    });
  }

  active.sort((a, b) => {
    const aActive = a.activeTier ? 1 : 0;
    const bActive = b.activeTier ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    const aRank = a.activeTier ? TIER_RANK[a.activeTier.style] : 0;
    const bRank = b.activeTier ? TIER_RANK[b.activeTier.style] : 0;
    if (aRank !== bRank) return bRank - aRank;
    if (a.count !== b.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });

  return active;
}

export function getPlacedUnitCount(cells: BoardState["cells"]): number {
  let n = 0;
  for (const unit of Object.values(cells)) if (unit) n++;
  return n;
}
