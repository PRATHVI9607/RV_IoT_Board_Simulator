"use client";

import { useSim } from "@/store/simulatorStore";
import { cn } from "@/lib/cn";

/**
 * DC Motor visual — DRV8801.
 * Speed from PWM6 (CH6) duty cycle, Direction from P0.28 (DIR pin).
 * Animation speed maps PWM duty to rotation rate.
 */
export function DCMotor() {
  const duty = useSim((s) => s.snap.periph.pwmDuty[5]); // PWM6 = index 5
  const gpio = useSim((s) => s.snap.gpio);
  const dir = (gpio.out[0] & (1 << 28)) !== 0;
  const speedPct = Math.round(duty * 100);
  const current = ((duty * 1.5)).toFixed(2);

  // Map duty 0–1 to CSS animation duration 5s–0.2s
  const animDuration = duty < 0.01 ? "none" : `${Math.max(0.2, 5 - duty * 4.8).toFixed(2)}s`;
  const animDir = dir ? "normal" : "reverse";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-24 w-24">
        {/* Motor body */}
        <div className="absolute inset-0 rounded-full border-2 border-[#2a3444] bg-gradient-to-br from-[#1e2430] to-[#0e1117]" />
        {/* Shaft / disk that rotates */}
        <div
          className="absolute inset-3 rounded-full border border-accent/30 bg-gradient-to-br from-[#24303f] to-[#131b26]"
          style={
            duty > 0.01
              ? { animation: `spin ${animDuration} linear infinite ${animDir}` }
              : undefined
          }
        >
          <div className="absolute left-1/2 top-1/2 h-1 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded bg-accent/60" />
          <div className="absolute left-1/2 top-1/2 h-3/4 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-accent/40" />
        </div>
        {/* Speed label */}
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 font-mono text-[9px] text-muted">
          {speedPct}%
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-center">
        <span className="font-mono text-[10px] text-muted">DIR</span>
        <span className="font-mono text-[10px] text-muted">CURRENT</span>
        <span className="font-mono text-[11px] text-accent">{dir ? "CW" : "CCW"}</span>
        <span className="font-mono text-[11px] text-accent">{current} A</span>
      </div>
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
        DC Motor · DRV8801 · PWM6=P0.9 · DIR=P0.28
      </span>
    </div>
  );
}
