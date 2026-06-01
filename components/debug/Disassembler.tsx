"use client";

import { useRef, useEffect, useMemo } from "react";
import { useSim, getEngine } from "@/store/simulatorStore";
import { disassembleARM, disassembleThumb } from "@/lib/disassembler";
import { hexN } from "@/lib/cn";
import { PanelHeader } from "@/components/ui/Panel";

const WINDOW = 32; // instructions visible above/below PC

export function Disassembler() {
  const pc = useSim((s) => s.snap.cpu.pc);
  const thumb = useSim((s) => s.snap.cpu.thumb);
  const breakpoints = useSim((s) => s.breakpoints);
  const toggleBP = useSim((s) => s.toggleBreakpoint);
  const pcRef = useRef<HTMLDivElement>(null);
  const eng = getEngine();

  const hexLoaded = useSim((s) => s.hexLoaded);

  const lines = useMemo(() => {
    const step = thumb ? 2 : 4;
    const startAddr = Math.max(0, pc - WINDOW * step) & ~(step - 1);
    const count = WINDOW * 2 + 1;
    return Array.from({ length: count }, (_, i) => {
      const addr = (startAddr + i * step) >>> 0;
      const raw = thumb ? eng.bus.read16(addr) : eng.bus.read32(addr);
      const mnem = thumb
        ? disassembleThumb(raw, addr)
        : disassembleARM(raw, addr);
      // Label uninitialised flash as a hint rather than silently decoding zeros.
      const isFlashZero = addr < 0x40000000 && raw === 0 && !hexLoaded;
      return { addr, raw, mnem: isFlashZero ? "-- (unloaded flash)" : mnem };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pc, thumb, breakpoints, hexLoaded]);

  useEffect(() => {
    pcRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [pc]);

  return (
    <div className="flex flex-col">
      <PanelHeader title="Disassembly" />
      <div className="max-h-[280px] overflow-auto font-mono text-[11px]">
        {lines.map(({ addr, raw, mnem }) => {
          const isCurrent = addr === pc;
          const hasBP = breakpoints.includes(addr);
          return (
            <div
              key={addr}
              ref={isCurrent ? pcRef : undefined}
              onClick={() => toggleBP(addr)}
              className={`flex cursor-pointer items-center gap-2 px-2 py-[2px] select-none ${
                isCurrent
                  ? "bg-accent-soft text-accent-strong"
                  : "text-muted hover:bg-pane"
              }`}
            >
              {/* Breakpoint indicator */}
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  hasBP ? "bg-signal-red shadow-[0_0_6px_rgba(248,113,113,0.7)]" : "bg-transparent"
                }`}
              />
              <span className="w-20 shrink-0 text-muted/70">{hexN(addr, 8)}</span>
              <span className="w-20 shrink-0 text-muted/50">
                {thumb ? hexN(raw & 0xffff, 4) : hexN(raw, 8)}
              </span>
              <span className={isCurrent ? "text-accent-strong" : "text-fg/80"}>{mnem}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
