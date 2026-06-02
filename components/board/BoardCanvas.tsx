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

/** A labelled peripheral zone — no connect toggle (that's in the sidebar). */
function Zone({
  label,
  wide = false,
  className,
  children,
}: {
  label: string;
  wide?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border border-[#2a4a35] bg-[#0c1510] p-3 pt-6",
        "shadow-[inset_0_1px_0_rgba(74,222,128,0.04)]",
        wide && "col-span-2",
        className,
      )}
    >
      <span className="absolute left-2.5 top-1.5 font-mono text-[8.5px] uppercase tracking-[0.2em] text-[#4a7a5a]">
        {label}
      </span>
      {children}
    </div>
  );
}

export async function readProgramFile(
  file: File,
  loadHexText: (t: string, n: string) => void,
  loadBytes:   (b: Uint8Array, n: string) => void,
  loadElf:     (b: Uint8Array, n: string) => void,
) {
  const name = file.name;
  if (/\.elf$/i.test(name)) {
    loadElf(new Uint8Array(await file.arrayBuffer()), name);
  } else if (/\.bin$/i.test(name)) {
    loadBytes(new Uint8Array(await file.arrayBuffer()), name);
  } else {
    loadHexText(await file.text(), name);
  }
}

export function BoardCanvas() {
  const hexLoaded   = useSim(s => s.hexLoaded);
  const loadHexText = useSim(s => s.loadHexText);
  const loadBytes   = useSim(s => s.loadBytes);
  const loadElf     = useSim(s => s.loadElf);
  const error       = useSim(s => s.error);
  const show3D      = useSim(s => s.show3D);
  const toggle3D    = useSim(s => s.toggle3D);
  const connected   = useSim(s => s.connected);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) await readProgramFile(f, loadHexText, loadBytes, loadElf);
  }, [loadHexText, loadBytes, loadElf]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn(
        "relative h-full overflow-auto rounded-none bg-board",
        "bg-[radial-gradient(ellipse_at_30%_20%,rgba(45,106,79,0.10),transparent_55%)]",
        // Subtle PCB trace grid
        "[background-image:radial-gradient(ellipse_at_30%_20%,rgba(45,106,79,0.10),transparent_55%),repeating-linear-gradient(0deg,rgba(176,136,71,0.03)_0,rgba(176,136,71,0.03)_1px,transparent_1px,transparent_24px),repeating-linear-gradient(90deg,rgba(176,136,71,0.03)_0,rgba(176,136,71,0.03)_1px,transparent_1px,transparent_24px)]",
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
          title={show3D ? "Switch to 2D" : "Switch to 3D"}
          className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded border border-line-strong bg-panel/80 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur-sm hover:text-fg"
        >
          {show3D ? <Monitor size={12} /> : <Cube size={12} />}
          {show3D ? "2D" : "3D"}
        </button>
      )}

      {/* 3D view */}
      {hexLoaded && show3D && <Board3D />}

      {/* 2D board — always rendered; invisible behind 3D when 3D is on */}
      {!show3D && (
        <div className="p-3">
          {/* Masonry-style dense grid: 2 equal columns */}
          <div className="grid grid-cols-2 gap-2.5 [grid-auto-rows:auto]">

            {/* LPC2148 IC — always visible, spans full width */}
            <Zone label="LPC2148 · ARM7TDMI-S" wide className="flex items-center justify-center overflow-x-auto py-4">
              <LPC2148IC />
            </Zone>

            {/* Logic controller — always visible, spans full width */}
            <Zone label="Logic Controller · 8 LED + 8 Switch" wide className="flex flex-col items-center gap-3 py-3">
              <LEDArray />
              <div className="h-px w-3/4 bg-line" />
              <SwitchArray />
            </Zone>

            {/* Connected peripherals only — each occupies 1 col by default,
                wide ones span 2 cols. Order reflects the PRD board layout. */}
            {connected.lcd && (
              <Zone label="20×4 LCD" wide className="flex items-center justify-center overflow-x-auto">
                <LCDDisplay />
              </Zone>
            )}

            {connected.sevenSeg && (
              <Zone label="7-Segment (5-digit)" wide className="flex items-center justify-center overflow-x-auto">
                <SevenSegDisplay />
              </Zone>
            )}

            {connected.keypad && (
              <Zone label="Matrix Keypad" className="flex items-center justify-center">
                <MatrixKeypad />
              </Zone>
            )}

            {connected.adc && (
              <Zone label="ADC Inputs · LDR / Temp / Pot" className="flex items-center">
                <ADCInputs />
              </Zone>
            )}

            {connected.dac && (
              <Zone label="DAC Output · P0.25 AOUT" className="flex items-center justify-center">
                <DACOutput />
              </Zone>
            )}

            {connected.dcMotor && (
              <Zone label="DC Motor · DRV8801" className="flex items-center justify-center">
                <DCMotor />
              </Zone>
            )}

            {connected.stepper1 && (
              <Zone label="Stepper 1 · ULN2803" className="flex items-center justify-center">
                <StepperMotor id={1} />
              </Zone>
            )}

            {connected.stepper2 && (
              <Zone label="Stepper 2 · ULN2803" className="flex items-center justify-center">
                <StepperMotor id={2} />
              </Zone>
            )}

            {connected.servo1 && (
              <Zone label="Servo 1 · PWM4" className="flex items-center justify-center">
                <ServoMotor id={1} />
              </Zone>
            )}

            {connected.servo2 && (
              <Zone label="Servo 2 · PWM5" className="flex items-center justify-center">
                <ServoMotor id={2} />
              </Zone>
            )}

            {connected.elevator && (
              <Zone label="Elevator Interface" className="flex items-center justify-center">
                <ElevatorInterface />
              </Zone>
            )}

            {connected.buzzer && (
              <Zone label="Buzzer" className="flex items-center justify-center">
                <Buzzer />
              </Zone>
            )}
          </div>
        </div>
      )}

      {/* Idle drop overlay */}
      {!hexLoaded && (
        <div
          className={cn(
            "absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-bg/75 backdrop-blur-sm transition-colors",
            dragOver && "bg-accent-soft",
          )}
        >
          <div
            className={cn(
              "flex flex-col items-center gap-5 rounded-xl border-2 border-dashed px-14 py-12 text-center transition-colors",
              dragOver ? "border-accent bg-accent-soft" : "border-line-strong",
            )}
          >
            <Circuitry size={44} className="text-accent" weight="duotone" />
            <div>
              <p className="text-[15px] font-semibold text-fg">
                Drop a compiled program to begin
              </p>
              <p className="mt-1.5 max-w-[260px] text-[13px] text-muted">
                Intel HEX (.hex) · raw .bin · ELF (.elf)
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-md border border-accent-line bg-accent-soft px-5 py-2 text-[13px] font-medium text-accent-strong transition-transform active:translate-y-px hover:bg-[rgba(255,180,77,0.22)]"
            >
              <UploadSimple size={15} weight="bold" />
              Choose file
            </button>
            {error && (
              <p className="max-w-xs text-[11px] text-signal-red">{error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
