import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import {
  TFT_DATA_SCHEMA_VERSION,
  type AbilityValue,
  type Cost,
  type DataValue,
  type ItemCategory,
  type TftSet,
  type TraitStyle,
} from "../src/data/types";

const DEFAULT_PATCH = "17.8";
const DEFAULT_CDRAGON_PATCH = "latest";
const DEFAULT_SET_MUTATOR = "TFTSet17";
const LOCALE = "en_us";
const PATCH_PATTERN = /^(?:latest|pbe|\d+\.\d+(?:\.\d+)?)$/;
const OUT_PATH = resolve(__dirname, "..", "src", "data", "tft-set.json");
const FALLBACK_PATH = resolve(__dirname, "..", "src", "data", "tft-set.fallback.json");
const REFRESH = process.argv.includes("--refresh") || process.env.TFT_REFRESH === "1";
const MINIMUM_COVERAGE = {
  champions: 30,
  traits: 10,
  standardItems: 20,
  radiantItems: 20,
} as const;
type CoverageThresholds = { [Key in keyof typeof MINIMUM_COVERAGE]: number };
type RequestedSnapshot = Pick<
  ReturnType<typeof readConfiguration>,
  "patch" | "sourcePatch" | "setMutator" | "setNumber"
>;

type SourceItem = z.infer<typeof sourceItemSchema>;

/**
 * CommunityDragon has no stable, explicit item-category field. Keep the current
 * data contract in one place so a future set can update it without changing the
 * projection. Set membership is checked separately before these rules run.
 */
const ITEM_CATEGORY_RULES: ReadonlyArray<{
  category: ItemCategory;
  matches: (item: SourceItem) => boolean;
}> = [
  {
    category: "standard",
    matches: (item) => /^TFT_Item_/.test(item.apiName) && item.composition?.length === 2,
  },
  {
    category: "radiant",
    // Intentionally anchored: broad "Radiant" matching includes Set mechanics,
    // consumables, and legacy ids such as Zz'Rot Portal that are explicitly
    // tagged as Support items. Prefer the semantic tag over an id-only guess.
    matches: (item) =>
      /^TFT5_Item_.+Radiant$/.test(item.apiName) && !hasNonRadiantCategoryTag(item),
  },
];

const NON_RADIANT_CATEGORY_TAG =
  /\[(?:support|artifact|consumable|component|emblem)\s+item\]/i;

const abilityValueSchema = z.union([z.number(), z.string(), z.null()]);
const dataValueSchema = z.union([abilityValueSchema, z.boolean()]);

const sourceAbilitySchema = z
  .object({
    name: z.string().nullable().optional(),
    desc: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    variables: z
      .array(
        z.object({
          name: z.string(),
          value: z.array(abilityValueSchema).nullable(),
        }),
      )
      .optional(),
  })
  .passthrough();

const sourceChampionSchema = z
  .object({
    apiName: z.string(),
    characterName: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    cost: z.number(),
    traits: z.array(z.string()),
    role: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    squareIcon: z.string().nullable().optional(),
    tileIcon: z.string().nullable().optional(),
    stats: z.object({
      armor: z.number().nullable(),
      attackSpeed: z.number().nullable(),
      critChance: z.number().nullable(),
      critMultiplier: z.number().nullable(),
      damage: z.number().nullable(),
      hp: z.number().nullable(),
      initialMana: z.number().nullable(),
      magicResist: z.number().nullable(),
      mana: z.number().nullable(),
      range: z.number().nullable(),
    }),
    ability: sourceAbilitySchema.nullable().optional(),
  })
  .passthrough();

const sourceTraitSchema = z
  .object({
    apiName: z.string(),
    name: z.string().nullable().optional(),
    desc: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    effects: z.array(
      z
        .object({
          minUnits: z.number().nullable().optional(),
          maxUnits: z.number().nullable().optional(),
          style: z.number().nullable().optional(),
          variables: z.record(z.string(), abilityValueSchema).optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

const sourceSetSchema = z
  .object({
    mutator: z.string(),
    name: z.string().nullable().optional(),
    number: z.number(),
    champions: z.array(sourceChampionSchema),
    traits: z.array(sourceTraitSchema),
    items: z.array(z.string()),
  })
  .passthrough();

const sourceItemSchema = z
  .object({
    apiName: z.string(),
    name: z.string().nullable().optional(),
    desc: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    composition: z.array(z.string()).nullable().optional(),
    unique: z.boolean().nullable().optional(),
    effects: z.record(z.string(), dataValueSchema).optional(),
  })
  .passthrough();

const sourcePayloadSchema = z
  .object({
    items: z.array(sourceItemSchema),
    setData: z.array(sourceSetSchema),
    sets: z.unknown(),
  })
  .passthrough();

const costSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
const traitStyleSchema = z.enum(["bronze", "silver", "gold", "chromatic", "prismatic"]);
const iconUrlSchema = z.string().url().refine((url) => url.includes("raw.communitydragon.org/"));

const projectedSetSchema = z
  .object({
    schemaVersion: z.literal(TFT_DATA_SCHEMA_VERSION),
    provenance: z.object({
      source: z.literal("CommunityDragon"),
      sourceUrl: z.string().url(),
      patch: z.string().regex(PATCH_PATTERN),
      sourcePatch: z.string().regex(PATCH_PATTERN),
      locale: z.string().min(1),
      setMutator: z.string().min(1),
      fetchedAt: z.string().datetime(),
      sourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    }),
    setNumber: z.number().int().positive(),
    setName: z.string().min(1),
    champions: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          cost: costSchema,
          traits: z.array(z.string().min(1)).min(1),
          iconUrl: iconUrlSchema,
          role: z.string().min(1),
          stats: z.object({
            health: z.number().positive(),
            attackDamage: z.number().nonnegative(),
            armor: z.number(),
            magicResist: z.number(),
            attackSpeed: z.number().positive(),
            range: z.number().nonnegative(),
            startingMana: z.number().nonnegative(),
            maxMana: z.number().nonnegative(),
            critChance: z.number().nonnegative(),
            critMultiplier: z.number().nonnegative(),
          }),
          ability: z.object({
            name: z.string().min(1),
            description: z.string(),
            iconUrl: iconUrlSchema,
            variables: z.array(
              z.object({
                name: z.string().min(1),
                rawValues: z.array(abilityValueSchema),
                starValues: z.tuple([abilityValueSchema, abilityValueSchema, abilityValueSchema]),
              }),
            ),
          }),
        }),
      )
      .min(MINIMUM_COVERAGE.champions),
    traits: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          description: z.string(),
          iconUrl: iconUrlSchema,
          tiers: z
            .array(
              z.object({
                min: z.number().nonnegative(),
                max: z.number().nonnegative(),
                style: traitStyleSchema,
                variables: z.record(z.string(), abilityValueSchema),
              }),
            )
            .min(1),
        }),
      )
      .min(MINIMUM_COVERAGE.traits),
    items: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          description: z.string(),
          iconUrl: iconUrlSchema,
          unique: z.boolean(),
          category: z.enum(["standard", "radiant"]),
          composition: z.array(z.string()),
          effects: z.record(z.string(), dataValueSchema),
        }),
      )
      .min(MINIMUM_COVERAGE.standardItems + MINIMUM_COVERAGE.radiantItems),
  })
  .superRefine((set, context) => {
    for (const [label, values] of [
      ["champion", set.champions],
      ["trait", set.traits],
      ["item", set.items],
    ] as const) {
      const ids = values.map((value) => value.id);
      if (new Set(ids).size !== ids.length) {
        context.addIssue({ code: "custom", message: `Duplicate ${label} id in projection` });
      }
    }
    for (const [category, minimum] of [
      ["standard", MINIMUM_COVERAGE.standardItems],
      ["radiant", MINIMUM_COVERAGE.radiantItems],
    ] as const) {
      if (set.items.filter((item) => item.category === category).length < minimum) {
        context.addIssue({
          code: "custom",
          message: `Projection has fewer than ${minimum} ${category} items`,
        });
      }
    }
    for (const item of set.items.filter((candidate) => candidate.category === "radiant")) {
      if (NON_RADIANT_CATEGORY_TAG.test(item.description)) {
        context.addIssue({
          code: "custom",
          message: `Radiant projection contains explicitly non-Radiant item ${item.id}`,
        });
      }
    }
  });

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${name} "${raw}"; expected a positive integer`);
  }
  if (value < fallback) {
    throw new Error(`${name} cannot be lower than the safety floor of ${fallback}`);
  }
  return value;
}

function readConfiguration() {
  const patch = process.env.TFT_PATCH?.trim() || DEFAULT_PATCH;
  if (!PATCH_PATTERN.test(patch)) {
    throw new Error(`Invalid TFT_PATCH "${patch}"; expected latest, pbe, or a numeric patch`);
  }

  const sourcePatch = process.env.TFT_CDRAGON_PATCH?.trim() || DEFAULT_CDRAGON_PATCH;
  if (!PATCH_PATTERN.test(sourcePatch)) {
    throw new Error(
      `Invalid TFT_CDRAGON_PATCH "${sourcePatch}"; expected latest, pbe, or a numeric patch`,
    );
  }

  const rawSetNumber = process.env.TFT_SET_NUMBER?.trim();
  const setNumber = rawSetNumber ? Number(rawSetNumber) : null;
  if (setNumber !== null && (!Number.isInteger(setNumber) || setNumber <= 0)) {
    throw new Error(`Invalid TFT_SET_NUMBER "${rawSetNumber}"; expected a positive integer`);
  }

  const explicitMutator = process.env.TFT_SET_MUTATOR?.trim();
  const setMutator = explicitMutator || (setNumber ? `TFTSet${setNumber}` : DEFAULT_SET_MUTATOR);
  if (!/^TFTSet\d+$/.test(setMutator)) {
    throw new Error(`Invalid TFT_SET_MUTATOR "${setMutator}"; only standard TFTSet<number> mutators are allowed`);
  }

  return {
    patch,
    sourcePatch,
    setNumber,
    setMutator,
    minimumCoverage: {
      champions: readPositiveInteger("TFT_MIN_CHAMPIONS", MINIMUM_COVERAGE.champions),
      traits: readPositiveInteger("TFT_MIN_TRAITS", MINIMUM_COVERAGE.traits),
      standardItems: readPositiveInteger(
        "TFT_MIN_STANDARD_ITEMS",
        MINIMUM_COVERAGE.standardItems,
      ),
      radiantItems: readPositiveInteger("TFT_MIN_RADIANT_ITEMS", MINIMUM_COVERAGE.radiantItems),
    },
  };
}

function assetPathToUrl(path: string, patch: string): string {
  const normalized = path
    .trim()
    .replace(/^\/+/, "")
    .toLowerCase()
    .replace(/\.(?:tex|dds)$/i, ".png");
  return `https://raw.communitydragon.org/${patch}/game/${normalized}`;
}

function styleFromCode(code: number): TraitStyle {
  switch (code) {
    case 1:
      return "bronze";
    case 3:
      return "silver";
    case 4:
      return "gold";
    case 5:
      return "prismatic";
    case 6:
      return "chromatic";
    default:
      return "bronze";
  }
}

function stripMarkup(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function hasNonRadiantCategoryTag(item: SourceItem): boolean {
  return NON_RADIANT_CATEGORY_TAG.test(stripMarkup(item.desc ?? ""));
}

function classifyItem(item: SourceItem): ItemCategory | null {
  return ITEM_CATEGORY_RULES.find((rule) => rule.matches(item))?.category ?? null;
}

function asStarValues(values: AbilityValue[]): [AbilityValue, AbilityValue, AbilityValue] {
  return [values[1] ?? null, values[2] ?? null, values[3] ?? null];
}

function hasCompleteStats(
  stats: z.infer<typeof sourceChampionSchema>["stats"],
): stats is { [Key in keyof typeof stats]: number } {
  return Object.values(stats).every((value) => typeof value === "number");
}

function selectSet(
  sets: z.infer<typeof sourceSetSchema>[],
  setMutator: string,
  configuredSetNumber: number | null,
) {
  const matches = sets.filter((set) => set.mutator === setMutator);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one standard set for mutator ${setMutator}; found ${matches.length}. ` +
        "Set TFT_SET_MUTATOR explicitly if CommunityDragon changed its identifiers.",
    );
  }
  const selected = matches[0];
  if (configuredSetNumber !== null && selected.number !== configuredSetNumber) {
    throw new Error(
      `TFT_SET_MUTATOR ${setMutator} resolved to set ${selected.number}, not TFT_SET_NUMBER ${configuredSetNumber}`,
    );
  }
  return selected;
}

function project(
  source: z.infer<typeof sourcePayloadSchema>,
  sourceUrl: string,
  sourceHash: string,
  patch: string,
  sourcePatch: string,
  setMutator: string,
  configuredSetNumber: number | null,
  minimumCoverage: CoverageThresholds,
): TftSet {
  const selectedSet = selectSet(source.setData, setMutator, configuredSetNumber);

  const champions = selectedSet.champions
    .filter(
      (champion) =>
        typeof champion.name === "string" &&
        champion.name.trim().length > 0 &&
        Number.isInteger(champion.cost) &&
        champion.cost >= 1 &&
        champion.cost <= 5 &&
        champion.traits.length > 0 &&
        hasCompleteStats(champion.stats) &&
        champion.ability &&
        typeof champion.ability.name === "string" &&
        champion.ability.name.trim().length > 0 &&
        Boolean(champion.squareIcon || champion.tileIcon || champion.icon),
    )
    .map((champion) => {
      const ability = champion.ability!;
      const stats = champion.stats;
      if (!hasCompleteStats(stats)) throw new Error(`Incomplete stats for ${champion.apiName}`);
      const championIcon = champion.squareIcon || champion.tileIcon || champion.icon!;
      const abilityIcon = ability.icon || championIcon;
      return {
        id: champion.apiName,
        name: champion.name!.trim(),
        cost: champion.cost as Cost,
        traits: [...champion.traits],
        iconUrl: assetPathToUrl(championIcon, sourcePatch),
        role: champion.role?.trim() || "Unknown",
        stats: {
          health: stats.hp,
          attackDamage: stats.damage,
          armor: stats.armor,
          magicResist: stats.magicResist,
          attackSpeed: stats.attackSpeed,
          range: stats.range,
          startingMana: stats.initialMana,
          maxMana: stats.mana,
          critChance: stats.critChance,
          critMultiplier: stats.critMultiplier,
        },
        ability: {
          name: ability.name!.trim(),
          description: stripMarkup(ability.desc ?? ""),
          iconUrl: assetPathToUrl(abilityIcon, sourcePatch),
          variables: (ability.variables ?? [])
            .filter(
              (variable): variable is typeof variable & { value: AbilityValue[] } =>
                Array.isArray(variable.value),
            )
            .map((variable) => ({
              name: variable.name,
              rawValues: [...variable.value],
              starValues: asStarValues(variable.value),
            })),
        },
      };
    })
    .sort((left, right) => left.cost - right.cost || left.name.localeCompare(right.name));

  const usedTraitNames = new Set(champions.flatMap((champion) => champion.traits));
  const traits = selectedSet.traits
    .filter(
      (trait) =>
        typeof trait.name === "string" &&
        usedTraitNames.has(trait.name) &&
        typeof trait.icon === "string" &&
        trait.effects.length > 0,
    )
    .map((trait) => ({
      id: trait.apiName,
      name: trait.name!.trim(),
      description: stripMarkup(trait.desc ?? ""),
      iconUrl: assetPathToUrl(trait.icon!, sourcePatch),
      tiers: trait.effects
        .filter(
          (effect): effect is typeof effect & { minUnits: number; maxUnits: number; style: number } =>
            typeof effect.minUnits === "number" &&
            typeof effect.maxUnits === "number" &&
            typeof effect.style === "number",
        )
        .map((effect) => ({
          min: effect.minUnits,
          max: effect.maxUnits,
          style: styleFromCode(effect.style),
          variables: { ...(effect.variables ?? {}) },
        }))
        .sort((left, right) => left.min - right.min),
    }))
    .filter((trait) => trait.tiers.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));

  const selectedItemIds = new Set(selectedSet.items);
  const items = source.items
    .filter(
      (item) =>
        selectedItemIds.has(item.apiName) &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        typeof item.icon === "string" &&
        classifyItem(item) !== null,
    )
    .map((item) => ({
      id: item.apiName,
      name: item.name!.trim(),
      description: stripMarkup(item.desc ?? ""),
      iconUrl: assetPathToUrl(item.icon!, sourcePatch),
      unique: Boolean(item.unique),
      category: classifyItem(item)!,
      composition: [...(item.composition ?? [])],
      effects: { ...(item.effects ?? {}) } as Record<string, DataValue>,
    }))
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category) || left.name.localeCompare(right.name),
    );

  const categoryCounts = Object.fromEntries(
    (["standard", "radiant"] as const).map((category) => [
      category,
      items.filter((item) => item.category === category).length,
    ]),
  );
  console.log(
    `[fetch-tft-data] selected ${selectedSet.number} (${selectedSet.mutator}); ` +
      `${champions.length} champions, ${traits.length} traits, ` +
      `${categoryCounts.standard} standard items, ${categoryCounts.radiant} radiant items`,
  );

  const coverage = {
    champions: champions.length,
    traits: traits.length,
    standardItems: categoryCounts.standard,
    radiantItems: categoryCounts.radiant,
  };
  for (const key of Object.keys(minimumCoverage) as Array<keyof typeof minimumCoverage>) {
    if (coverage[key] < minimumCoverage[key]) {
      throw new Error(
        `Coverage guard rejected projection: ${key}=${coverage[key]}, minimum=${minimumCoverage[key]}`,
      );
    }
  }

  return projectedSetSchema.parse({
    schemaVersion: TFT_DATA_SCHEMA_VERSION,
    provenance: {
      source: "CommunityDragon",
      sourceUrl,
      patch,
      sourcePatch,
      locale: LOCALE,
      setMutator: selectedSet.mutator,
      fetchedAt: new Date().toISOString(),
      sourceHash,
    },
    setNumber: selectedSet.number,
    setName: selectedSet.name?.trim() || `Set ${selectedSet.number}`,
    champions,
    traits,
    items,
  });
}

function parseProjectionFile(path: string): TftSet | null {
  if (!existsSync(path)) return null;
  try {
    return projectedSetSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    console.warn(`[fetch-tft-data] invalid cached data at ${path}: ${formatError(error)}`);
    return null;
  }
}

function matchesRequestedSnapshot(snapshot: TftSet, requested: RequestedSnapshot): boolean {
  return (
    snapshot.provenance.patch === requested.patch &&
    snapshot.provenance.sourcePatch === requested.sourcePatch &&
    snapshot.provenance.setMutator === requested.setMutator &&
    (requested.setNumber === null || snapshot.setNumber === requested.setNumber)
  );
}

function describeSnapshot(snapshot: TftSet): string {
  return (
    `patch=${snapshot.provenance.patch}, sourcePatch=${snapshot.provenance.sourcePatch}, ` +
    `mutator=${snapshot.provenance.setMutator}, setNumber=${snapshot.setNumber}`
  );
}

function describeRequest(requested: RequestedSnapshot): string {
  return (
    `patch=${requested.patch}, sourcePatch=${requested.sourcePatch}, ` +
    `mutator=${requested.setMutator}, setNumber=${requested.setNumber ?? "any"}`
  );
}

function formatError(error: unknown): string {
  if (error instanceof z.ZodError) {
    const sample = error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    return `${error.issues.length} validation issue(s): ${sample}`;
  }
  return error instanceof Error ? error.message : String(error);
}

function writeAtomically(path: string, data: TftSet) {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, { flag: "wx" });
    renameSync(temporaryPath, path);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}

function restoreLastKnownGood(cause: unknown, requested: RequestedSnapshot) {
  console.warn(`[fetch-tft-data] fetch/projection failed: ${formatError(cause)}`);

  const existing = parseProjectionFile(OUT_PATH);
  if (existing && matchesRequestedSnapshot(existing, requested)) {
    console.warn(`[fetch-tft-data] retaining last-known-good ${OUT_PATH}`);
    return;
  }
  if (existing) {
    console.warn(
      `[fetch-tft-data] ignoring mismatched last-known-good (${describeSnapshot(existing)})`,
    );
  }

  const fallback = parseProjectionFile(FALLBACK_PATH);
  if (fallback && matchesRequestedSnapshot(fallback, requested)) {
    console.warn(`[fetch-tft-data] restoring validated fallback ${FALLBACK_PATH}`);
    writeAtomically(OUT_PATH, fallback);
    return;
  }
  if (fallback) {
    console.warn(`[fetch-tft-data] ignoring mismatched fallback (${describeSnapshot(fallback)})`);
  }

  throw new Error(
    `No validated cached snapshot matches requested ${describeRequest(requested)}. ` +
      `Original failure: ${formatError(cause)}`,
    { cause },
  );
}

async function main() {
  const { patch, sourcePatch, setNumber, setMutator, minimumCoverage } = readConfiguration();
  const requested = { patch, sourcePatch, setMutator, setNumber };

  if (!REFRESH) {
    const cached = parseProjectionFile(OUT_PATH);
    if (cached && matchesRequestedSnapshot(cached, requested)) {
      console.log(
        `[fetch-tft-data] using cached ${OUT_PATH} (${describeSnapshot(cached)})`,
      );
      return;
    }
    if (cached) {
      console.warn(
        `[fetch-tft-data] ignoring mismatched cache (${describeSnapshot(cached)})`,
      );
    }
  }

  const sourceUrl = `https://raw.communitydragon.org/${sourcePatch}/cdragon/tft/${LOCALE}.json`;
  console.log(`[fetch-tft-data] fetching ${sourceUrl}`);

  try {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`CommunityDragon returned HTTP ${response.status}`);
    const rawText = await response.text();
    const sourceHash = `sha256:${createHash("sha256").update(rawText).digest("hex")}`;
    const source = sourcePayloadSchema.parse(JSON.parse(rawText));
    const output = project(
      source,
      sourceUrl,
      sourceHash,
      patch,
      sourcePatch,
      setMutator,
      setNumber,
      minimumCoverage,
    );
    writeAtomically(OUT_PATH, output);
    console.log(`[fetch-tft-data] wrote ${OUT_PATH} (schema ${output.schemaVersion})`);
  } catch (error) {
    restoreLastKnownGood(error, { patch, sourcePatch, setMutator, setNumber });
  }
}

main().catch((error) => {
  console.error("[fetch-tft-data] fatal:", error);
  process.exitCode = 1;
});
