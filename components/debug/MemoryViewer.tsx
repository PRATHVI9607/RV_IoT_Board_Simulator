"use client";

import { useState, useMemo } from "react";
import { useSim, getEngine } from "@/store/simulatorStore";
import { hexN } from "@/lib/cn";
import { MEM } from "@/sim/memory/memoryMap";

const ROWS = 12;
const COLS = 8; // 8 bytes/row fits the narrow side panel

function regionStyle(addr: number) {
  if (addr < MEM.FLASH_SIZE) return "text-[#7db4f5]";
  if (addr >= MEM.SRAM_BASE && addr < MEM.SRAM_BASE + MEM.SRAM_SIZE) return "text-signal";
  if (addr >= MEM.PERIPH_BASE) return "text-signal-amber";
  return "text-muted";
}

export function MemoryViewer() {
  const [addrInput, setAddrInput] = useState("");
  const baseAddr = useSim((s) => s.selectedMemAddr);
  const setBase = useSim((s) => s.setMemAddr);
  useSim((s) => s.snap.cpu.cycles); // re-render on step
  const eng = getEngine();

  const aligned = (baseAddr >>> 0) & ~(COLS - 1);

  const rows = useMemo(() => {
    return Array.from({ length: ROWS }, (_, r) => {
      const rowAddr = (aligned + r * COLS) >>> 0;
      return { rowAddr, bytes: eng.readMem(rowAddr, COLS) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aligned, eng.cpu.cycles]);

  function navigate(raw: string) {
    const n = parseInt(raw.replace(/^0x/i, ""), 16);
    if (!isNaN(n)) setBase(n);
  }

  return (
    <div className="px-0 py-0">
      {/* Header with region jump buttons */}
      <div className="flex items-center justify-between border-b border-line px-2 py-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">Memory</span>
        <div className="flex gap-1">
          <button type="button" className="rounded px-1.5 py-0.5 font-mono text-[9px] text-[#7db4f5] hover:bg-pane" onClick={() => setBase(0)}>Flash</button>
          <button type="button" className="rounded px-1.5 py-0.5 font-mono text-[9px] text-signal hover:bg-pane" onClick={() => setBase(0x40000000)}>SRAM</button>
        </div>
      </div>

      {/* Address jump input */}
      <div className="flex items-center gap-1.5 border-b border-line px-2 py-1.5">
        <span className="font-mono text-[10px] text-muted">0x</span>
        <input
          className="flex-1 rounded border border-line bg-bg px-2 py-0.5 font-mono text-[10px] text-fg outline-none focus:border-accent-line"
          placeholder={hexN(baseAddr, 8)}
          value={addrInput}
          onChange={(e) => setAddrInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { navigate(addrInput); setAddrInput(""); } }}
          aria-label="Jump to memory address"
        />
      </div>

      {/* Hex dump */}
      <div className="overflow-x-auto p-1">
        <table className="border-separate border-spacing-0 font-mono text-[10px]">
          <tbody>
            {rows.map(({ rowAddr, bytes }) => (
              <tr key={rowAddr} className="hover:bg-pane/60">
                <td className={`whitespace-nowrap px-1.5 py-[1px] pr-2 ${regionStyle(rowAddr)}`}>
                  {hexN(rowAddr, 8)}
                </td>
                {Array.from(bytes).map((b, j) => (
                  <td key={j} className={`px-[2px] py-[1px] tnum tabular-nums ${b === 0 ? "text-muted/30" : "text-mono"}`}>
                    {hexN(b, 2)}
                  </td>
                ))}
                <td className="whitespace-nowrap pl-2 text-muted/50">
                  {Array.from(bytes).map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".")).join("")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
