# Damage Calculator Implementation

Last verified: 2026-08-10

## Current implementation

The damage-calculator page is a deterministic, explainable Set 17 combat projection backed by a validated CommunityDragon catalog. It provides two related outputs:

- an **opening snapshot** containing one basic attack and one authored ability cast, retained as a compact packet ledger and debugging aid;
- a **timed simulation**, which is the primary result shown by the UI and reports cumulative damage, health damage, average DPS, stats, defenses, shields, attacks, and casts at configurable checkpoints.

The simulator supports Full and Radiant item base stats, authored item mechanics, repeated attacks and casts, health thresholds, timed scaling, burns, healing, shields, Sunder, Shred, and Time to Kill (TTK). Unsupported mechanics remain explicit and make the result `partial`; descriptions are never parsed into executable formulas.

### Shipped catalog

| Field | Shipped value |
|---|---:|
| Gameplay patch | `17.8` |
| CommunityDragon source selector | `latest` |
| Source SHA-256 | `sha256:5e60c498f94cc8d1b28ce3b434b14e9c0210caba1ead7626c9ce6206937f6f9b` |
| Set mutator | `TFTSet17` |
| Champions | 62 |
| Traits | 42 |
| Full items | 39 |
| Radiant items | 36 |

`patch` and `sourcePatch` intentionally describe different things. `patch: 17.8` selects gameplay rules and is displayed in the UI. `sourcePatch: latest` records the CommunityDragon endpoint used to build the snapshot. Since `latest` is mutable, `provenance.sourceHash` identifies the exact source payload.

## Data and mechanics sources

The implementation separates numeric data from gameplay interpretation:

- [CommunityDragon](https://www.communitydragon.org/documentation) is the structured source for units, roles, base stats, mana pools, ability variables, trait tiers, item IDs, and item effect values.
- [tactics.tools Set 17 items](https://tactics.tools/info/items) is the human-readable reference used to review item wording, activation conditions, timing, and Full/Radiant behavior.
- [Riot's patch 17.8 notes](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-8/) provide the gameplay patch label.

CommunityDragon remains the runtime data source. tactics.tools descriptions guide authored rules but are not scraped at runtime and are not parsed into formulas.

### Item inclusion

- Full items must belong to the selected set, start with `TFT_Item_`, and have exactly two components. Their internal category is `standard`; the UI labels it **Full**.
- Radiant items must belong to the selected set and match `^TFT5_Item_.+Radiant$`.
- Set-specific, Support, Artifact, emblem, consumable, and non-item entries are excluded. Radiant Zz'Rot is a Support item in this snapshot and is therefore excluded.

The inclusion rules live in `scripts/fetch-tft-data.ts`; item mechanic dispatch uses stable API IDs in `src/lib/damage-calculator/item-rules.ts`.

## Data acquisition, configuration, and fallback

`npm run fetch-data` downloads:

```text
https://raw.communitydragon.org/{TFT_CDRAGON_PATCH}/cdragon/tft/en_us.json
```

It validates the source aggregate, selects one exact set mutator, projects required fields, validates the projected catalog, and atomically replaces `src/data/tft-set.json`.

| Variable | Default | Purpose |
|---|---|---|
| `TFT_PATCH` | `17.8` | Gameplay patch and rule-table selector. |
| `TFT_CDRAGON_PATCH` | `latest` | CommunityDragon path selector. |
| `TFT_SET_NUMBER` | unset | Optional positive set number. |
| `TFT_SET_MUTATOR` | `TFTSet17` | Exact set mutator to project. |
| `TFT_MIN_CHAMPIONS` | `30` | Minimum champion coverage guard. |
| `TFT_MIN_TRAITS` | `10` | Minimum trait coverage guard. |
| `TFT_MIN_STANDARD_ITEMS` | `20` | Minimum Full-item coverage guard. |
| `TFT_MIN_RADIANT_ITEMS` | `20` | Minimum Radiant-item coverage guard. |

The fetch runs before `npm run dev` and `npm run build`. A failed fetch cannot overwrite a valid catalog. Existing generated or fallback data is accepted only when its schema, patch, source selector, set mutator, and optional set number match the requested configuration. Otherwise the command fails rather than silently serving the wrong set.

## Architecture and state

The page is a Server Component that imports plain generated JSON and passes it to the interactive `DamageCalculator` Client Component. No `Map`, class, or function crosses the React Server Component boundary.

The calculation engine is pure. UI components dispatch scenario changes to the reducer; calculation derives from normalized IDs and values:

```ts
type ItemConditionState = {
  enabled: boolean;
  stacks?: number; // undefined means derive automatically
};

type DamageScenario = {
  critMode: "expected" | "force-crit" | "force-no-crit";
  combatDurationSeconds: number;
  timeCheckpoints: number[];
  attackerStartingMana?: number;
  attackerCurrentHealth?: number;
  defenderCurrentHealth?: number;
  defenderShield: number;
  enemiesTargetingAttacker: number;
  enemiesTargetingDefender: number;
  incomingHitsPerSecond: number;
  attackerItemConditions: Record<string, ItemConditionState>;
  defenderItemConditions: Record<string, ItemConditionState>;
  externalArmorSunder: { enabled: boolean; percent: number };
  externalMagicShred: { enabled: boolean; percent: number };
};
```

Defaults are a 20-second horizon and checkpoints at 0, 5, 10, 15, and 20 seconds. Checkpoints are clamped to the horizon, deduplicated, sorted, and always include the final horizon.

## Timeline, totals, DPS, and TTK

The combat projection advances in deterministic 50 ms steps. At every step it rebuilds time- and health-dependent stats, adds passive mana, advances attack progress by `attackSpeed * 0.05`, resolves due attacks, resolves a cast when mana reaches maximum, then processes periodic burns and defender healing. Final Attack Speed is capped at the Set 17 global limit of `5.0` attacks per second.

At `t = 0`, combat-start shields and already-crossed health thresholds are applied. If the attacker starts at full mana, the opening cast resolves before the zero-second checkpoint. Attacks begin only after enough attack progress accumulates.

Each checkpoint contains:

- cumulative mitigated damage and cumulative damage by physical/magic/true type;
- cumulative health damage after shields and remaining-health caps;
- `averageDps = cumulativeDamage / checkpointSeconds` (`0` at `t = 0`);
- attack and cast counts;
- attacker AD/AP/AS;
- defender HP, shield, Armor, MR, Durability, and attack-only reduction.

The primary UI total is the final checkpoint's `cumulativeDamage`; its subtitle reports `cumulativeHealthDamage`. The opening basic/cast cards and detailed packet ledger are explicitly labeled as an opening snapshot.

`timeToKillSeconds` is the first simulation timestamp at which defender Health reaches zero. Simulation stops dealing damage after death. Requested later checkpoints copy the terminal combat state; their average DPS still divides terminal cumulative damage by that later checkpoint time.

`cumulativeDamage` is damage after amplification and mitigation but before shield/Health capping, so it includes damage absorbed by shields and packet overkill. `cumulativeHealthDamage` is actual Health removed.

## Stat construction

Set 17 star multipliers are explicit:

| Star | HP | AD |
|---:|---:|---:|
| 1 | `1.00` | `1.00` |
| 2 | `1.80` | `1.50` |
| 3 | `3.24` | `2.25` |

The main stat buckets are:

```text
hpBase = baseHP * hpStarMultiplier
adBase = baseAD * adStarMultiplier

preliminaryHP = (hpBase + flatHP) * (1 + percentMaxHP)
finalHP = max(0, preliminaryHP)
finalAD = max(0, adBase * (1 + percentAD) * blueBuffMultiplier)
finalAP = max(0, (100 + flatAP) * blueBuffMultiplier)
finalAS = clamp(baseAS * (1 + percentAS), 0, 5.0)
finalArmor = baseArmor + flatArmor
finalMR = baseMR + flatMR
finalCritChance = clamp(baseCritChance + critChance, 0, 1)
finalMana = clamp(baseStartingMana + flatStartingMana, 0, maxMana)
```

Percent-max-Health is resolved before health-ratio item choices such as Hand of Justice. Blue Buff multiplies total bonus AD/AP, not base AD or the base 100 AP. Durability and attack-only damage reduction are independently capped at 95%.

CommunityDragon units are normalized per authored key: AD is fractional, while AS and CritChance are percentage points and are divided by 100. Omnivamp values are normalized to fractions.

## Exact damage packet order

The simulator uses this packet order:

```text
1. raw packet
2. eligible critical strike
3. additive Damage Amp
4. strongest active Sunder/Shred applied to base resistance
5. resistance multiplier
6. defender Durability
7. attack-only damage reduction (basic attacks only)
8. timed item shields, then manual scenario shield
9. defender Health, capped at remaining Health
10. threshold effects caused by the new Health value
```

For a raw packet `D`, additive amp `A`, effective resistance `R`, Durability `U`, and attack reduction `Q`:

```text
amplified = max(0, D) * (1 + A)

if R >= 0:
  resistanceMultiplier = 100 / (100 + R)
else:
  resistanceMultiplier = 2 - 100 / (100 - R)

afterResistance = amplified * resistanceMultiplier
afterDurability = afterResistance * (1 - U)
mitigatedAttack = afterDurability * (1 - Q)
mitigatedSpellOrTrue = afterDurability
```

True damage skips the resistance multiplier but still passes through Durability. Burn packets explicitly ignore attacker Damage Amp. Shield damage is not mitigated a second time.

Basic attacks use:

```text
force-no-crit = AD
force-crit = AD * critMultiplier
expected = AD * (1 + critChance * (critMultiplier - 1))
```

Expected crits are deterministic weights, not sampled rolls.

## Sunder and Shred

Sunder and Shred are separate, non-stacking status families:

```text
activeSunder = max(all active Sunder percentages)
activeShred = max(all active Shred percentages)
effectiveArmor = baseArmor * (1 - activeSunder / 100)
effectiveMR = baseMR * (1 - activeShred / 100)
```

- Evenshroud Sunder and Ionic Spark Shred are proximity toggles and are active before the first packet when enabled.
- External allied Sunder/Shred toggles are also active before the first packet and accept a custom percentage.
- Last Whisper Sunder and Void Staff Shred activate only after the first successful damage packet, so that first packet uses pre-proc defenses and later packets use the debuff.
- Standard on-damage debuffs use their structured duration. Radiant Last Whisper/Void Staff debuffs are treated as permanent for the simulation horizon.
- Multiple sources never add together; the strongest active source of each family wins. The UI lists every source, timing (`aura`, `on-damage`, or `external`), percentage, and active state.

## Conditional item controls

Base stats always apply. A condition toggle controls only the conditional portion of an equipped item.

Attacker controls are shown for Evenshroud proximity, Ionic Spark proximity, Giant Slayer's Tank bonus, Sunfire target range, Striker's Flail, and Titan's Resolve. Defender controls are shown for Bloodthirster, Edge of Night, Protector's Vow, Sterak's Gage, and Titan's Resolve.

For Flail and Titan:

- blank/`Auto` stacks means derive from the simulation;
- an explicit number overrides derived stacks;
- explicit zero means zero active stacks;
- disabling the condition suppresses conditional stacks/effects but not printed base stats.

Other mechanics are derived without a toggle: current Health selects Hand of Justice and Steadfast mode, unit role selects Adaptive Helm mode, enemy-targeting count drives Gargoyle, and combat time/attack count drives timed items.

## Adaptive Helm and role normalization

Set 17 internal roles remove `AD`, `AP`, or `H` prefixes; `Carry` maps to Marksman and `Reaper` maps to Assassin.

- Standard Adaptive Helm: Tank/Fighter receives Frontline Armor/MR; every other normalized role receives Backline AD/AP.
- Radiant Adaptive Helm: Tank/Fighter receives Frontline Armor/MR; Marksman/Caster receives Backline AD/AP; Assassin/Specialist receives no role-specific stat bonus.
- The structured mana-from-all-sources multiplier applies independently of the role branch.

The UI marks this as automatic and reports the active role branch in item-effect results.

## Timed and stacking items

| Mechanic | Implemented derivation |
|---|---|
| Archangel's Staff | `floor(time / interval) * APPerInterval`; default interval is 5 seconds. |
| Guinsoo's Rageblade | `floor(time) * AttackSpeedPerStack`; Set 17 stacks each second. |
| Quicksilver | `floor(time) * ProcAttackSpeed`; CC immunity has no effect because the simulator has no CC input. |
| Kraken's Fury | Attack-count stacks up to `MaxStacks`; cap adds the structured AS capstone. |
| Titan's Resolve | Manual stacks, or `min(cap, floor(attacks + time * incomingHitsPerSecond))`; stacks add AD/AP and cap adds Damage Amp. |
| Striker's Flail | Manual stacks, or critical-attack weight during the preceding 5 seconds, capped at four; expected-crit mode can produce fractional derived stacks. |
| Gargoyle Stoneplate | Armor/MR per configured enemy targeting the holder. |
| Crownguard | Combat-start max-HP shield expires at its duration; post-expiry AP then applies. |

Checkpoint AD/AP/AS columns make Archangel, Guinsoo, Quicksilver, Kraken, Titan, and Flail progression auditable.

## Tank shields, healing, stats, and mana

Tank results report maximum/starting/ending Health, starting/ending shield, Armor, MR, Durability, attack-only reduction, healing, threshold shields, and starting/ending/threshold Mana.

- Crownguard grants a combat-start timed max-Health shield.
- Bloodthirster grants its once-per-combat max-Health shield when Health crosses the structured threshold.
- Sterak grants a max-Health shield that decays linearly over its duration.
- Protector's Vow grants a threshold shield and Mana, capped by defender max Mana.
- Edge of Night clears modeled burns and on-damage defense debuffs, restores a percentage of missing Health, and makes the defender temporarily untargetable.
- Dragon's Claw heals a percentage of max Health at its interval.
- Spirit Visage heals a percentage of missing Health at its interval and applies Durability.
- Bramble Vest applies percent max Health and attack-only damage reduction.
- Steadfast Heart selects its Durability tier from current Health.

Threshold items trigger at combat start when the configured starting Health is already at or below the threshold, or once when a damage packet crosses it. Each equipped slot tracks its own once-per-combat trigger.

Timed shields are consumed before the manual scenario shield. Expired/decayed shield value is removed before the next damage packet. Defender attacks and normal damage-taken Mana generation are not simulated; Protector's Vow's explicit threshold Mana is tracked.

## Burns, Wound, Precision, and mana

### Burns and Wound

- Morellonomicon and Red Buff apply their structured burn after a successful attack or spell packet.
- Sunfire applies on its structured interval when its target-in-range toggle is enabled.
- Burn ticks begin one second after application, repeat every second, and deal the strongest active burn percentage of defender max Health as true damage. Multiple burns do not add.
- The strongest active Wound percentage reduces modeled Dragon's Claw, Spirit Visage, and threshold healing.

Bramble retaliation and Ionic Spark enemy-cast retaliation are not added to attacker-to-defender totals because the selected direction does not provide the required opposing events.

### Precision

Infinity Edge and Jeweled Gauntlet grant Precision. Ability packets can crit under the selected crit mode. Each additional Precision item adds `0.10` to spell critical-damage multiplier before expected/forced crit calculation.

### Mana and repeated casts

The timeline adds role passive mana, item ManaRegen, and attack mana. Adaptive Helm multiplies mana from all sources. Spear of Shojin adds its flat mana per attack. Nashor's Tooth adds base mana per attack plus a critical-hit portion; expected mode weights that portion by crit chance.

When attacker mana reaches max, an authored ability cast resolves and mana resets to zero. Casts repeat over the horizon. Repeated-cast DPS is a timing approximation: the simulation has no cast animation or mana-lock window, and mana regeneration/attack progress continue immediately after the zero-mana reset. The separate first-cast estimate remains available for a concise mana explanation. Specialist/champion-specific rules and Tank damage-taken mana remain explicit assumptions.

## Supported, partial, and noncombat mechanics

### Structured combat support

The following item families have authored rules for the simulator's selected attacker-to-defender scope. Full and Radiant variants use their own CommunityDragon values:

- Adaptive Helm, Archangel's Staff, Blue Buff, Crownguard, Deathblade, Rabadon's Deathcap;
- Bloodthirster, Dragon's Claw, Edge of Night, Protector's Vow, Spirit Visage, Sterak's Gage, Steadfast Heart, Warmog's Armor;
- Bramble Vest defensive stats, Evenshroud, Gargoyle Stoneplate, Giant Slayer, Hand of Justice;
- Guinsoo's Rageblade, Kraken's Fury, Quicksilver, Striker's Flail, Titan's Resolve;
- Infinity Edge/Jeweled Gauntlet Precision;
- Last Whisper, Ionic Spark's Shred aura, Void Staff, Morellonomicon, Red Buff, Sunfire;
- Spear of Shojin and Nashor's Tooth mana behavior;
- Hextech Gunblade's printed stats and Omnivamp.

### Explicitly partial or outside the selected direction

- Bramble retaliation damage is excluded; its Health and attack reduction apply.
- Ionic Spark enemy-cast retaliation is excluded; its Shred aura applies.
- Hextech Gunblade ally healing is excluded; its printed stats and Omnivamp apply.
- Attacker self-healing from Omnivamp is displayed as a final stat but is not added to this defender-focused projection.
- Quicksilver timed AS applies; CC immunity cannot change a simulation with no CC events.
- Thief's Gloves random rolls are nondeterministic, so only printed base stats apply.
- Unrecognized future item IDs receive safe printed base stats plus an unsupported issue.

Tactician's Crown, Cape, and Shield have no individual combat-stat effect and are reported as noncombat. Their board-capacity effects are outside a one-versus-one calculator.

### Champion and trait scope

Authored Set 17 ability handlers currently cover Lissandra, Rek'Sai, Gragas, Lulu, Veigar, Milio, Zoe, Twisted Fate, Karma, Viktor, Briar, and Ezreal. Handler-specific exclusions remain visible, such as extra targets, random bounces, conditional mini-projectiles, and Briar/Ezreal secondary behavior. Champions without a handler still simulate attacks, items, defenses, shields, and mana, but ability damage is omitted and the result is `partial`.

Traits generically decode only unambiguous flat AP, Armor, and MR values. Other trait variables remain partial until an authored semantic handler exists.

## Result status

- `incomplete`: attacker or defender is not selected.
- `unsupported`: catalog resolution or required structured stats prevent calculation.
- `partial`: useful supported output exists, but at least one chosen ability/item/trait/rule mechanic is explicitly omitted.
- `complete`: every selected mechanic within the documented simulator scope is supported.

The result shape always includes snapshot events, modifiers, first-cast estimate, timeline checkpoints, item-effect states, defense-debuff sources, tank stats, TTK, assumptions, warnings, and unsupported issues.

## UI integration

The tactical-workbench UI follows `DESIGN.md` and shadcn primitives. It exposes:

- champion, star, Full/Radiant item, crit, starting mana/Health, shield, duration, and checkpoint controls;
- automatic item-state cards for role-, health-, attack-, cast-, and time-derived mechanics;
- contextual condition toggles and optional manual stack overrides;
- enemy-targeting and incoming-hits inputs;
- external allied Sunder/Shred toggles and custom percentages;
- timeline total, health damage, average DPS, TTK, type totals, AD/AP/AS, HP/shield, defenses, and reduction values;
- active item states, tank survival, debuff provenance, snapshot packet ledger, modifiers, assumptions, and unsupported issues.

Controls are accessible switches, labels, number inputs, pressed states, tables, definition lists, and polite live regions. Wide timeline data scrolls within its container without causing page-level overflow.

## Validation and operating commands

```text
npm run fetch-data
npm test
npm run lint
npm run typecheck
npm run build
```

Tests cover reducer normalization, resistance and crit formulas, shield ordering and overkill, star scaling, item units, Adaptive role families, Blue Buff ordering, health-ratio conditions, Archangel/Guinsoo checkpoints, strongest-only Sunder/Shred, first-packet proc timing, Precision, threshold shields and Mana, Edge of Night, burn/Wound healing, duplicate slot identity, mana modifiers, authored abilities, and complete/partial/unsupported status.

Browser smoke testing on Set 17 patch 17.8 verified Adaptive Helm, Bloodthirster, Archangel's Staff, Guinsoo's Rageblade, threshold toggles, external Sunder, timeline/tank/debuff result sections, zero console errors, and no page-level overflow at a 375 px viewport.

## Adapting to future patches and sets

The catalog, reducer, simulator shape, and UI are set-agnostic; semantic rule tables are intentionally patch-aware.

1. Set `TFT_PATCH`, `TFT_CDRAGON_PATCH`, and an exact `TFT_SET_MUTATOR`.
2. Review CommunityDragon membership and API-name category rules; update count guards without broadening the catalog accidentally.
3. Generate and review a matching provenance hash and full fallback.
4. Add a patch/set rule table for star multipliers, role normalization, and mana generation.
5. Map changed Full/Radiant item API IDs and verify every structured key/scale against the current [tactics.tools item reference](https://tactics.tools/info/items) and patch notes.
6. Add or update authored item rules for changed timing, thresholds, stack caps, debuff duration, shield decay, and Radiant differences.
7. Add champion ability and trait handlers keyed by stable API ID and exact variable names.
8. Add golden tests for intermediate stats, packet order, checkpoints, and first-packet behavior before marking results complete.

Unknown patches and sets remain partial/unsupported instead of silently inheriting Set 17 mechanics as authoritative.

## Trust model

- CommunityDragon is a community convenience source, not an official Riot API contract.
- tactics.tools is a community mechanics reference, not a runtime API dependency.
- `latest` changes in place; reproducibility depends on the stored source hash or a pinned source path.
- Numeric availability does not establish semantic meaning.
- Display descriptions are never executed.
- Results are authoritative only for the catalog hash, implemented patch rules, authored handlers, documented simulation scope, and tested modifier order.

## Sources

- [tactics.tools: Set 17 items](https://tactics.tools/info/items)
- [CommunityDragon documentation](https://www.communitydragon.org/documentation)
- [CommunityDragon asset/data documentation](https://github.com/CommunityDragon/Docs/blob/master/assets.md)
- [CommunityDragon TFT aggregate directory](https://raw.communitydragon.org/latest/cdragon/tft/)
- [Latest English TFT aggregate](https://raw.communitydragon.org/latest/cdragon/tft/en_us.json)
- [Patch-pinned aggregate URL pattern](https://raw.communitydragon.org/{PATCH}/cdragon/tft/en_us.json)
- [Riot Games: Teamfight Tactics patch 17.8 notes](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-8/)
- [Riot Games: Roles Revamped and Item Changes](https://teamfighttactics.leagueoflegends.com/en-sg/news/game-updates/roles-revamped-and-item-changes/)
