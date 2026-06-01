"use client";

import { useMemo } from "react";
import { useSim } from "@/store/simulatorStore";
import { PanelHeader } from "@/components/ui/Panel";
import { hexN } from "@/lib/cn";

const CH_LABELS = [
  "P0.0", "P0.1", "P0.2", "P0.3", "P0.4", "P0.5", "P0.6", "P0.7",
];
const COLORS = ["#00d4ff","#ffd600","#4ade80","#f87171","#ff944d","#b44dff","#4dc3ff","#ffd1a0"];

/**
 * 8-channel digital logic analyzer.
 * Shows the current bit state of P0.0–P0.7 as horizontal waveform bars.
 * History is stored in the Zustand store's logicHistory ring buffer.
 */
export function LogicAnalyzer() {
  const history = useSim((s) => s.logicHistory);
  const gpio = useSim((s) => s.snap.gpio);

  const W = 680;
  const CH_H = 24;
  const LABEL_W = 52;
  const plotW = W - LABEL_W;

  const rows = useMemo(() => {
    return CH_LABELS.map((_, ch) => {
      const mask = 1 << ch;
      return history.map(h => (h & mask) !== 0);
    });
  }, [history]);

  const currentByte = gpio.pin[0] & 0xff;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Logic Analyzer · 8-ch P0.0–P0.7"
        right={
          <span className="font-mono text-[10px] text-mono">
            PORT0[7:0] = 0x{hexN(currentByte, 2)}
          </span>
        }
      />
      <div className="overflow-auto p-2">
        <svg width={W} height={CH_LABELS.length * CH_H + 4} style={{ minWidth: W }}>
          {CH_LABELS.map((label, ch) => {
            const y = ch * CH_H + 2;
            const mid = y + CH_H * 0.5;
            const hi = y + 2;
            const lo = y + CH_H - 2;
            const pts: string[] = [];
            let prev: boolean | null = null;
            rows[ch].forEach((bit, i) => {
              const x = LABEL_W + (i / Math.max(1, rows[ch].length - 1)) * plotW;
              if (prev === null) { pts.push(`M ${x} ${bit ? hi : lo}`); }
              else if (bit !== prev) { pts.push(`L ${x} ${prev ? hi : lo}`); pts.push(`L ${x} ${bit ? hi : lo}`); }
              else { pts.push(`L ${x} ${bit ? hi : lo}`); }
              prev = bit;
            });

            const currentBit = (currentByte & (1 << ch)) !== 0;
            return (
              <g key={label}>
                <text x={LABEL_W - 4} y={mid + 3} textAnchor="end" className="font-mono" fontSize="9" fill={COLORS[ch]}>{label}</text>
                {pts.length > 0 && <path d={pts.join(" ")} fill="none" stroke={COLORS[ch]} strokeWidth="1.5" />}
                <circle cx={W - 6} cy={currentBit ? hi : lo} r="3" fill={currentBit ? COLORS[ch] : "#1e2a3a"} />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
