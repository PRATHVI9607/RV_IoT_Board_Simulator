"use client";

import { useState } from "react";
import { useSim, getEngine } from "@/store/simulatorStore";
import { PanelHeader } from "@/components/ui/Panel";
import { hexN } from "@/lib/cn";
import { CaretRight, CaretDown } from "@phosphor-icons/react";

interface RegDef { name: string; offset: number; bits?: string }
interface GroupDef { name: string; base: number; regs: RegDef[] }

const GROUPS: GroupDef[] = [
  { name: "GPIO", base: 0xe0028000, regs: [
    { name: "IO0PIN", offset: 0x00 }, { name: "IO0SET", offset: 0x04 },
    { name: "IO0DIR", offset: 0x08 }, { name: "IO0CLR", offset: 0x0c },
    { name: "IO1PIN", offset: 0x10 }, { name: "IO1SET", offset: 0x14 },
    { name: "IO1DIR", offset: 0x18 }, { name: "IO1CLR", offset: 0x1c },
  ]},
  { name: "UART0", base: 0xe000c000, regs: [
    { name: "U0RBR/THR", offset: 0x00 }, { name: "U0IER", offset: 0x04 },
    { name: "U0IIR/FCR", offset: 0x08 }, { name: "U0LCR", offset: 0x0c },
    { name: "U0LSR", offset: 0x14 },
  ]},
  { name: "Timer0", base: 0xe0004000, regs: [
    { name: "T0IR", offset: 0x00 }, { name: "T0TCR", offset: 0x04 },
    { name: "T0TC", offset: 0x08 }, { name: "T0PR", offset: 0x0c },
    { name: "T0MCR", offset: 0x14 }, { name: "T0MR0", offset: 0x18 },
    { name: "T0MR1", offset: 0x1c },
  ]},
  { name: "PWM", base: 0xe0014000, regs: [
    { name: "PWMTCR", offset: 0x04 }, { name: "PWMTC", offset: 0x08 },
    { name: "PWMMR0", offset: 0x18 }, { name: "PWMMR1", offset: 0x1c },
    { name: "PWMMR2", offset: 0x20 }, { name: "PWMMR4", offset: 0x28 },
    { name: "PWMMR5", offset: 0x2c }, { name: "PWMMR6", offset: 0x30 },
  ]},
  { name: "ADC1", base: 0xe0034000, regs: [
    { name: "AD1CR", offset: 0x00 }, { name: "AD1GDR", offset: 0x04 },
    { name: "AD1STAT", offset: 0x30 },
  ]},
  { name: "DAC", base: 0xe006c000, regs: [
    { name: "DACR", offset: 0x00 },
  ]},
  { name: "VIC", base: 0xfffff000, regs: [
    { name: "VICIRQStatus", offset: 0x00 }, { name: "VICIntEnable", offset: 0x10 },
    { name: "VICVectAddr", offset: 0x30 }, { name: "VICDefVectAddr", offset: 0x34 },
  ]},
];

function Group({ g }: { g: GroupDef }) {
  const [open, setOpen] = useState(false);
  useSim((s) => s.snap.cpu.cycles); // re-render each step
  const eng = getEngine();

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 px-2 py-1 hover:bg-pane text-left"
      >
        {open ? <CaretDown size={10} className="text-muted" /> : <CaretRight size={10} className="text-muted" />}
        <span className="text-[11px] font-medium text-accent/90">{g.name}</span>
        <span className="font-mono text-[9px] text-muted ml-auto">0x{hexN(g.base, 8)}</span>
      </button>
      {open && (
        <div className="border-l border-line ml-4 pl-2 pb-1">
          {g.regs.map(r => {
            const val = eng.bus.read(g.base + r.offset, 32);
            return (
              <div key={r.name} className="flex items-center justify-between py-[1px]">
                <span className="font-mono text-[10px] text-muted">{r.name}</span>
                <span className="font-mono text-[10px] text-mono tnum">{hexN(val, 8)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PeripheralRegs() {
  return (
    <div className="flex flex-col">
      <PanelHeader title="Peripheral Registers" />
      <div className="overflow-auto">
        {GROUPS.map(g => <Group key={g.name} g={g} />)}
      </div>
    </div>
  );
}
