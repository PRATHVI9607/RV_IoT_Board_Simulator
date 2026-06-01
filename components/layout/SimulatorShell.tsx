"use client";

import { useKeyboard } from "@/hooks/useKeyboard";
import { Toolbar } from "./Toolbar";
import { BottomTabs } from "./BottomTabs";
import { BoardCanvas } from "@/components/board/BoardCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { BpFlashOverlay } from "./BpFlashOverlay";
import { CommandPalette } from "./CommandPalette";

export function SimulatorShell() {
  useKeyboard();

  return (
    <div className="sim-shell flex min-h-[100dvh] flex-col bg-bg text-fg">
      <BpFlashOverlay />
      <CommandPalette />
      <Toolbar />

      {/* Main workspace */}
      <div className="flex min-h-0 flex-1 gap-2 overflow-hidden p-2">
        <div className="min-w-0 flex-1 overflow-hidden">
          <BoardCanvas />
        </div>
        <aside className="w-[320px] shrink-0 overflow-hidden">
          <DebugPanel />
        </aside>
      </div>

      {/* Bottom tabs — oscilloscope, logic, serial, wiring */}
      <div className="shrink-0 p-2 pt-0">
        <BottomTabs />
      </div>
    </div>
  );
}
