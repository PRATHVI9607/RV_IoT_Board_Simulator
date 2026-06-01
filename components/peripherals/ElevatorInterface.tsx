"use client";

import { useSim } from "@/store/simulatorStore";
import { cn } from "@/lib/cn";

const FLOORS = 4;

/**
 * Elevator shaft visualization.
 * Floor buttons → GPIO P0.16-P0.19 (call inputs).
 * Floor indicators → PORT1 LEDs.
 * Car position inferred from motor direction + PWM duty.
 */
export function ElevatorInterface() {
  const gpio = useSim((s) => s.snap.gpio);
  const duty = useSim((s) => s.snap.periph.pwmDuty[5]); // PWM6 DC motor
  const dir = (gpio.out[0] & (1 << 28)) !== 0; // P0.28 = DIR
  const pressFloor = useSim((s) => s.pressElevatorFloor);
  const carFloor = useSim((s) => s.elevatorFloor);

  // Floor indicators from PORT1 bits
  const p1 = gpio.out[1];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4">
        {/* Shaft */}
        <div className="relative flex h-48 w-16 flex-col-reverse rounded border border-[#2a4a35] bg-[#0a1008]">
          {Array.from({ length: FLOORS }, (_, f) => {
            const isCarHere = carFloor === f;
            const isLit = !!(p1 & (1 << (16 + f)));
            return (
              <div
                key={f}
                className={cn(
                  "relative flex-1 border-t border-[#1a2a1a] px-1",
                  f === 0 && "border-t-0",
                )}
              >
                {/* Floor label */}
                <span className="absolute left-1 top-0.5 font-mono text-[8px] text-muted">F{f + 1}</span>
                {/* Indicator LED */}
                <span
                  className={cn(
                    "absolute right-1 top-1 h-2 w-2 rounded-full border",
                    isLit
                      ? "border-signal bg-signal shadow-[0_0_6px_rgba(74,222,128,0.7)]"
                      : "border-line-strong bg-transparent",
                  )}
                />
                {/* Elevator car */}
                {isCarHere && (
                  <div className="absolute inset-x-2 inset-y-1 rounded border border-accent/60 bg-accent-soft transition-all duration-500">
                    <div className="flex h-full items-center justify-center">
                      <span className="font-mono text-[9px] text-accent">CAR</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {/* Moving indicator */}
          {duty > 0.01 && (
            <span className="absolute right-0 top-1/2 font-mono text-[9px] text-accent">
              {dir ? "↑" : "↓"}
            </span>
          )}
        </div>

        {/* Call buttons */}
        <div className="flex flex-col-reverse justify-around">
          {Array.from({ length: FLOORS }, (_, f) => (
            <button
              key={f}
              onPointerDown={() => pressFloor(f, true)}
              onPointerUp={() => pressFloor(f, false)}
              className={cn(
                "h-7 w-7 rounded-full border font-mono text-[10px] transition-all",
                "border-line-strong bg-pane text-muted hover:border-accent-line hover:text-accent",
                "active:scale-90 active:bg-accent-soft",
              )}
              aria-label={`Call elevator to floor ${f + 1}`}
            >
              {f + 1}
            </button>
          ))}
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
        Elevator · Call P0.16–19 · LED P1.16–19 · Motor PWM6
      </span>
    </div>
  );
}
