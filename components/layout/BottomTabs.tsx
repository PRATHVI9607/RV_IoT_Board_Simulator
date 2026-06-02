"use client";

import { useState } from "react";
import { SerialMonitor } from "@/components/instruments/SerialMonitor";
import { Oscilloscope } from "@/components/instruments/Oscilloscope";
import { LogicAnalyzer } from "@/components/instruments/LogicAnalyzer";
import { PinControl } from "@/components/instruments/PinControl";
import { WiringCanvas } from "@/components/wiring/WiringCanvas";
import { Panel } from "@/components/ui/Panel";
import { useSim, getEngine } from "@/store/simulatorStore";

const TABS = [
  { id: "serial",   label: "Serial Monitor" },
  { id: "pins",     label: "GPIO Pins" },
  { id: "scope",    label: "Oscilloscope" },
  { id: "logic",    label: "Logic Analyzer" },
  { id: "wiring",   label: "Wiring" },
  { id: "events",   label: "Event Log" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function BottomTabs() {
  const [active, setActive] = useState<TabId>("serial");
  const warnings = useSim((s) => s.snap.warnings);

  return (
    <Panel className="flex h-full flex-col overflow-hidden">
      {/* Tab bar — large, accessible buttons */}
      <div className="flex shrink-0 items-stretch border-b border-line">
        {TABS.map(t => (
          <button
            type="button"
            key={t.id}
            onClick={() => setActive(t.id)}
            className={[
              "relative flex-1 px-2 py-2.5 font-mono text-[11px] font-medium transition-colors",
              "hover:bg-pane focus-visible:z-10",
              active === t.id
                ? "bg-pane text-accent after:absolute after:bottom-0 after:inset-x-0 after:h-[2px] after:bg-accent"
                : "text-muted",
            ].join(" ")}
          >
            {t.label}
            {t.id === "events" && warnings > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-signal-red/20 px-1 font-mono text-[9px] text-signal-red">
                {warnings > 99 ? "99+" : warnings}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content — min-h-0 so it doesn't push tab bar off screen */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {active === "serial"  && <SerialMonitor />}
        {active === "pins"    && <PinControl />}
        {active === "scope"   && <Oscilloscope />}
        {active === "logic"   && <LogicAnalyzer />}
        {active === "wiring"  && <WiringCanvas />}
        {active === "events"  && <EventLog />}
      </div>
    </Panel>
  );
}

function EventLog() {
  useSim((s) => s.snap.warnings);
  const eng = getEngine();
  const warnList = eng.bus.warnings.slice(-100);

  return (
    <div className="h-full overflow-auto p-3">
      {warnList.length === 0 ? (
        <p className="font-mono text-[11px] text-muted/60">
          No bus warnings. Unmapped reads/writes (e.g. accessing 0xFFFFFFFF) appear here.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {[...warnList].reverse().map((w, i) => (
            <li key={i} className="font-mono text-[10px] text-signal-amber">
              <span className="text-muted/60">cyc {w.cycle}</span> {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
