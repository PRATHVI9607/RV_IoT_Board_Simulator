"use client";

import { useSim, getEngine } from "@/store/simulatorStore";
import { KEYPAD_LABELS, keypadCellToMatrix } from "@/lib/boardConfig";
import { cn } from "@/lib/cn";

export function MatrixKeypad() {
  const press = useSim((s) => s.pressKey);
  // Subscribe to snapshot so pressed state re-renders when paused.
  useSim((s) => s.snap.cpu.cycles);

  const eng = getEngine();

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="grid grid-cols-4 gap-1.5">
        {KEYPAD_LABELS.map((row, r) =>
          row.map((label, c) => {
            const { row: mr, col: mc } = keypadCellToMatrix(r, c);
            const down = eng.keypad.isPressed(mr, mc);
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  press(r, c, true);
                }}
                onPointerUp={() => press(r, c, false)}
                onPointerLeave={(e) => {
                  if (e.buttons) press(r, c, false);
                }}
                className={cn(
                  "h-9 w-9 rounded-md border font-mono text-sm transition-all duration-75",
                  down
                    ? "scale-95 border-accent-line bg-accent-soft text-accent-strong shadow-[0_0_10px_rgba(255,180,77,0.4)]"
                    : "border-line-strong bg-pane text-fg/80 hover:border-[#33404f] hover:text-fg",
                )}
              >
                {label}
              </button>
            );
          }),
        )}
      </div>
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
        4×4 keypad · rows P0.16–19 · cols P1.16–19
      </span>
    </div>
  );
}
