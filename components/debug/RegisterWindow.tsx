"use client";

import { useRef, useEffect, useState } from "react";
import { useSim } from "@/store/simulatorStore";
import { hexN } from "@/lib/cn";

const REG_NAMES = [
  "R0","R1","R2","R3","R4","R5","R6","R7",
  "R8","R9","R10","R11","R12","SP","LR","PC",
];

function RegCell({ name, value }: { name: string; value: number }) {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 320);
      return () => clearTimeout(id);
    }
  }, [value]);

  return (
    <div className={`flex items-center gap-1 rounded px-1 py-[2px] ${flash ? "reg-flash" : ""}`}>
      <span className="w-7 shrink-0 font-mono text-[10px] text-muted">{name}</span>
      <span className="font-mono text-[10px] text-mono tnum leading-none">{hexN(value, 8)}</span>
    </div>
  );
}

export function RegisterWindow() {
  const regs = useSim((s) => s.snap.cpu.regs);
  const flags = useSim((s) => s.snap.cpu.flags);
  const mode = useSim((s) => s.snap.cpu.modeName);
  const thumb = useSim((s) => s.snap.cpu.thumb);
  const cpsr = useSim((s) => s.snap.cpu.cpsr);

  return (
    <div className="px-2 py-2">
      {/* Section label */}
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">Registers</span>
        <span className="flex items-center gap-1.5">
          <span className="rounded bg-accent-soft px-1.5 font-mono text-[9px] text-accent">{mode}</span>
          {thumb && <span className="rounded bg-[rgba(74,222,128,0.1)] px-1.5 font-mono text-[9px] text-signal">T</span>}
        </span>
      </div>

      {/* R0-R15 in 2-column grid */}
      <div className="grid grid-cols-2 gap-x-2">
        {REG_NAMES.map((n, i) => (
          <RegCell key={n} name={n} value={regs[i] ?? 0} />
        ))}
      </div>

      {/* CPSR + flags */}
      <div className="mt-1.5 border-t border-line pt-1.5">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted">CPSR</span>
          <span className="font-mono text-[10px] text-mono tnum">{hexN(cpsr, 8)}</span>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          {(["N","Z","C","V","I","F","T"] as const).map(f => {
            const on = f === "T" ? thumb : flags[f as keyof typeof flags];
            return (
              <span key={f} className={`font-mono text-[10px] ${on ? "text-accent-strong" : "text-muted/40"}`}>
                {f}={on ? "1" : "0"}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
