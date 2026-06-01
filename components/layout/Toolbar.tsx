"use client";

import { useRef } from "react";
import { useSim } from "@/store/simulatorStore";
import { Button } from "@/components/ui/Button";
import { readProgramFile } from "@/components/board/BoardCanvas";
import {
  Play, Pause, Stop, ArrowFatDown, ArrowFatRight, ArrowFatUp,
  UploadSimple, ArrowCounterClockwise, Cpu, Lightning
} from "@phosphor-icons/react";
import { hexN } from "@/lib/cn";
import type { SimSpeed } from "@/store/simulatorStore";

const SPEEDS = [0.25, 0.5, 1, 2, 10, "max"] as const;

export function Toolbar() {
  const status = useSim((s) => s.status);
  const speed = useSim((s) => s.speed);
  const cycles = useSim((s) => s.snap.cpu.cycles);
  const pc = useSim((s) => s.snap.cpu.pc);
  const load = useSim((s) => s.load);
  const hexLoaded = useSim((s) => s.hexLoaded);
  const run = useSim((s) => s.run);
  const pause = useSim((s) => s.pause);
  const stop = useSim((s) => s.stop);
  const reset = useSim((s) => s.reset);
  const stepInto = useSim((s) => s.stepInto);
  const stepOver = useSim((s) => s.stepOver);
  const stepOut = useSim((s) => s.stepOut);
  const setSpeed = useSim((s) => s.setSpeed);
  const loadHexText = useSim((s) => s.loadHexText);
  const loadBytes  = useSim((s) => s.loadBytes);
  const loadElf    = useSim((s) => s.loadElf);
  const fileRef = useRef<HTMLInputElement>(null);

  const isRunning = status === "running";
  const canStep = hexLoaded && !isRunning;
  const canRun = hexLoaded;

  const statusColor: Record<typeof status, string> = {
    idle: "text-muted",
    running: "text-signal live-pulse",
    paused: "text-accent",
    breakpoint: "text-signal-red",
    halted: "text-muted",
    error: "text-signal-red",
  };
  const statusLabel: Record<typeof status, string> = {
    idle: "IDLE",
    running: "RUNNING",
    paused: "PAUSED",
    breakpoint: "BREAKPOINT",
    halted: "HALTED",
    error: "ERROR",
  };

  return (
    <header className="relative z-20 flex h-11 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
      {/* Logo */}
      <div className="flex items-center gap-2 pr-3 border-r border-line">
        <Cpu size={18} className="text-accent" weight="duotone" />
        <span className="font-mono text-sm font-semibold text-fg">
          LOKI<span className="text-accent">-SIM</span>
        </span>
        <span className="hidden text-[9px] uppercase tracking-[0.2em] text-muted xl:block">
          LPC2148 · ARM7TDMI-S
        </span>
      </div>

      {/* File load — hidden input paired with a visible toolbar button */}
      <label className="sr-only" htmlFor="toolbar-file-input">Open hex file</label>
      <input
        id="toolbar-file-input"
        ref={fileRef}
        type="file"
        accept=".hex,.bin,.elf"
        aria-label="Open hex file"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await readProgramFile(f, loadHexText, loadBytes, loadElf);
          e.target.value = "";
        }}
      />
      <Button
        variant="accent"
        onClick={() => fileRef.current?.click()}
        aria-label="Open hex file (Ctrl+O)"
        title="Open .hex / .bin (Ctrl+O)"
      >
        <UploadSimple size={14} weight="bold" />
        <span className="hidden sm:inline">Open</span>
      </Button>

      {load && (
        <span className="hidden max-w-[160px] truncate font-mono text-[11px] text-muted lg:block" title={load.name}>
          {load.name}
        </span>
      )}

      {/* Separator */}
      <div className="h-5 w-px bg-line" />

      {/* Run controls */}
      <div className="flex items-center gap-1">
        {isRunning ? (
          <Button variant="accent" onClick={pause} aria-label="Pause (F5)" title="Pause (F5)">
            <Pause size={14} weight="fill" />
          </Button>
        ) : (
          <Button variant="accent" onClick={run} disabled={!canRun} aria-label="Run (F5)" title="Run (F5)">
            <Play size={14} weight="fill" />
          </Button>
        )}
        <Button onClick={stop} disabled={!hexLoaded} aria-label="Stop (Ctrl+F5)" title="Stop">
          <Stop size={14} weight="fill" />
        </Button>
        <Button onClick={reset} disabled={!hexLoaded} aria-label="Reset (Ctrl+R)" title="Reset">
          <ArrowCounterClockwise size={14} weight="bold" />
        </Button>
      </div>

      <div className="h-5 w-px bg-line" />

      {/* Step controls */}
      <div className="flex items-center gap-1">
        <Button onClick={stepInto} disabled={!canStep} title="Step Into (F11)">
          <ArrowFatDown size={13} weight="bold" />
          <span className="hidden md:inline text-[11px]">Into</span>
        </Button>
        <Button onClick={stepOver} disabled={!canStep} title="Step Over (F10)">
          <ArrowFatRight size={13} weight="bold" />
          <span className="hidden md:inline text-[11px]">Over</span>
        </Button>
        <Button onClick={stepOut} disabled={!canStep} title="Step Out (Shift+F11)">
          <ArrowFatUp size={13} weight="bold" />
          <span className="hidden md:inline text-[11px]">Out</span>
        </Button>
      </div>

      <div className="h-5 w-px bg-line" />

      {/* Speed */}
      <div className="flex items-center gap-1.5">
        <Lightning size={13} className="text-accent" weight="duotone" />
        <select
          value={String(speed)}
          onChange={(e) => {
            const v = e.target.value;
            setSpeed((v === "max" ? "max" : parseFloat(v)) as SimSpeed);
          }}
          className="rounded border border-line bg-bg px-1.5 py-0.5 font-mono text-[11px] text-fg outline-none focus:border-accent-line"
        >
          {SPEEDS.map((s) => (
            <option key={String(s)} value={String(s)}>
              {s === "max" ? "MAX" : `${s}x`}
            </option>
          ))}
        </select>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status + cycle counter */}
      <div className="flex items-center gap-4">
        <span className="hidden font-mono text-[10px] text-muted lg:block">
          PC <span className="text-mono">{hexN(pc, 8)}</span>
        </span>
        <span className="hidden font-mono text-[10px] text-muted lg:block">
          cyc <span className="text-mono tnum">{cycles.toLocaleString()}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isRunning ? "bg-signal live-pulse" : "bg-muted/40"
            }`}
          />
          <span className={`font-mono text-[10px] ${statusColor[status]}`}>
            {statusLabel[status]}
          </span>
        </div>
      </div>
    </header>
  );
}
