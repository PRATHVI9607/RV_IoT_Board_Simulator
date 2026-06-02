"use client";

import { useSim } from "@/store/simulatorStore";
import { cn } from "@/lib/cn";

type PinState = "out-high" | "out-low" | "in-high" | "in-low";

function pinState(out: number, dir: number, ext: number, pin: number): PinState {
  const mask = 1 << pin;
  const isOut = (dir & mask) !== 0;
  if (isOut) return out & mask ? "out-high" : "out-low";
  return ext & mask ? "in-high" : "in-low";
}

function Pin({
  label,
  state,
  fn,
}: {
  label: string;
  state: PinState;
  fn?: string;
}) {
  return (
    <div className="group relative flex items-center gap-1" title={fn ? `${label} · ${fn}` : label}>
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full border transition-all duration-75",
          state === "out-high" &&
            "border-[#7dffa6] bg-[#4ade80] shadow-[0_0_6px_1px_rgba(74,222,128,0.7)]",
          state === "out-low" && "border-[#23402c] bg-[#16271c]",
          state === "in-high" && "border-accent bg-accent-soft",
          state === "in-low" && "border-line-strong bg-transparent",
        )}
      />
      <span className="font-mono text-[8px] leading-none text-muted">{label}</span>
    </div>
  );
}

const P0_FN: Record<number, string> = {
  0: "TXD0", 1: "RXD0", 2: "SDA", 3: "SCL", 4: "SCK0", 5: "MISO0", 6: "MOSI0",
  7: "SSEL0", 8: "TXD1", 9: "RXD1/PWM6", 16: "LCD D4", 17: "LCD D5", 18: "LCD D6",
  19: "LCD D7", 20: "LCD RS", 21: "PWM4", 22: "PWM5", 25: "AOUT/DAC", 28: "DC DIR",
  29: "AD1.2", 30: "AD1.3", 31: "AD1.4",
};
const P1_FN: Record<number, string> = {
  16: "KP COL0", 17: "KP COL1", 18: "KP COL2", 19: "KP COL3", 25: "LCD EN",
};

export function LPC2148IC() {
  const gpio = useSim((s) => s.snap.gpio);
  const ext0 = gpio.pin[0] & ~gpio.dir[0]; // external bits visible on the pin reg
  const ext1 = gpio.pin[1] & ~gpio.dir[1];

  const p0 = Array.from({ length: 32 }, (_, n) =>
    pinState(gpio.out[0], gpio.dir[0], ext0, n),
  );
  const p1 = Array.from({ length: 16 }, (_, n) =>
    pinState(gpio.out[1], gpio.dir[1], ext1, 16 + n),
  );

  return (
    <div className="flex items-stretch justify-center gap-2.5">
      {/* PORT0 low half */}
      <div className="grid grid-cols-1 content-center gap-[1.5px]">
        {p0.slice(0, 16).map((st, n) => (
          <Pin key={n} label={`P0.${n}`} state={st} fn={P0_FN[n]} />
        ))}
      </div>

      {/* Chip body */}
      <div className="relative flex w-36 flex-col items-center justify-center rounded border-2 border-[#2e3a4a] bg-gradient-to-b from-[#1c2230] via-[#141a24] to-[#0e1117] px-3 py-4 shadow-[0_0_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]">
        <span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full border border-accent/30 bg-[#0b0d10]" />
        <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-[#445566]">NXP</span>
        <span className="ic-partnum mt-0.5 font-mono text-lg font-bold tracking-wide text-accent">LPC2148</span>
        <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-fg/60">ARM7TDMI-S</span>
        <span className="my-1.5 h-px w-2/3 bg-[#2a3444]" />
        <span className="font-mono text-[8px] text-[#556677]">32-bit · 60 MHz</span>
        <span className="mt-0.5 font-mono text-[8px] text-[#556677]">512K Flash · 40K RAM</span>
        <span className="mt-1.5 font-mono text-[7px] text-[#334455]">LQFP-64</span>
      </div>

      {/* PORT0 high half */}
      <div className="grid grid-cols-1 content-center gap-[1.5px]">
        {p0.slice(16, 32).map((st, n) => (
          <Pin key={n + 16} label={`P0.${n + 16}`} state={st} fn={P0_FN[n + 16]} />
        ))}
      </div>

      {/* PORT1 */}
      <div className="grid grid-cols-1 content-center gap-[1.5px] border-l border-line pl-2.5">
        {p1.map((st, n) => (
          <Pin key={n} label={`P1.${n + 16}`} state={st} fn={P1_FN[n + 16]} />
        ))}
      </div>
    </div>
  );
}
