"use client";

import { useState } from "react";
import { RegisterWindow } from "./RegisterWindow";
import { Disassembler } from "./Disassembler";
import { MemoryViewer } from "./MemoryViewer";
import { BreakpointList } from "./BreakpointList";
import { VICPanel } from "./VICPanel";
import { PeripheralRegs } from "./PeripheralRegs";
import { cn } from "@/lib/cn";

const TABS = [
  { id: "cpu",   label: "CPU",   short: "CPU" },
  { id: "periph",label: "Periph",short: "PER" },
  { id: "vic",   label: "VIC",   short: "VIC" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function DebugPanel() {
  const [tab, setTab] = useState<TabId>("cpu");

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-panel">
      {/* Tab header — part of the panel chrome */}
      <div className="flex shrink-0 items-stretch border-b border-line">
        {TABS.map(t => (
          <button
            type="button"
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 py-2 text-center font-mono text-[11px] font-semibold tracking-wide transition-colors",
              "hover:bg-pane focus-visible:z-10",
              tab === t.id
                ? "bg-pane text-accent"
                : "text-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — scrollable, fills remaining space */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "cpu"    && <CPUTab />}
        {tab === "periph" && <PeripheralRegs />}
        {tab === "vic"    && <VICPanel />}
      </div>
    </div>
  );
}

/** CPU tab — registers, disasm, memory, breakpoints stacked vertically and scrollable */
function CPUTab() {
  return (
    <div className="flex flex-col divide-y divide-line">
      <RegisterWindow />
      <Disassembler />
      <BreakpointList />
      <MemoryViewer />
    </div>
  );
}
