"use client";

import { useSim, type PeriphKey } from "@/store/simulatorStore";
import { cn } from "@/lib/cn";
import { PlugsConnected, Plugs } from "@phosphor-icons/react";

interface ChipDef {
  key: PeriphKey;
  name: string;
  subtitle: string;
  pins: string[];
  color: string; // accent color for the chip
}

const CHIPS: ChipDef[] = [
  {
    key: "lcd",
    name: "LCD 20×4",
    subtitle: "HD44780 · 4-bit",
    pins: ["D4-D7: P0.16-19", "RS: P0.20", "EN: P1.25"],
    color: "#4ade80",
  },
  {
    key: "sevenSeg",
    name: "7-Segment",
    subtitle: "5-digit · common-anode",
    pins: ["DATA: P0.19", "CLK: P0.20", "STB: P0.30"],
    color: "#ff8c00",
  },
  {
    key: "keypad",
    name: "Keypad 4×4",
    subtitle: "Matrix scan",
    pins: ["ROW0-3: P0.16-19", "COL0-3: P1.16-19"],
    color: "#4dc3ff",
  },
  {
    key: "adc",
    name: "ADC1",
    subtitle: "10-bit · LDR/LM35/POT",
    pins: ["LDR: P0.29", "LM35: P0.30", "POT: P0.31"],
    color: "#ffd600",
  },
  {
    key: "dac",
    name: "DAC",
    subtitle: "10-bit · P0.25 AOUT",
    pins: ["AOUT: P0.25"],
    color: "#00d4ff",
  },
  {
    key: "dcMotor",
    name: "DC Motor",
    subtitle: "DRV8801 driver",
    pins: ["PWM6: P0.9", "DIR: P0.28"],
    color: "#f87171",
  },
  {
    key: "stepper1",
    name: "Stepper 1",
    subtitle: "ULN2803 driver",
    pins: ["Coils: P0.16-19"],
    color: "#c084fc",
  },
  {
    key: "stepper2",
    name: "Stepper 2",
    subtitle: "ULN2803 driver",
    pins: ["Coils: P0.20-23"],
    color: "#c084fc",
  },
  {
    key: "servo1",
    name: "Servo 1",
    subtitle: "PWM4",
    pins: ["PWM4: P0.21"],
    color: "#34d399",
  },
  {
    key: "servo2",
    name: "Servo 2",
    subtitle: "PWM5",
    pins: ["PWM5: P0.22"],
    color: "#34d399",
  },
  {
    key: "buzzer",
    name: "Buzzer",
    subtitle: "PWM / GPIO",
    pins: ["P0.16-19 via ULN"],
    color: "#fbbf24",
  },
  {
    key: "elevator",
    name: "Elevator",
    subtitle: "4-floor control",
    pins: ["Call: P0.16-19", "LED: P1.16-19", "Motor: PWM6"],
    color: "#38bdf8",
  },
];

function ChipCard({ chip }: { chip: ChipDef }) {
  const connected = useSim(s => s.connected[chip.key]);
  const toggle = useSim(s => s.togglePeripheral);
  const on = connected;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border transition-all duration-150",
        on
          ? "border-[--chip-color]/40 bg-[--chip-color]/5 shadow-[0_0_12px_var(--chip-glow)]"
          : "border-line bg-pane hover:border-line-strong",
      )}
      style={
        {
          "--chip-color": chip.color,
          "--chip-glow": `${chip.color}20`,
        } as React.CSSProperties
      }
    >
      {/* Header strip */}
      <div className="flex items-center gap-2 border-b border-line px-2.5 py-2">
        {/* IC body icon */}
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded border font-mono text-[7px] leading-tight",
            on ? "border-[--chip-color]/50 text-[--chip-color]" : "border-line-strong text-muted",
          )}
        >
          <div className="text-center">IC</div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-mono text-[12px] font-semibold leading-none",
            on ? "text-fg" : "text-fg/70",
          )}>
            {chip.name}
          </p>
          <p className="mt-0.5 truncate font-mono text-[9px] text-muted/70">
            {chip.subtitle}
          </p>
        </div>
        {/* Status dot */}
        {on && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full live-pulse"
            style={{ backgroundColor: chip.color }}
          />
        )}
      </div>

      {/* Pins */}
      <div className="px-2.5 py-1.5">
        {chip.pins.map(p => (
          <p key={p} className="font-mono text-[9px] leading-[1.5] text-muted/60">
            {p}
          </p>
        ))}
      </div>

      {/* Connect / disconnect button */}
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => toggle(chip.key)}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-md border py-1.5 font-mono text-[10px] font-semibold transition-all active:scale-95",
            on
              ? "border-[--chip-color]/40 bg-[--chip-color]/15 text-[--chip-color] hover:bg-[--chip-color]/25"
              : "border-line-strong bg-bg text-muted hover:border-line-strong hover:text-fg",
          )}
        >
          {on ? (
            <>
              <PlugsConnected size={11} weight="bold" />
              WIRED
            </>
          ) : (
            <>
              <Plugs size={11} />
              WIRE UP
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Left sidebar — a palette of peripheral IC chips. Click a chip to wire it
 * to the board. The chip shows its exact LPC2148 pin connections so you know
 * what to write in your firmware.
 */
export function PeripheralSidebar() {
  const anyOn = useSim(s =>
    Object.values(s.connected).some(Boolean),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-line bg-panel">
      {/* Header */}
      <div className="shrink-0 border-b border-line px-3 py-2.5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
          Peripherals
        </p>
        <p className="mt-0.5 font-mono text-[9px] text-muted/70">
          Wire up what your code uses
        </p>
      </div>

      {/* Chip cards */}
      <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {CHIPS.map(chip => (
          <ChipCard key={chip.key} chip={chip} />
        ))}
      </div>

      {/* Footer hint */}
      <div className="shrink-0 border-t border-line px-3 py-2">
        <p className="font-mono text-[9px] text-muted/50">
          {anyOn
            ? "Drag edge to resize ↔"
            : "Connect a peripheral to see it on the board"}
        </p>
      </div>
    </div>
  );
}
