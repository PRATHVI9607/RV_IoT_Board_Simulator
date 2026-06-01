"use client";

import { useRef, useEffect, useState } from "react";
import { useSim } from "@/store/simulatorStore";
import { hexN } from "@/lib/cn";
import { PanelHeader } from "@/components/ui/Panel";

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
    <div
      className={`flex items-center justify-between rounded px-1.5 py-0.5 transition-colors ${flash ? "reg-flash" : ""}`}
    >
      <span className="w-8 shrink-0 font-mono text-[11px] text-muted">{name}</span>
      <span className="font-mono text-[11px] text-mono tnum">{hexN(value, 8)}</span>
    </div>
  );
}

function FlagBit({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={`font-mono text-[10px] ${on ? "text-accent-strong" : "text-muted"}`}>
      {label}={on ? "1" : "0"}
    </span>
  );
}

export function RegisterWindow() {
  const regs = useSim((s) => s.snap.cpu.regs);
  const flags = useSim((s) => s.snap.cpu.flags);
  const mode = useSim((s) => s.snap.cpu.modeName);
  const thumb = useSim((s) => s.snap.cpu.thumb);
  const cpsr = useSim((s) => s.snap.cpu.cpsr);

  return (
    <div className="flex flex-col">
      <PanelHeader title="Registers" />
      <div className="overflow-auto p-2">
        <div className="grid grid-cols-2 gap-x-2">
          {REG_NAMES.map((n, i) => (
            <RegCell key={n} name={n} value={regs[i] ?? 0} />
          ))}
        </div>

        <div className="mt-2 border-t border-line pt-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted">CPSR</span>
            <span className="font-mono text-[11px] text-mono tnum">{hexN(cpsr, 8)}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <FlagBit label="N" on={flags.N} />
            <FlagBit label="Z" on={flags.Z} />
            <FlagBit label="C" on={flags.C} />
            <FlagBit label="V" on={flags.V} />
            <FlagBit label="I" on={flags.I} />
            <FlagBit label="F" on={flags.F} />
            <FlagBit label="T" on={thumb} />
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted">Mode</span>
            <span className="rounded bg-accent-soft px-1.5 font-mono text-[10px] text-accent">
              {mode}
            </span>
            {thumb && (
              <span className="rounded bg-[rgba(74,222,128,0.12)] px-1.5 font-mono text-[10px] text-signal">
                Thumb
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
