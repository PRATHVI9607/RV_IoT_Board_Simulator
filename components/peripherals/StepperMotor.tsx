"use client";

import { useSim, getEngine } from "@/store/simulatorStore";

/**
 * Stepper Motor visual.
 * Monitors coil patterns on P0.16–P0.19 (Motor 1) or P0.20–P0.23 (Motor 2).
 * Detects full-step sequence to infer direction and step count.
 */
export function StepperMotor({ id }: { id: 1 | 2 }) {
  const stepData = useSim((s) => s.stepperState[id - 1]);
  const angle = stepData?.angle ?? 0;
  const steps = stepData?.steps ?? 0;
  const cw = stepData?.cw ?? true;
  const coils = stepData?.coils ?? 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="80" height="80" viewBox="0 0 80 80" aria-label={`Stepper motor ${id}`}>
        {/* Body */}
        <circle cx="40" cy="40" r="36" fill="#141a24" stroke="#2a3444" strokeWidth="2" />
        {/* Coil indicators */}
        {[0,1,2,3].map(i => (
          <circle
            key={i}
            cx={40 + 28 * Math.cos((i * Math.PI / 2) - Math.PI / 4)}
            cy={40 + 28 * Math.sin((i * Math.PI / 2) - Math.PI / 4)}
            r="5"
            fill={coils & (1 << i) ? "#4ade80" : "#1a2030"}
            stroke="#2a3444"
            strokeWidth="1"
          />
        ))}
        {/* Shaft */}
        <circle cx="40" cy="40" r="10" fill="#1e2a3a" stroke="#3a4860" strokeWidth="1.5" />
        {/* Indicator line (rotates with angle) */}
        <line
          x1="40" y1="40"
          x2={40 + 8 * Math.cos((angle * Math.PI) / 180 - Math.PI / 2)}
          y2={40 + 8 * Math.sin((angle * Math.PI) / 180 - Math.PI / 2)}
          stroke="#ffb44d" strokeWidth="2" strokeLinecap="round"
        />
      </svg>
      <div className="grid grid-cols-3 gap-x-3 text-center">
        <div>
          <div className="font-mono text-[9px] text-muted">STEPS</div>
          <div className="font-mono text-[11px] text-accent">{steps}</div>
        </div>
        <div>
          <div className="font-mono text-[9px] text-muted">ANGLE</div>
          <div className="font-mono text-[11px] text-accent">{(angle % 360).toFixed(1)}°</div>
        </div>
        <div>
          <div className="font-mono text-[9px] text-muted">DIR</div>
          <div className="font-mono text-[11px] text-accent">{cw ? "CW" : "CCW"}</div>
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
        Stepper {id} · ULN2803 · P0.{id === 1 ? "16–19" : "20–23"}
      </span>
    </div>
  );
}
