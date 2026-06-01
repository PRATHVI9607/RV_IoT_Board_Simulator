"use client";

import { useCallback, useRef, useState } from "react";
import { useSim } from "@/store/simulatorStore";
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
import { UploadSimple, Circuitry, Cube, Monitor } from "@phosphor-icons/react";

function Zone({
  label, className, children,
}: {
  label: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-lg border border-[#2a4a35] bg-[#0e1b12] p-4 pt-6",
        "shadow-[inset_0_1px_0_rgba(74,222,128,0.04),inset_0_0_24px_rgba(0,0,0,0.3)]",
        className,
      )}
    >
      <span className="absolute left-3 top-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[#4a7a5a]">
        {label}
      </span>
      {children}
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
        <div className="mx-auto flex max-w-[1100px] flex-col gap-4 p-5">
          {/* Row 1: LCD + 7-Seg + Keypad */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Zone label="20×4 Alphanumeric LCD" className="flex items-center justify-center">
              <LCDDisplay />
            </Zone>
            <Zone label="7-Segment Display (5-digit)" className="flex items-center justify-center">
              <SevenSegDisplay />
            </Zone>
            <Zone label="Matrix Keypad" className="flex items-center justify-center">
              <MatrixKeypad />
            </Zone>
          </div>

          {/* Row 2: Analog I/O + LPC2148 IC + Motors */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[240px_1fr_240px]">
            <div className="flex flex-col gap-4">
              <Zone label="ADC Inputs · LDR / Temp / Pot">
                <ADCInputs />
              </Zone>
              <Zone label="DAC Output · P0.25 AOUT" className="flex items-center justify-center">
                <DACOutput />
              </Zone>
            </div>
            <Zone label="LPC2148 · ARM7TDMI-S Core" className="flex justify-center">
              <LPC2148IC />
            </Zone>
            <div className="flex flex-col gap-4">
              <Zone label="DC Motor · DRV8801" className="flex items-center justify-center">
                <DCMotor />
              </Zone>
              <Zone label="Servo 1 · PWM4" className="flex items-center justify-center">
                <ServoMotor id={1} />
              </Zone>
            </div>
          </div>

          {/* Row 3: Logic Controller + Stepper + Elevator + Buzzer */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_160px_160px_120px]">
            <Zone label="Logic Controller · 8 LED + 8 Switch" className="flex flex-col items-center gap-4">
              <LEDArray />
              <div className="h-px w-3/4 bg-line" />
              <SwitchArray />
            </Zone>
            <Zone label="Stepper 1 · ULN2803" className="flex items-center justify-center">
              <StepperMotor id={1} />
            </Zone>
            <Zone label="Elevator Interface" className="flex items-center justify-center">
              <ElevatorInterface />
            </Zone>
            <Zone label="Buzzer" className="flex items-center justify-center">
              <Buzzer />
            </Zone>
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
