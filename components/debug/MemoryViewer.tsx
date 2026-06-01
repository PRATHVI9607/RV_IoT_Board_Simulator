"use client";

import { useState, useMemo } from "react";
import { useSim, getEngine } from "@/store/simulatorStore";
import { hexN } from "@/lib/cn";
import { PanelHeader } from "@/components/ui/Panel";
import { MEM } from "@/sim/memory/memoryMap";

const ROWS = 16;
const COLS = 16;

function regionStyle(addr: number) {
  if (addr < MEM.FLASH_SIZE) return "text-[#7db4f5]";
  if (addr >= MEM.SRAM_BASE && addr < MEM.SRAM_BASE + MEM.SRAM_SIZE)
    return "text-signal";
  if (addr >= MEM.PERIPH_BASE) return "text-signal-amber";
  return "text-muted";
}

export function MemoryViewer() {
  const [addrInput, setAddrInput] = useState("");
  const baseAddr = useSim((s) => s.selectedMemAddr);
  const setBase = useSim((s) => s.setMemAddr);
  // Re-render when CPU steps (cycles change).
  useSim((s) => s.snap.cpu.cycles);
  const eng = getEngine();

  const aligned = (baseAddr >>> 0) & ~(COLS - 1);

  const rows = useMemo(() => {
    return Array.from({ length: ROWS }, (_, r) => {
      const rowAddr = (aligned + r * COLS) >>> 0;
      const bytes = eng.readMem(rowAddr, COLS);
      return { rowAddr, bytes };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aligned, eng.cpu.cycles]);

  function navigate(raw: string) {
    const n = parseInt(raw.replace(/^0x/i, ""), 16);
    if (!isNaN(n)) setBase(n);
  }

  return (
    <div className="flex flex-col">
      <PanelHeader
        title="Memory"
        right={
          <div className="flex gap-1">
            <button
              className="rounded px-2 py-0.5 font-mono text-[10px] text-muted hover:bg-pane"
              onClick={() => setBase(0x00000000)}
            >
              Flash
            </button>
            <button
              className="rounded px-2 py-0.5 font-mono text-[10px] text-muted hover:bg-pane"
              onClick={() => setBase(0x40000000)}
            >
              SRAM
            </button>
          </div>
        }
      />
      <div className="flex items-center gap-2 border-b border-line px-2 py-1.5">
        <span className="font-mono text-[10px] text-muted">0x</span>
        <input
          className="flex-1 rounded border border-line bg-bg px-2 py-0.5 font-mono text-[11px] text-fg outline-none focus:border-accent-line"
          placeholder={hexN(baseAddr, 8)}
          value={addrInput}
          onChange={(e) => setAddrInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              navigate(addrInput);
              setAddrInput("");
            }
          }}
        />
      </div>
      <div className="overflow-auto p-1">
        <table className="w-full border-separate border-spacing-0 font-mono text-[10px]">
          <tbody>
            {rows.map(({ rowAddr, bytes }) => (
              <tr key={rowAddr} className="hover:bg-pane/60">
                <td className={`px-2 py-[1px] pr-3 ${regionStyle(rowAddr)}`}>
                  {hexN(rowAddr, 8)}
                </td>
                {Array.from(bytes).map((b, j) => (
                  <td
                    key={j}
                    className={`px-[3px] py-[1px] tnum tabular-nums ${
                      b === 0 ? "text-muted/30" : "text-mono"
                    }`}
                  >
                    {hexN(b, 2)}
                  </td>
                ))}
                <td className="pl-3 pr-1 text-muted/50">
                  {Array.from(bytes)
                    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
                    .join("")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
