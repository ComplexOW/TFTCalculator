"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { TftSet } from "@/data/types";

export const BOARD_ROWS = 4;
export const BOARD_COLS = 7;
export const ITEM_SLOTS = 3;
export const STORAGE_KEY = "tft-team-builder.v1";

export type HexId = `${number}-${number}`;

export type PlacedUnit = {
  championId: string;
  items: (string | null)[];
};

export type BoardState = {
  cells: Record<HexId, PlacedUnit | null>;
};

export type Action =
  | { type: "PLACE_FROM_PICKER"; cell: HexId; championId: string }
  | { type: "MOVE_ON_BOARD"; from: HexId; to: HexId }
  | { type: "REMOVE"; cell: HexId }
  | { type: "ATTACH_ITEM"; cell: HexId; itemId: string; slot?: number }
  | { type: "DETACH_ITEM"; cell: HexId; slot: number }
  | { type: "CLEAR_BOARD" }
  | { type: "HYDRATE"; state: BoardState };

export function makeHexId(row: number, col: number): HexId {
  return `${row}-${col}` as HexId;
}

export function parseHexId(id: HexId): { row: number; col: number } {
  const [r, c] = id.split("-").map(Number);
  return { row: r, col: c };
}

export function emptyBoard(): BoardState {
  const cells: Record<string, PlacedUnit | null> = {};
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      cells[makeHexId(r, c)] = null;
    }
  }
  return { cells };
}

function reducer(state: BoardState, action: Action): BoardState {
  switch (action.type) {
    case "HYDRATE":
      return action.state;
    case "CLEAR_BOARD":
      return emptyBoard();
    case "PLACE_FROM_PICKER": {
      return {
        cells: {
          ...state.cells,
          [action.cell]: { championId: action.championId, items: Array(ITEM_SLOTS).fill(null) },
        },
      };
    }
    case "MOVE_ON_BOARD": {
      if (action.from === action.to) return state;
      const fromUnit = state.cells[action.from];
      if (!fromUnit) return state;
      const toUnit = state.cells[action.to];
      return {
        cells: {
          ...state.cells,
          [action.from]: toUnit ?? null,
          [action.to]: fromUnit,
        },
      };
    }
    case "REMOVE": {
      if (!state.cells[action.cell]) return state;
      return { cells: { ...state.cells, [action.cell]: null } };
    }
    case "ATTACH_ITEM": {
      const unit = state.cells[action.cell];
      if (!unit) return state;
      const items = [...unit.items];
      const targetSlot =
        typeof action.slot === "number" ? action.slot : items.findIndex((s) => s === null);
      if (targetSlot < 0 || targetSlot >= ITEM_SLOTS) return state;
      items[targetSlot] = action.itemId;
      return { cells: { ...state.cells, [action.cell]: { ...unit, items } } };
    }
    case "DETACH_ITEM": {
      const unit = state.cells[action.cell];
      if (!unit) return state;
      const items = [...unit.items];
      if (action.slot < 0 || action.slot >= ITEM_SLOTS) return state;
      items[action.slot] = null;
      return { cells: { ...state.cells, [action.cell]: { ...unit, items } } };
    }
    default:
      return state;
  }
}

type TeamBuilderContextValue = {
  state: BoardState;
  dispatch: React.Dispatch<Action>;
  data: TftSet;
  isHydrated: boolean;
};

const TeamBuilderContext = createContext<TeamBuilderContextValue | null>(null);

export function TeamBuilderProvider({
  data,
  children,
}: {
  data: TftSet;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, emptyBoard());
  const [isHydrated, setHydrated] = useState(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BoardState;
        if (parsed && parsed.cells) {
          dispatch({ type: "HYDRATE", state: parsed });
        }
      }
    } catch {
      // ignore corrupt storage
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore quota errors
      }
    }, 150);
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [state, isHydrated]);

  const value = useMemo(
    () => ({ state, dispatch, data, isHydrated }),
    [state, data, isHydrated],
  );

  return <TeamBuilderContext.Provider value={value}>{children}</TeamBuilderContext.Provider>;
}

export function useTeamBuilder() {
  const ctx = useContext(TeamBuilderContext);
  if (!ctx) throw new Error("useTeamBuilder must be used within TeamBuilderProvider");
  return ctx;
}

export function useChampionsById() {
  const { data } = useTeamBuilder();
  return useMemo(() => {
    const map: Record<string, (typeof data.champions)[number]> = {};
    for (const c of data.champions) map[c.id] = c;
    return map;
  }, [data]);
}

export function useItemsById() {
  const { data } = useTeamBuilder();
  return useMemo(() => {
    const map: Record<string, (typeof data.items)[number]> = {};
    for (const i of data.items) map[i.id] = i;
    return map;
  }, [data]);
}

export function useClearBoard() {
  const { dispatch } = useTeamBuilder();
  return useCallback(() => dispatch({ type: "CLEAR_BOARD" }), [dispatch]);
}
