"use client";

import { useSim } from "@/store/simulatorStore";

/**
 * Servo motor arm visual.
 * Reads PWM4 (P0.21, servo 1) or PWM5 (P0.22, servo 2) duty cycle.
 * Standard servo: 5% duty → 0°, 10% duty → 180°.
 */
export function ServoMotor({ id }: { id: 1 | 2 }) {
  const duty = useSim((s) => s.snap.periph.pwmDuty[id === 1 ? 3 : 4]); // PWM4/5
  // duty 0.05→0°, 0.10→180°. Clamp to [0,180].
  const angle = Math.max(0, Math.min(180, (duty - 0.05) * 3600));
  const pulseMs = (duty * 20).toFixed(2);

  const armAngle = angle - 90; // rotate from -90° to +90° about vertical
  const armRad = (armAngle * Math.PI) / 180;
  const armX = 40 + 30 * Math.sin(armRad);
  const armY = 52 - 30 * Math.cos(armRad);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="80" height="80" viewBox="0 0 80 80" aria-label={`Servo ${id}`}>
        {/* Body */}
        <rect x="10" y="50" width="60" height="24" rx="4" fill="#141a24" stroke="#2a3444" strokeWidth="1.5" />
        {/* Range arc */}
        <path
          d={`M 10 52 A 30 30 0 0 1 70 52`}
          fill="none" stroke="#1e2a3a" strokeWidth="2"
        />
        {/* 0° / 180° ticks */}
        <line x1="10" y1="52" x2="10" y2="44" stroke="#2a3a4a" strokeWidth="1" />
        <line x1="70" y1="52" x2="70" y2="44" stroke="#2a3a4a" strokeWidth="1" />
        {/* Arm */}
        <line
          x1="40" y1="52" x2={armX} y2={armY}
          stroke="#ffb44d" strokeWidth="3" strokeLinecap="round"
        />
        {/* Pivot */}
        <circle cx="40" cy="52" r="5" fill="#1e2a3a" stroke="#3a4860" strokeWidth="1.5" />
        <circle cx="40" cy="52" r="2" fill="#ffb44d" />
      </svg>
      <div className="grid grid-cols-2 gap-x-4 text-center">
        <div>
          <div className="font-mono text-[9px] text-muted">ANGLE</div>
          <div className="font-mono text-[11px] text-accent">{angle.toFixed(0)}°</div>
        </div>
        <div>
          <div className="font-mono text-[9px] text-muted">PULSE</div>
          <div className="font-mono text-[11px] text-accent">{pulseMs} ms</div>
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
        Servo {id} · PWM{id === 1 ? 4 : 5} · P0.{id === 1 ? 21 : 22}
      </span>
    </div>
  );
}
