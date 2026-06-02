"use client";

import { useSim } from "@/store/simulatorStore";
import { PanelHeader } from "@/components/ui/Panel";
import { cn } from "@/lib/cn";

/** Alternate-function hints shown under each pin. */
const FN: Record<string, string> = {
  "0.0": "TXD0", "0.1": "RXD0", "0.2": "SDA0", "0.3": "SCL0", "0.4": "SCK0",
  "0.5": "MISO0", "0.6": "MOSI0", "0.7": "SSEL0", "0.8": "TXD1", "0.9": "RXD1/PWM6",
  "0.16": "LCD D4", "0.17": "LCD D5", "0.18": "LCD D6", "0.19": "LCD D7/7SEG-DAT",
  "0.20": "LCD RS/7SEG-CLK", "0.21": "PWM4", "0.22": "PWM5", "0.25": "AOUT/DAC",
  "0.28": "DC DIR", "0.29": "AD1.2", "0.30": "AD1.3/7SEG-STB", "0.31": "AD1.4",
  "1.16": "KP COL0", "1.17": "KP COL1", "1.18": "KP COL2", "1.19": "KP COL3", "1.25": "LCD EN",
};

interface PinRowProps {
  port: 0 | 1;
  pin: number;
}

function PinRow({ port, pin }: PinRowProps) {
  const dirWord = useSim((s) => s.snap.gpio.dir[port]);
  const pinWord = useSim((s) => s.snap.gpio.pin[port]);
  const setPin = useSim((s) => s.setPin);

  const mask = 1 << pin;
  const isOutput = (dirWord & mask) !== 0;
  const high = (pinWord & mask) !== 0;
  const fn = FN[`${port}.${pin}`];

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded px-1.5 py-1",
        high ? "bg-[rgba(74,222,128,0.06)]" : "bg-transparent",
      )}
    >
      {/* state dot */}
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          high
            ? isOutput
              ? "bg-signal shadow-[0_0_6px_rgba(74,222,128,0.7)]"
              : "bg-accent shadow-[0_0_6px_rgba(255,180,77,0.6)]"
            : "bg-line-strong",
        )}
      />
      {/* pin name */}
      <span className="w-12 shrink-0 font-mono text-[12px] text-fg/90">
        P{port}.{pin}
      </span>
      {/* direction badge */}
      <span
        className={cn(
          "w-9 shrink-0 rounded text-center font-mono text-[9px] uppercase",
          isOutput ? "bg-[rgba(74,222,128,0.12)] text-signal" : "bg-pane text-muted",
        )}
      >
        {isOutput ? "OUT" : "IN"}
      </span>
      {/* level / toggle */}
      {isOutput ? (
        <span className={cn("w-11 text-center font-mono text-[11px]", high ? "text-signal" : "text-muted/50")}>
          {high ? "HIGH" : "LOW"}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setPin(port, pin, !high)}
          title="Toggle input level"
          className={cn(
            "w-11 rounded border py-0.5 text-center font-mono text-[10px] transition-colors",
            high
              ? "border-accent-line bg-accent-soft text-accent"
              : "border-line-strong bg-pane text-muted hover:text-fg",
          )}
        >
          {high ? "HIGH" : "LOW"}
        </button>
      )}
      {/* alt function */}
      <span className="truncate font-mono text-[10px] text-muted/50">{fn ?? ""}</span>
    </div>
  );
}

/**
 * Direct GPIO pin control. Shows every pin's direction and live level. Pins
 * configured as INPUT can be toggled HIGH/LOW by hand — useful for driving
 * sensor/switch inputs without wiring a peripheral (PRD §9.4).
 */
export function PinControl() {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="GPIO Pin Control"
        right={
          <span className="font-mono text-[9px] text-muted/70">
            green = OUT high · amber = IN high · click IN pins to drive them
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-6 overflow-auto p-2 lg:grid-cols-2">
        {/* PORT 0 — all 32 pins */}
        <div>
          <div className="mb-1 px-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-accent/70">
            PORT 0 · P0.0–P0.31
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {Array.from({ length: 32 }, (_, p) => (
              <PinRow key={p} port={0} pin={p} />
            ))}
          </div>
        </div>
        {/* PORT 1 — P1.16–P1.31 */}
        <div>
          <div className="mb-1 px-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-accent/70">
            PORT 1 · P1.16–P1.31
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {Array.from({ length: 16 }, (_, i) => (
              <PinRow key={i} port={1} pin={16 + i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
