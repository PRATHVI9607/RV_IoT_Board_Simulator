"use client";

import { useSim } from "@/store/simulatorStore";
import { cn } from "@/lib/cn";

const FLOORS = 4;

/**
 * Elevator shaft visualization.
 *
 * Hardware mapping (RV-IoT board):
 *   Call buttons (inputs to CPU) : P0.16–P0.19   ← user presses these
 *   Floor indicator LEDs (outputs): P1.16–P1.19   ← CPU writes these
 *   Motor relay                   : DC Motor (PWM6 + P0.28)
 *
 * Car position is derived directly from which PORT1 output LED is HIGH.
 * If no indicator is lit, the car stays at the last known floor.
 * This makes the elevator respond correctly to any running lab program.
 */
export function ElevatorInterface() {
  const gpio = useSim((s) => s.snap.gpio);
  const duty = useSim((s) => s.snap.periph.pwmDuty[5]); // PWM6
  const pressFloor = useSim((s) => s.pressElevatorFloor);

  // Derive car floor from PORT1 indicator LEDs (P1.16-P1.19 output).
  // The LPC2148 program drives these to show the current/target floor.
  const p1out = gpio.out[1];
  const p1dir = gpio.dir[1];
  // Prefer output pins; fallback to input pins driven by external hardware.
  const p1active = (p1out & p1dir) | (gpio.pin[1] & ~p1dir);

  // Find highest-index set bit (floor F4 > F3 > F2 > F1 priority when multiple lit)
  let carFloor = 0;
  for (let f = 0; f < FLOORS; f++) {
    if (p1active & (1 << (16 + f))) carFloor = f;
  }

  // Motor direction for movement arrow
  const moving = duty > 0.01;
  const goingUp = moving && (gpio.out[0] & (1 << 28)) !== 0;

  // Which call buttons are currently driven LOW by CPU (row scanning)
  const p0out = gpio.out[0];
  const activeCall = Array.from({ length: FLOORS }, (_, f) =>
    !(p0out & (1 << (16 + f))) && (gpio.dir[0] & (1 << (16 + f))),
  );

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-stretch gap-3">
        {/* Elevator shaft */}
        <div className="relative flex w-14 flex-col-reverse overflow-hidden rounded border border-[#2a4a35] bg-[#060e07]">
          {Array.from({ length: FLOORS }, (_, f) => {
            const isCarHere = carFloor === f;
            const isLit = !!(p1active & (1 << (16 + f)));
            return (
              <div
                key={f}
                className={cn(
                  "elevator-floor-cell relative flex-1 border-t border-[#142014]",
                  f === 0 && "border-t-0",
                )}
              >
                {/* Floor label */}
                <span className="absolute left-1 top-0.5 font-mono text-[8px] text-muted/60">
                  F{f + 1}
                </span>
                {/* Floor indicator LED */}
                <span
                  className={cn(
                    "absolute right-1.5 top-1 h-2 w-2 rounded-full transition-all duration-100",
                    isLit
                      ? "bg-signal shadow-[0_0_8px_rgba(74,222,128,0.8)]"
                      : "bg-[#1a2a1a]",
                  )}
                />
                {/* Elevator car */}
                {isCarHere && (
                  <div className="absolute inset-x-1 bottom-1 top-3 rounded border border-accent/50 bg-accent/10 transition-all duration-300">
                    <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] font-bold text-accent">
                      ▣
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {/* Movement arrow */}
          {moving && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-xs text-accent live-pulse">
              {goingUp ? "↑" : "↓"}
            </div>
          )}
        </div>

        {/* Call buttons (floor order bottom→top) */}
        <div className="flex flex-col-reverse justify-around gap-1">
          {Array.from({ length: FLOORS }, (_, f) => (
            <button
              key={f}
              type="button"
              onPointerDown={() => pressFloor(f, true)}
              onPointerUp={() => pressFloor(f, false)}
              onPointerLeave={(e) => { if (e.buttons) pressFloor(f, false); }}
              className={cn(
                "h-8 w-8 rounded-full border font-mono text-[11px] font-medium transition-all",
                "select-none active:scale-90",
                activeCall[f]
                  ? "border-accent-line bg-accent-soft text-accent shadow-[0_0_8px_rgba(255,180,77,0.4)]"
                  : "border-line-strong bg-pane text-muted hover:border-accent-line hover:text-accent",
              )}
              aria-label={`Call elevator to floor ${f + 1}`}
            >
              {f + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Status row */}
      <div className="flex gap-3 font-mono text-[9px] text-muted">
        <span>CAR: F{carFloor + 1}</span>
        <span>·</span>
        <span className={moving ? "text-signal" : "text-muted/40"}>
          {moving ? (goingUp ? "GOING UP" : "GOING DOWN") : "STOPPED"}
        </span>
      </div>

      <span className="text-[9px] uppercase tracking-[0.15em] text-muted/60">
        Elevator · Call P0.16–19 · LED P1.16–19
      </span>
    </div>
  );
}
