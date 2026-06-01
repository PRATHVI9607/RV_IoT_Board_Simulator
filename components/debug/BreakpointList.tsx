"use client";

import { useSim } from "@/store/simulatorStore";
import { hexN } from "@/lib/cn";
import { XCircle } from "@phosphor-icons/react";

export function BreakpointList() {
  const breakpoints = useSim((s) => s.breakpoints);
  const toggleBP = useSim((s) => s.toggleBreakpoint);

  // Hide entirely when empty to save vertical space.
  if (breakpoints.length === 0) return null;

  return (
    <div className="px-0 py-0">
      <div className="border-b border-line px-2 py-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
          Breakpoints ({breakpoints.length})
        </span>
      </div>
      <ul className="max-h-[88px] space-y-0.5 overflow-auto p-2">
        {breakpoints.map((addr) => (
          <li key={addr} className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-mono">{hexN(addr, 8)}</span>
            <button
              type="button"
              onClick={() => toggleBP(addr)}
              aria-label={`Remove breakpoint at ${hexN(addr, 8)}`}
              className="text-signal-red/70 hover:text-signal-red"
            >
              <XCircle size={13} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
