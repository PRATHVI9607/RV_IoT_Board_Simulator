"use client";

import { useCallback, useRef, useState } from "react";
import { useSim, type PeriphKey } from "@/store/simulatorStore";
import { LPC2148IC } from "./LPC2148IC";
import { Board3D } from "./Board3D";
import { LCDDisplay } from "../peripherals/LCDDisplay";
import { LEDArray } from "../peripherals/LEDArray";
import { SwitchArray } from "../peripherals/SwitchArray";
import { MatrixKeypad } from "../peripherals/MatrixKeypad";
import { SevenSegDisplay } from "../peripherals/SevenSegDisplay";
import { DCMotor } from "../peripherals/DCMotor";
import { StepperMotor } from "../peripherals/StepperMotor";
import { ServoMotor } from "../peripherals/ServoMotor";
import { Buzzer } from "../peripherals/Buzzer";
import { ADCInputs } from "../peripherals/ADCInputs";
import { DACOutput } from "../peripherals/DACOutput";
import { ElevatorInterface } from "../peripherals/ElevatorInterface";
import { cn } from "@/lib/cn";
import { UploadSimple, Circuitry, Cube, Monitor, Plugs, PlugsConnected } from "@phosphor-icons/react";

/**
 * A board peripheral zone. When `periphKey` is given, a connect/disconnect
 * toggle appears in the header and the zone dims + ignores input while
 * disconnected, so a lab program only drives the peripherals you select.
 */
function Zone({
  label, periphKey, className, children,
}: {
  label: string; periphKey?: PeriphKey; className?: string; children: React.ReactNode;
}) {
  const connected = useSim(s => (periphKey ? s.connected[periphKey] : true));
  const toggle = useSim(s => s.togglePeripheral);
  const off = periphKey != null && !connected;

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-[#0e1b12] p-4 pt-7 transition-colors",
        off ? "border-[#23332a]" : "border-[#2a4a35]",
        "shadow-[inset_0_1px_0_rgba(74,222,128,0.04),inset_0_0_24px_rgba(0,0,0,0.3)]",
        className,
      )}
    >
      <span className={cn(
        "pointer-events-none absolute left-3 top-1.5 z-20 font-mono text-[9px] uppercase tracking-[0.22em]",
        off ? "text-[#3a4a40]" : "text-[#4a7a5a]",
      )}>
        {label}
      </span>

      {periphKey && (
        <button
          type="button"
          onClick={() => toggle(periphKey)}
          title={connected ? "Disconnect from board" : "Connect to board"}
          aria-label={connected ? `Disconnect ${label}` : `Connect ${label}`}
          className={cn(
            "absolute right-2 top-1.5 z-20 flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] transition-colors",
            connected ? "text-signal hover:bg-[rgba(74,222,128,0.1)]"
                      : "text-muted/50 hover:bg-pane hover:text-muted",
          )}
        >
          {connected ? <PlugsConnected size={11} weight="bold" /> : <Plugs size={11} />}
          {connected ? "ON" : "OFF"}
        </button>
      )}

      {children}

      {/* Disconnected scrim — dims content and blocks interaction */}
      {off && (
        <div className="absolute inset-0 z-10 flex items-end justify-center rounded-lg bg-[#0b1410]/70 pb-2 backdrop-grayscale">
          <span className="font-mono text-[9px] text-muted/60">disconnected · click ON to wire</span>
        </div>
      )}
    </div>
  );
}

/** A horizontal strip of chips to connect/disconnect each peripheral. */
const TRAY_ITEMS: { key: PeriphKey; label: string }[] = [
  { key: "lcd", label: "LCD" },
  { key: "sevenSeg", label: "7-Seg" },
  { key: "keypad", label: "Keypad" },
  { key: "adc", label: "ADC" },
  { key: "dac", label: "DAC" },
  { key: "dcMotor", label: "DC Motor" },
  { key: "stepper1", label: "Stepper 1" },
  { key: "stepper2", label: "Stepper 2" },
  { key: "servo1", label: "Servo 1" },
  { key: "servo2", label: "Servo 2" },
  { key: "buzzer", label: "Buzzer" },
  { key: "elevator", label: "Elevator" },
];

function PeripheralTray() {
  const connected = useSim(s => s.connected);
  const toggle = useSim(s => s.togglePeripheral);
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line bg-panel/60 px-3 py-2">
      <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        Connect:
      </span>
      {TRAY_ITEMS.map(({ key, label }) => {
        const on = connected[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            title={on ? `${label} connected — click to disconnect` : `Connect ${label}`}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
              on
                ? "border-signal/40 bg-[rgba(74,222,128,0.12)] text-signal"
                : "border-line-strong bg-pane text-muted hover:border-[#33404f] hover:text-fg",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-signal" : "bg-muted/40")} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export async function readProgramFile(
  file: File,
  loadHexText: (t: string, n: string) => void,
  loadBytes: (b: Uint8Array, n: string) => void,
  loadElf: (b: Uint8Array, n: string) => void,
) {
  const name = file.name;
  if (/\.elf$/i.test(name)) {
    const buf = await file.arrayBuffer();
    loadElf(new Uint8Array(buf), name);
  } else if (/\.bin$/i.test(name)) {
    const buf = await file.arrayBuffer();
    loadBytes(new Uint8Array(buf), name);
  } else {
    const text = await file.text();
    loadHexText(text, name);
  }
}

export function BoardCanvas() {
  const hexLoaded  = useSim(s => s.hexLoaded);
  const loadHexText = useSim(s => s.loadHexText);
  const loadBytes  = useSim(s => s.loadBytes);
  const loadElf    = useSim(s => s.loadElf);
  const error      = useSim(s => s.error);
  const show3D     = useSim(s => s.show3D);
  const toggle3D   = useSim(s => s.toggle3D);
  const connected  = useSim(s => s.connected);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await readProgramFile(file, loadHexText, loadBytes, loadElf);
  }, [loadHexText, loadBytes, loadElf]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn(
        "relative h-full overflow-auto rounded-lg border border-line bg-board",
        "bg-[radial-gradient(circle_at_30%_20%,rgba(45,106,79,0.10),transparent_60%),repeating-linear-gradient(90deg,rgba(176,136,71,0.05)_0,rgba(176,136,71,0.05)_1px,transparent_1px,transparent_28px)]",
      )}
    >
      {/* Hidden file input */}
      <label className="sr-only" htmlFor="board-file-input">Open compiled program</label>
      <input
        id="board-file-input"
        ref={fileRef}
        type="file"
        accept=".hex,.bin,.elf"
        aria-label="Open compiled program"
        className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0];
          if (f) await readProgramFile(f, loadHexText, loadBytes, loadElf);
          e.target.value = "";
        }}
      />

      {/* 2D / 3D toggle */}
      {hexLoaded && (
        <button
          type="button"
          onClick={toggle3D}
          title={show3D ? "Switch to 2D board" : "Switch to 3D board"}
          className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded border border-line-strong bg-panel/80 px-2 py-1 text-[10px] text-muted backdrop-blur-sm hover:text-fg"
        >
          {show3D ? <Monitor size={12} /> : <Cube size={12} />}
          {show3D ? "2D" : "3D"}
        </button>
      )}

      {/* 3D view */}
      {hexLoaded && show3D ? (
        <Board3D />
      ) : (
        <div className="flex h-full flex-col">
          {/* Peripheral tray — connect/disconnect any peripheral here */}
          <PeripheralTray />

          {/* Board surface — shows the CPU, the LED/switch bank, and every
              CONNECTED peripheral at full size. Connect more from the tray. */}
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <div className="grid grid-flow-dense grid-cols-2 gap-3 lg:grid-cols-4 [grid-auto-rows:minmax(0,auto)]">
              {/* CPU — always present, spans 2 columns */}
              <Zone label="LPC2148 · ARM7TDMI-S Core" className="col-span-2 flex min-w-0 justify-center overflow-x-auto">
                <LPC2148IC />
              </Zone>

              {/* Logic controller — always present (P0.0-7 LEDs, P0.8-15 switches) */}
              <Zone label="Logic Controller · 8 LED + 8 Switch" className="col-span-2 flex min-w-0 flex-col items-center gap-3 overflow-x-auto">
                <LEDArray />
                <div className="h-px w-3/4 bg-line" />
                <SwitchArray />
              </Zone>

              {/* Connected peripherals only */}
              {connected.lcd && (
                <Zone periphKey="lcd" label="20×4 LCD" className="col-span-2 flex min-w-0 items-center justify-center overflow-x-auto">
                  <LCDDisplay />
                </Zone>
              )}
              {connected.sevenSeg && (
                <Zone periphKey="sevenSeg" label="7-Segment (5-digit)" className="col-span-2 flex min-w-0 items-center justify-center overflow-x-auto">
                  <SevenSegDisplay />
                </Zone>
              )}
              {connected.keypad && (
                <Zone periphKey="keypad" label="Matrix Keypad" className="flex min-w-0 items-center justify-center">
                  <MatrixKeypad />
                </Zone>
              )}
              {connected.adc && (
                <Zone periphKey="adc" label="ADC Inputs" className="col-span-2 flex min-w-0 items-center">
                  <ADCInputs />
                </Zone>
              )}
              {connected.dac && (
                <Zone periphKey="dac" label="DAC Output · P0.25" className="flex items-center justify-center">
                  <DACOutput />
                </Zone>
              )}
              {connected.dcMotor && (
                <Zone periphKey="dcMotor" label="DC Motor · DRV8801" className="flex items-center justify-center">
                  <DCMotor />
                </Zone>
              )}
              {connected.stepper1 && (
                <Zone periphKey="stepper1" label="Stepper 1 · ULN2803" className="flex items-center justify-center">
                  <StepperMotor id={1} />
                </Zone>
              )}
              {connected.stepper2 && (
                <Zone periphKey="stepper2" label="Stepper 2 · ULN2803" className="flex items-center justify-center">
                  <StepperMotor id={2} />
                </Zone>
              )}
              {connected.servo1 && (
                <Zone periphKey="servo1" label="Servo 1 · PWM4" className="flex items-center justify-center">
                  <ServoMotor id={1} />
                </Zone>
              )}
              {connected.servo2 && (
                <Zone periphKey="servo2" label="Servo 2 · PWM5" className="flex items-center justify-center">
                  <ServoMotor id={2} />
                </Zone>
              )}
              {connected.elevator && (
                <Zone periphKey="elevator" label="Elevator Interface" className="flex items-center justify-center">
                  <ElevatorInterface />
                </Zone>
              )}
              {connected.buzzer && (
                <Zone periphKey="buzzer" label="Buzzer · PWM1 / GPIO" className="flex items-center justify-center">
                  <Buzzer />
                </Zone>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Idle drop overlay */}
      {!hexLoaded && (
        <div
          className={cn(
            "absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-bg/80 backdrop-blur-sm transition-colors",
            dragOver && "bg-accent-soft",
          )}
        >
          <div
            className={cn(
              "flex flex-col items-center gap-4 rounded-xl border-2 border-dashed px-12 py-10 text-center transition-colors",
              dragOver ? "border-accent" : "border-line-strong",
            )}
          >
            <Circuitry size={40} className="text-accent" weight="duotone" />
            <div>
              <p className="text-base font-medium text-fg">Drop a compiled program to begin</p>
              <p className="mt-1 max-w-xs text-sm text-muted">
                Intel HEX (.hex) from Keil uVision, raw .bin, or ELF (.elf).
                Loaded into Flash and executed on the virtual board.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md border border-accent-line bg-accent-soft px-4 py-2 text-sm font-medium text-accent-strong transition-transform active:translate-y-px hover:bg-[rgba(255,180,77,0.22)]"
            >
              <UploadSimple size={16} weight="bold" />
              Choose file (.hex / .bin / .elf)
            </button>
            {error && <p className="max-w-xs text-xs text-[#fca5a5]">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
