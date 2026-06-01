"use client";

import { useSim } from "@/store/simulatorStore";
import { SWITCH_PINS } from "@/lib/boardConfig";
import { cn } from "@/lib/cn";

/**
 * 8 slide switches. Released = HIGH (pull-up); pressed = LOW (active-low input).
 * Keyboard 1–8 toggles them.
 */
export function SwitchArray() {
  const switches = useSim((s) => s.switches);
  const toggle = useSim((s) => s.toggleSwitch);

  return (
    <div className="flex gap-2.5">
      {SWITCH_PINS.map((p, i) => {
        const pressed = switches[i]; // pressed = LOW
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <button
              type="button"
              aria-label={`Switch ${i + 1} ${pressed ? "low" : "high"}`}
              onClick={() => toggle(i)}
              className={cn(
                "flex h-7 w-4 flex-col rounded-sm border p-[2px] transition-colors",
                "border-line-strong bg-[#0c1116]",
              )}
            >
              <span
                className={cn(
                  "h-1/2 w-full rounded-[1px] transition-all",
                  !pressed
                    ? "bg-accent shadow-[0_0_6px_rgba(255,180,77,0.6)]"
                    : "bg-transparent",
                )}
              />
              <span
                className={cn(
                  "mt-auto h-1/2 w-full rounded-[1px] transition-all",
                  pressed ? "bg-[#3a4452]" : "bg-transparent",
                )}
              />
            </button>
            <span className="font-mono text-[9px] text-muted">{i + 1}</span>
          </div>
        );
      })}
    </div>
  );
}
