"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { RegisterWindow } from "./RegisterWindow";
import { Disassembler } from "./Disassembler";
import { MemoryViewer } from "./MemoryViewer";
import { BreakpointList } from "./BreakpointList";
import { VICPanel } from "./VICPanel";
import { PeripheralRegs } from "./PeripheralRegs";

const TABS = ["CPU", "Peripherals", "VIC"] as const;
type Tab = (typeof TABS)[number];

export function DebugPanel() {
  const [tab, setTab] = useState<Tab>("CPU");

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      {/* Tab switcher */}
      <div className="flex shrink-0 gap-0.5 rounded-md border border-line bg-panel px-1 py-0.5">
        {TABS.map(t => (
          <button
            type="button"
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded py-1 text-center font-mono text-[10px] transition-colors ${
              tab === t ? "bg-pane text-accent" : "text-muted hover:text-fg"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "CPU" && (
        <>
          <Panel className="shrink-0">
            <RegisterWindow />
          </Panel>
          <Panel className="shrink-0">
            <BreakpointList />
          </Panel>
          <Panel className="shrink-0">
            <Disassembler />
          </Panel>
          <Panel className="min-h-0 flex-1 overflow-hidden">
            <MemoryViewer />
          </Panel>
        </>
      )}

      {tab === "Peripherals" && (
        <Panel className="min-h-0 flex-1 overflow-hidden">
          <PeripheralRegs />
        </Panel>
      )}

      {tab === "VIC" && (
        <Panel className="min-h-0 flex-1 overflow-hidden">
          <VICPanel />
        </Panel>
      )}
    </div>
  );
}
