"use client";

import { useState } from "react";
import { SerialMonitor } from "@/components/instruments/SerialMonitor";
import { Oscilloscope } from "@/components/instruments/Oscilloscope";
import { LogicAnalyzer } from "@/components/instruments/LogicAnalyzer";
import { WiringCanvas } from "@/components/wiring/WiringCanvas";
import { Panel } from "@/components/ui/Panel";
import { useSim, getEngine } from "@/store/simulatorStore";

const TABS = ["Serial Monitor", "Oscilloscope", "Logic Analyzer", "Wiring", "Event Log"] as const;
type Tab = (typeof TABS)[number];

export function BottomTabs() {
  const [active, setActive] = useState<Tab>("Serial Monitor");
  const warnings = useSim((s) => s.snap.warnings);

  return (
    <Panel className="h-[220px] overflow-hidden">
      <div className="flex shrink-0 items-center gap-0.5 border-b border-line px-2">
        {TABS.map(t => (
          <button
            type="button"
            key={t}
            onClick={() => setActive(t)}
            className={`flex items-center gap-1 px-3 py-2 font-mono text-[11px] transition-colors ${
              active === t ? "border-b-2 border-accent text-accent" : "text-muted hover:text-fg"
            }`}
          >
            {t}
            {t === "Event Log" && warnings > 0 && (
              <span className="rounded-full bg-signal-red/20 px-1 font-mono text-[9px] text-signal-red">
                {warnings}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {active === "Serial Monitor"  && <SerialMonitor />}
        {active === "Oscilloscope"    && <Oscilloscope />}
        {active === "Logic Analyzer"  && <LogicAnalyzer />}
        {active === "Wiring"          && <WiringCanvas />}
        {active === "Event Log"       && <EventLog />}
      </div>
    </Panel>
  );
}

function EventLog() {
  useSim((s) => s.snap.warnings); // re-subscribe
  const eng = getEngine();
  const warnList = eng.bus.warnings.slice(-50);

  return (
    <div className="overflow-auto p-2">
      {warnList.length === 0 ? (
        <p className="font-mono text-[11px] text-muted/60">
          Bus warnings (unmapped reads/writes) appear here.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {warnList.map((w, i) => (
            <li key={i} className="font-mono text-[10px] text-signal-amber">
              cyc {w.cycle}: {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
