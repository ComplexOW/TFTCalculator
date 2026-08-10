"use client";

import { BOARD_COLS, BOARD_ROWS, makeHexId } from "./state";
import { HexCell } from "./HexCell";

export function HexBoard() {
  const rows = Array.from({ length: BOARD_ROWS }, (_, r) => r);
  const cols = Array.from({ length: BOARD_COLS }, (_, c) => c);

  return (
    <div
      role="grid"
      aria-label="TFT board"
      className="board-grid mx-auto select-none"
      style={
        {
          "--hex-w": "clamp(60px, 9vw, 110px)",
          "--hex-h": "calc(var(--hex-w) * 1.1547005)",
          "--hex-gap": "clamp(3px, 0.4vw, 6px)",
        } as React.CSSProperties
      }
    >
      {rows.map((r) => (
        <div
          key={r}
          role="row"
          className="flex"
          style={{
            columnGap: "var(--hex-gap)",
            marginTop:
              r === 0
                ? 0
                : "calc((var(--hex-w) + var(--hex-gap)) * 0.8660254 - var(--hex-h))",
            paddingLeft:
              r % 2 === 1 ? "calc((var(--hex-w) + var(--hex-gap)) / 2)" : 0,
          }}
        >
          {cols.map((c) => (
            <HexCell key={`${r}-${c}`} cell={makeHexId(r, c)} row={r} col={c} />
          ))}
        </div>
      ))}
    </div>
  );
}
