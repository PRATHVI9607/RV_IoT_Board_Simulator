"use client";

import { useKeyboard } from "@/hooks/useKeyboard";
import { Toolbar } from "./Toolbar";
import { BottomTabs } from "./BottomTabs";
import { BoardCanvas } from "@/components/board/BoardCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { BpFlashOverlay } from "./BpFlashOverlay";
import { CommandPalette } from "./CommandPalette";

/**
 * IDE-style fixed layout:
 *   Toolbar (44px)
 *   ─────────────────────────────────────────
 *   Board Canvas (flex-1) │ Debug Panel (340px)
 *   ─────────────────────────────────────────
 *   Bottom Tabs (240px)
 *
 * Each region manages its own overflow independently.
 */
export function SimulatorShell() {
  useKeyboard();

  return (
    <div className="sim-shell flex h-[100dvh] flex-col overflow-hidden bg-bg text-fg">
      <BpFlashOverlay />
      <CommandPalette />

      {/* Top toolbar — fixed height, never compressed */}
      <Toolbar />

      {/* Middle: board + debug — flex-1, min-h-0 is critical to prevent overflow */}
      <div className="flex min-h-0 flex-1 gap-2 overflow-hidden p-2 pb-1">
        {/* Board canvas — scrollable if content is large */}
        <div className="min-w-0 flex-1 overflow-hidden rounded-lg">
          <BoardCanvas />
        </div>

        {/* Debug panel — fixed width, fully scrollable */}
        <aside className="flex w-[340px] min-w-[280px] max-w-[380px] shrink-0 flex-col overflow-hidden">
          <DebugPanel />
        </aside>
      </div>

      {/* Bottom instruments — fixed 240px, never compressed */}
      <div className="h-[240px] shrink-0 px-2 pb-2">
        <BottomTabs />
      </div>
    </div>
  );
}
