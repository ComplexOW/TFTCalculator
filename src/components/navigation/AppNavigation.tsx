"use client";

import Link from "next/link";
import { Calculator, LayoutGrid, Swords } from "lucide-react";
import { usePathname } from "next/navigation";
import { DataCacheControls } from "@/components/data/DataCacheControls";
import { cn } from "@/lib/utils";

const links = [
  {
    href: "/",
    label: "Team Builder",
    icon: LayoutGrid,
  },
  {
    href: "/damage-calculator",
    label: "Damage Calculator",
    icon: Calculator,
  },
] as const;

function isActiveRoute(pathname: string, href: (typeof links)[number]["href"]) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground focus:not-sr-only focus:absolute focus:left-3 focus:top-2 focus:z-[60] focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-14 w-full items-center justify-between gap-2 px-3 sm:px-4">
        <Link
          href="/"
          aria-label="TFT Lab home"
          className="group flex shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm transition-colors group-hover:bg-accent">
            <Swords className="size-4" aria-hidden="true" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight min-[440px]:inline">
            TFT Lab
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav aria-label="Primary navigation">
            <ul className="flex items-center gap-1">
              {links.map(({ href, label, icon: Icon }) => {
                const active = isActiveRoute(pathname, href);

                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-label={label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex size-10 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring min-[400px]:w-auto min-[400px]:px-2.5 sm:px-3 sm:text-sm",
                        active &&
                          "bg-accent text-accent-foreground shadow-sm ring-1 ring-inset ring-border",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      <span className="hidden min-[400px]:inline">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <DataCacheControls />
        </div>
      </div>
    </header>
  );
}
