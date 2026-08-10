# Design System

Brief reference for visual tokens and conventions in the TFT Team Builder. Use these instead of inventing new colors/spacing.

## Theme

- Dark mode by default (`<html className="dark">` in `src/app/layout.tsx`). Light tokens exist but are not the primary target.
- Tokens come from shadcn/ui's CSS variables in `src/app/globals.css` (`--background`, `--foreground`, `--card`, `--border`, etc.). Reach for them via Tailwind utilities like `bg-card`, `text-muted-foreground`, `border-border`.

## Champion cost colors

Costs 1–5 map to a fixed palette in `src/components/builder/cost-color.ts`. Always use `costClass(cost, kind)` so the mapping stays consistent.

| Cost | Palette |
|------|---------|
| 1    | zinc    |
| 2    | emerald |
| 3    | sky     |
| 4    | fuchsia |
| 5    | amber   |

## Trait tier colors

Defined as CSS vars in `globals.css` (`--color-tier-bronze` etc.). Bind via `STYLE_BG` in `TraitsPanel.tsx`.

| Tier      | Approx. hue |
|-----------|-------------|
| bronze    | warm brown  |
| silver    | neutral     |
| gold      | amber       |
| chromatic | orange      |
| prismatic | fuchsia     |

## Hex grid

- `--hex-w` drives pointy-top hex sizing; height is `--hex-w * 1.1547005` (`2 / sqrt(3)`).
- Hex shape is the `.hex` utility (clip-path) in `globals.css`.
- `--hex-gap` scales as `clamp(3px, 0.4vw, 6px)`. The horizontal pitch is `--hex-w + --hex-gap`.
- Even rows are offset by half the horizontal pitch. Vertical pitch is `sqrt(3) / 2` of the horizontal pitch, keeping horizontal and diagonal gutters equal.
- Hex width scales with viewport as `clamp(60px, 9vw, 110px)`.

## Spacing / layout

- Sidebar width: `clamp(280px, 28vw, 380px)`.
- Use shadcn's default radii (`rounded`, `rounded-md`) — don't invent new ones.
- Gaps between cards in the picker: `gap-2`; between traits chips: `gap-2`.

## Iconography

- All champion / trait / item icons are hot-linked from `raw.communitydragon.org` via `next/image`. Whitelisted in `next.config.ts`. Don't vendor.
- Always provide `alt` text (champion/item name) or `alt=""` + `aria-hidden` for purely decorative icons.

## Components

- All interactive surfaces (cards, slots, badges) use shadcn primitives from `src/components/ui/`. Add new shadcn components with `npx shadcn add <name>`.
- Drag handles are the whole card surface; click semantics (e.g. remove-on-click for item slots) must `stopPropagation` so they don't start a drag.

## A11y

- Hex cells expose `role="gridcell"` with `aria-label="Row N, Column M, <champion|empty>"`.
- Use `KeyboardSensor` from `@dnd-kit/core` so drags are keyboard-reachable.
- Decorative trait icons inside chips use `aria-hidden`; the chip text already names the trait.
