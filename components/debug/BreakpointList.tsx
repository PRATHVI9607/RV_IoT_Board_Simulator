"use client";

import { useSim } from "@/store/simulatorStore";
import { hexN } from "@/lib/cn";
import { PanelHeader } from "@/components/ui/Panel";
import { XCircle } from "@phosphor-icons/react";

export function BreakpointList() {
  const breakpoints = useSim((s) => s.breakpoints);
  const toggleBP = useSim((s) => s.toggleBreakpoint);

  return (
    <div className="flex flex-col">
      <PanelHeader title="Breakpoints" />
      <div className="min-h-[48px] overflow-auto p-2">
        {breakpoints.length === 0 ? (
          <p className="text-[10px] text-muted/60">
            Click an address in the disassembly to set a breakpoint.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {breakpoints.map((addr) => (
              <li key={addr} className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-mono">{hexN(addr, 8)}</span>
                <button
                  onClick={() => toggleBP(addr)}
                  aria-label={`Remove breakpoint at ${hexN(addr, 8)}`}
                  className="text-signal-red/70 hover:text-signal-red"
                >
                  <XCircle size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
