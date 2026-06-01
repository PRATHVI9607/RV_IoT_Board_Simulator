"use client";

import { useRef, useEffect, useMemo } from "react";
import { useSim, getEngine } from "@/store/simulatorStore";
import { disassembleARM, disassembleThumb } from "@/lib/disassembler";
import { hexN } from "@/lib/cn";

const WINDOW = 14; // instructions visible above/below PC

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
      const mnem = thumb ? disassembleThumb(raw, addr) : disassembleARM(raw, addr);
      const isFlashZero = addr < 0x40000000 && raw === 0 && !hexLoaded;
      return { addr, raw, mnem: isFlashZero ? "-- (unloaded flash)" : mnem };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pc, thumb, breakpoints, hexLoaded]);

  useEffect(() => {
    pcRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [pc]);

  return (
    <div className="px-0 py-0">
      <div className="border-b border-line px-2 py-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">Disassembly</span>
        <span className="ml-2 font-mono text-[9px] text-muted/60">click to toggle breakpoint</span>
      </div>
      <div className="max-h-[200px] overflow-auto">
        {lines.map(({ addr, raw, mnem }) => {
          const isCurrent = addr === pc;
          const hasBP = breakpoints.includes(addr);
          return (
            <div
              key={addr}
              ref={isCurrent ? pcRef : undefined}
              onClick={() => toggleBP(addr)}
              className={`flex cursor-pointer items-center gap-1.5 py-[1px] pl-1.5 pr-2 font-mono text-[10px] select-none ${
                isCurrent ? "bg-accent-soft" : "hover:bg-pane"
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${hasBP ? "bg-signal-red" : "invisible"}`} />
              <span className="w-[68px] shrink-0 text-muted/60">{hexN(addr, 8)}</span>
              <span className={`truncate ${isCurrent ? "font-medium text-accent-strong" : "text-fg/80"}`}>
                {mnem}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
