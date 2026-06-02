"use client";

import { useSim } from "@/store/simulatorStore";

// Segment bit mapping: a=0, b=1, c=2, d=3, e=4, f=5, g=6, dp=7
const SEG_PATHS: Record<string, string> = {
  a:  "M 6 2 L 22 2 L 20 4 L 8 4 Z",
  b:  "M 22 4 L 24 6 L 22 20 L 20 18 Z",
  c:  "M 22 20 L 24 22 L 22 36 L 20 34 Z",
  d:  "M 8 34 L 20 34 L 22 36 L 6 36 Z",
  e:  "M 4 22 L 6 20 L 8 34 L 6 36 Z",
  f:  "M 4 6 L 6 4 L 8 18 L 6 20 Z",
  g:  "M 8 18 L 20 18 L 22 20 L 20 22 L 8 22 L 6 20 Z",
  dp: "M 26 32 A 3 3 0 1 1 26 31.99 Z",
};

const ON_COLOR = "#ff6600";
const OFF_COLOR = "#1a0800";

/**
 * Render one digit. The RV-IoT display is COMMON-ANODE (active-low): a segment
 * is lit when its bit is 0. Bit order a=0,b=1,c=2,d=3,e=4,f=5,g=6,dp=7.
 */
function Digit({ pattern }: { pattern: number }) {
  const segs = ["a", "b", "c", "d", "e", "f", "g", "dp"];
  return (
    <svg width="30" height="40" viewBox="0 0 30 40" aria-hidden>
      {segs.map((seg, i) => {
        const on = (pattern & (1 << i)) === 0; // active-low
        return (
          <path
            key={seg}
            d={SEG_PATHS[seg]}
            fill={on ? ON_COLOR : OFF_COLOR}
            className={on ? "seg-on" : undefined}
          />
        );
      })}
    </svg>
  );
}

/**
 * 5-digit serial-shift-register driven 7-segment display (common-anode).
 * Driven by GPIO: DATA=P0.19, CLK=P0.20, STROBE=P0.30.
 */
export function SevenSegDisplay() {
  const displayBuffer = useSim((s) => s.sevenSegBuffer);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1.5 rounded-md border border-[#2a1800] bg-[#0a0500] px-3 py-2.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Digit key={i} pattern={displayBuffer[i] ?? 0xff} />
        ))}
      </div>
      <span className="text-[9px] uppercase tracking-[0.14em] text-muted/70">
        5-digit · DATA P0.19 · CLK P0.20 · STROBE P0.30
      </span>
    </div>
  );
}
