"use client";

import { useSim, getEngine } from "@/store/simulatorStore";
import { LCD_COLS, LCD_ROWS } from "@/sim/peripherals/lcd";
import { cn } from "@/lib/cn";

export function LCDDisplay() {
  const lcd = useSim((s) => s.snap.lcd);
  const refresh = useSim((s) => s.refresh);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        aria-label="Toggle LCD backlight"
        onClick={() => {
          getEngine().lcd.toggleBacklight();
          refresh();
        }}
        className={cn(
          "crt-scan rounded-md border p-3 transition-colors",
          lcd.backlight
            ? "border-[#1f5f3a] bg-[#0f2417] shadow-[inset_0_0_24px_rgba(74,222,128,0.12)]"
            : "border-[#16361f] bg-[#08130c]",
        )}
      >
        <div className="grid gap-[3px]" style={{ gridTemplateRows: `repeat(${LCD_ROWS}, 1fr)` }}>
          {Array.from({ length: LCD_ROWS }, (_, r) => (
            <div key={r} className="flex gap-[2px]">
              {Array.from({ length: LCD_COLS }, (_, c) => {
                const ch = lcd.rows[r]?.[c] ?? " ";
                const isCursor = lcd.cursorOn && lcd.cursorRow === r && lcd.cursorCol === c;
                return (
                  <span
                    key={c}
                    className={cn(
                      "grid h-5 w-[11px] place-items-center rounded-[1px] font-mono text-[13px] leading-none",
                      lcd.backlight
                        ? "bg-[#0c1f13] text-[#7ef0a8]"
                        : "bg-[#0a160e] text-[#2f5e3f]",
                      lcd.backlight &&
                        ch !== " " &&
                        "[text-shadow:0_0_6px_rgba(126,240,168,0.55)]",
                    )}
                  >
                    {isCursor ? (
                      <span className="lcd-cursor block h-[16px] w-[9px] bg-[#7ef0a8]/70" />
                    ) : (
                      ch
                    )}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </button>
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
        20×4 LCD · HD44780 · P0.16–19 / RS P0.20 / EN P1.25
      </span>
    </div>
  );
}
