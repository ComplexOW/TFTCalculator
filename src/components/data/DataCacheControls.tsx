"use client";

import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTftData } from "./tft-data-context";

export function DataCacheControls() {
  const { isUsingCache, setUseCache, refreshCache, isRefreshing } = useTftData();

  const handleRefresh = async () => {
    try {
      await refreshCache();
      toast.success("TFT data cache refreshed");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Could not refresh TFT data cache: ${message}`, { duration: 5000 });
    }
  };

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Cache</span>
      <button
        type="button"
        role="switch"
        aria-checked={isUsingCache}
        aria-label="Use cached TFT data"
        title="Use cached TFT data when starting the app"
        onClick={() => setUseCache(!isUsingCache)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isUsingCache ? "border-rose-400/60 bg-rose-500/70" : "border-border bg-muted",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-0.5 top-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform",
            isUsingCache ? "translate-x-[17px]" : "translate-x-0",
          )}
        />
      </button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={isRefreshing}
        title="Fetch the latest TFT data and update the local cache"
        className="hidden md:inline-flex"
      >
        <RefreshCw className={cn(isRefreshing && "animate-spin")} aria-hidden />
        {isRefreshing ? "Refreshing..." : "Refresh cache"}
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleRefresh}
        disabled={isRefreshing}
        aria-label="Refresh TFT data cache"
        title="Refresh TFT data cache"
        className="md:hidden"
      >
        <RefreshCw className={cn(isRefreshing && "animate-spin")} aria-hidden />
      </Button>
    </div>
  );
}
