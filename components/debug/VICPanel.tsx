"use client";

import { useSim, getEngine } from "@/store/simulatorStore";
import { PanelHeader } from "@/components/ui/Panel";
import { hexN } from "@/lib/cn";

const IRQ_NAMES: Record<number, string> = {
  0:"WDT", 4:"Timer0", 5:"Timer1", 6:"UART0", 7:"UART1", 8:"PWM",
  9:"I2C0", 10:"SPI0", 11:"SPI1", 12:"PLL", 13:"RTC",
  14:"EINT0", 15:"EINT1", 16:"EINT2", 17:"EINT3",
  18:"ADC0", 19:"I2C1", 21:"ADC1", 22:"USB",
};

export function VICPanel() {
  useSim((s) => s.snap.cpu.cycles); // re-render each frame

  const eng = getEngine();
  const irqStatus = eng.vic.read(0x000, 32);
  const intEnable = eng.vic.read(0x010, 32);
  const rawIntr   = eng.vic.read(0x008, 32);
  const intSel    = eng.vic.read(0x00c, 32);

  const slots = Array.from({ length: 24 }, (_, i) => ({
    n: i,
    name: IRQ_NAMES[i] ?? `IRQ${i}`,
    enabled: !!(intEnable & (1 << i)),
    pending: !!(irqStatus & (1 << i)),
    raw: !!(rawIntr & (1 << i)),
    fiq: !!(intSel & (1 << i)),
  }));

  return (
    <div className="flex flex-col">
      <PanelHeader
        title="VIC — Interrupt Controller"
        right={
          <span className="font-mono text-[9px] text-muted">
            ENABLE 0x{hexN(intEnable, 8)}
          </span>
        }
      />
      <div className="overflow-auto">
        <table className="w-full font-mono text-[10px]">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="px-2 py-1 text-left">IRQ</th>
              <th className="px-2 py-1 text-left">Name</th>
              <th className="px-2 py-1 text-center">EN</th>
              <th className="px-2 py-1 text-center">RAW</th>
              <th className="px-2 py-1 text-center">PEND</th>
              <th className="px-2 py-1 text-center">FIQ</th>
            </tr>
          </thead>
          <tbody>
            {slots.filter(s => s.enabled || s.raw || IRQ_NAMES[s.n]).map(s => (
              <tr key={s.n} className={s.pending ? "bg-signal-red/10" : "hover:bg-pane/60"}>
                <td className="px-2 py-[2px] text-muted">{s.n}</td>
                <td className="px-2 py-[2px] text-fg/80">{s.name}</td>
                <td className="px-2 py-[2px] text-center">{s.enabled ? <span className="text-accent">●</span> : <span className="text-muted/30">○</span>}</td>
                <td className="px-2 py-[2px] text-center">{s.raw ? <span className="text-signal-amber">●</span> : <span className="text-muted/30">○</span>}</td>
                <td className="px-2 py-[2px] text-center">{s.pending ? <span className="text-signal-red">●</span> : <span className="text-muted/30">○</span>}</td>
                <td className="px-2 py-[2px] text-center">{s.fiq ? <span className="text-[#b44dff]">FIQ</span> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
