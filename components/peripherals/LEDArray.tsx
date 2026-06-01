"use client";

import { useSim } from "@/store/simulatorStore";
import { LED_PINS } from "@/lib/boardConfig";
import { cn } from "@/lib/cn";

/**
 * 8-LED bank. An LED is lit when its pin is an output driven HIGH.
 * Green glow is a live signal indicator (not decoration) — it tracks the pin.
 */
export function LEDArray() {
  const gpio = useSim((s) => s.snap.gpio);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2.5">
        {LED_PINS.map((p, i) => {
          const mask = 1 << p.pin;
          const isOutput = (gpio.dir[p.port] & mask) !== 0;
          const on = isOutput && (gpio.out[p.port] & mask) !== 0;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span
                aria-label={`LED ${i} ${on ? "on" : "off"}`}
                className={cn(
                  "h-4 w-4 rounded-full border transition-all duration-75",
                  on
                    ? "border-[#7dffa6] bg-[#4ade80] shadow-[0_0_10px_2px_rgba(74,222,128,0.75)]"
                    : "border-[#1f2a22] bg-[#11201500]",
                )}
                style={!on ? { background: "#0e1a12" } : undefined}
              />
              <span className="font-mono text-[9px] text-muted">P{p.port}.{p.pin}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
