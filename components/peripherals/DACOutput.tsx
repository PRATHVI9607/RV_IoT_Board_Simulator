"use client";

import { useSim } from "@/store/simulatorStore";

export function DACOutput() {
  const dacV = useSim((s) => s.snap.periph.dacVoltage);
  const pct = ((dacV / 3.3) * 100).toFixed(0);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        {/* Gauge arc */}
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="#1e2a3a" strokeWidth="6" />
          <circle
            cx="40" cy="40" r="34"
            fill="none"
            stroke="#00d4ff"
            strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 34 * (dacV / 3.3)} ${2 * Math.PI * 34}`}
            strokeDashoffset={2 * Math.PI * 34 * 0.25}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
          />
          <text x="40" y="36" textAnchor="middle" className="fill-fg font-mono text-[11px]" fontSize="11">
            {dacV.toFixed(2)}V
          </text>
          <text x="40" y="50" textAnchor="middle" className="fill-muted" fontSize="9">
            {pct}%
          </text>
        </svg>
      </div>
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
        DAC · P0.25 AOUT · 0–3.3V
      </span>
    </div>
  );
}
