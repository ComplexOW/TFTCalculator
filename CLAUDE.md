# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Turbopack, default bundler in Next.js 16)
npm run build    # Production build (does NOT run lint automatically in Next.js 16+)
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

This is a **Next.js 16** app using the **App Router** with React 19, TypeScript, and Tailwind CSS v4.

**Stack versions with breaking changes from prior releases:**
- Next.js 16: Turbopack is the default bundler; `next build` no longer runs the linter; use `eslint` directly (not `next lint`). Read `node_modules/next/dist/docs/` for the authoritative API.
- Tailwind CSS v4: CSS config replaces `tailwind.config.js`; use `@import "tailwindcss"` and `@theme` in CSS (see `src/app/globals.css`). No `@tailwind base/components/utilities` directives.
- ESLint 9: flat config (`eslint.config.mjs`), not `.eslintrc`.

**File structure:**
- `src/app/` — App Router root. `layout.tsx` is the root layout; `page.tsx` is the home route (`/`).
- `src/app/globals.css` — Global styles and Tailwind theme tokens.
- `public/` — Static assets served from `/`.
- `next.config.ts` — Next.js configuration.

**Routing (App Router):**
- Folders define URL segments; a route is only public when `page.tsx` or `route.ts` exists in it.
- Special files: `layout`, `page`, `loading`, `error`, `not-found`, `route` (API endpoints).
- Route groups `(group)` organize without affecting URLs; private folders `_folder` are non-routable.
- `@slot` folders enable parallel routes; `(.)`, `(..)`, `(...)` patterns enable intercepted routes.

**Server vs. Client Components:**
- All components in `app/` are Server Components by default.
- Add `"use client"` at the top of a file to make it a Client Component (required for hooks, event handlers, browser APIs).
