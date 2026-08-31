"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  useState,
  type ReactNode,
} from "react";
import { TFT_DATA_SCHEMA_VERSION, type TftSet } from "@/data/types";

const USE_CACHE_STORAGE_KEY = "tft-data.use-cache";
const DATA_CACHE_STORAGE_KEY = "tft-data.cache.v1";
const USE_CACHE_EVENT = "tft-data-use-cache";

function subscribeUseCache(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(USE_CACHE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(USE_CACHE_EVENT, onStoreChange);
  };
}

function readUseCache() {
  try {
    return window.localStorage.getItem(USE_CACHE_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

function getServerUseCacheSnapshot() {
  return true;
}

type TftDataContextValue = {
  data: TftSet;
  isUsingCache: boolean;
  isRefreshing: boolean;
  error: string | null;
  setUseCache: (useCache: boolean) => void;
  refreshCache: () => Promise<void>;
};

const TftDataContext = createContext<TftDataContextValue | null>(null);

export function TftDataProvider({
  initialData,
  children,
}: {
  initialData: TftSet;
  children: ReactNode;
}) {
  const [data, setData] = useState<TftSet>(initialData);
  const isUsingCache = useSyncExternalStore(
    subscribeUseCache,
    readUseCache,
    getServerUseCacheSnapshot,
  );
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (useCache: boolean) => {
    if (useCache) {
      try {
        const raw = window.localStorage.getItem(DATA_CACHE_STORAGE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as TftSet;
          if (cached?.schemaVersion === TFT_DATA_SCHEMA_VERSION) {
            setData(cached);
            setError(null);
          }
        }
      } catch {
        // Ignore corrupt cache data and keep the bundled initial data.
      }
      return;
    }

    const response = await fetch("/api/tft-data?source=live");

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Failed to load TFT data (HTTP ${response.status})`);
    }

    const nextData = (await response.json()) as TftSet;
    setData(nextData);
    setError(null);

    try {
      window.localStorage.setItem(DATA_CACHE_STORAGE_KEY, JSON.stringify(nextData));
    } catch {
      // Ignore storage quota/availability errors.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      loadData(isUsingCache).catch((loadError: unknown) => {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : String(loadError);
          setError(message);
          console.error("[tft-data]", message);
        }
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isUsingCache, loadData]);

  const setUseCache = useCallback((useCache: boolean) => {
    try {
      window.localStorage.setItem(USE_CACHE_STORAGE_KEY, useCache ? "1" : "0");
      window.dispatchEvent(new Event(USE_CACHE_EVENT));
    } catch {
      // Ignore storage access errors.
    }
  }, []);

  const refreshCache = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch("/api/tft-data", { method: "POST" });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Failed to refresh TFT data cache (HTTP ${response.status})`);
      }

      const nextData = (await response.json()) as TftSet;
      setData(nextData);

      try {
        window.localStorage.setItem(DATA_CACHE_STORAGE_KEY, JSON.stringify(nextData));
      } catch {
        // Ignore storage quota/availability errors.
      }
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
      setError(message);
      throw refreshError;
    } finally {
      setRefreshing(false);
    }
  }, []);

  const value = useMemo<TftDataContextValue>(
    () => ({
      data,
      isUsingCache,
      isRefreshing,
      error,
      setUseCache,
      refreshCache,
    }),
    [data, isUsingCache, isRefreshing, error, setUseCache, refreshCache],
  );

  return <TftDataContext.Provider value={value}>{children}</TftDataContext.Provider>;
}

export function useTftData() {
  const context = useContext(TftDataContext);
  if (!context) {
    throw new Error("useTftData must be used within TftDataProvider");
  }
  return context;
}
