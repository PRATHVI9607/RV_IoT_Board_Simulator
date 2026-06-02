"use client";

import { useKeyboard } from "@/hooks/useKeyboard";
import { useResizable } from "@/hooks/useResizable";
import { Toolbar } from "./Toolbar";
import { BottomTabs } from "./BottomTabs";
import { BoardCanvas } from "@/components/board/BoardCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { BpFlashOverlay } from "./BpFlashOverlay";
import { CommandPalette } from "./CommandPalette";
import { PeripheralSidebar } from "./PeripheralSidebar";

/**
 * 4-zone resizable IDE layout:
 *
 *   ┌─ TOOLBAR (44px fixed) ───────────────────────────────────────────────┐
 *   │  ← SIDEBAR →│← ─── BOARD (flex-1) ──── →│← DEBUG →               │
 *   ├── drag ──────╫───────────────────────────╫── drag ──────────────────┤
 *   └─ INSTRUMENTS (resizable height) ────────────────────────────────────┘
 *
 * The sidebar / board / debug row is bisected by thin drag-handle dividers.
 * The bottom instruments panel is resized by dragging its top edge UP/DOWN.
 */
export function SimulatorShell() {
  useKeyboard();

  // Sidebar and debug are sized in pixels; bottom is also pixels.
  const sidebar = useResizable("sidebar", 230, 160, 340);
  const debug   = useResizable("debug",   340, 220, 520);
  // Bottom handle: dragging UP makes the panel taller → negate=true.
  const bottom  = useResizable("bottom",  260, 140, 580, "vertical", true);

  return (
    <div className="sim-shell flex h-[100dvh] flex-col overflow-hidden bg-bg text-fg">
      <BpFlashOverlay />
      <CommandPalette />
      <Toolbar />

      {/* ── Middle row: sidebar | board | debug ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Left peripheral sidebar */}
        {/* eslint-disable-next-line react/forbid-component-props -- dynamic pixel value */}
        <div className="shrink-0 overflow-hidden" style={{ width: sidebar.size }}>
          <PeripheralSidebar />
        </div>

        <DragHandle kind="col" onMouseDown={sidebar.onDragStart} />

        {/* Center board canvas */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <BoardCanvas />
        </div>

        <DragHandle kind="col" onMouseDown={debug.onDragStart} />

        {/* Right debug panel */}
        {/* eslint-disable-next-line react/forbid-component-props -- dynamic pixel value */}
        <div className="shrink-0 overflow-hidden" style={{ width: debug.size }}>
          <DebugPanel />
        </div>
      </div>

      {/* ── Bottom resize handle ── */}
      <DragHandle kind="row" onMouseDown={bottom.onDragStart} />

      {/* ── Bottom instruments ── */}
      {/* eslint-disable-next-line react/forbid-component-props -- dynamic pixel value */}
      <div className="shrink-0 overflow-hidden" style={{ height: bottom.size }}>
        <BottomTabs />
      </div>
    </div>
  );
}

/** A 4px drag handle strip with an amber nub on hover. */
function DragHandle({
  kind,
  onMouseDown,
}: {
  kind: "col" | "row";
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const isCol = kind === "col";
  return (
    <div
      role="separator"
      aria-orientation={isCol ? ("vertical" as const) : ("horizontal" as const)}
      onMouseDown={onMouseDown}
      className={[
        "group shrink-0 select-none bg-bg transition-colors hover:bg-accent/10 active:bg-accent/20",
        isCol ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize",
      ].join(" ")}
    >
      {/* Visible nub */}
      <div className="flex h-full w-full items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
        {isCol ? (
          <div className="h-10 w-px rounded-full bg-accent/50" />
        ) : (
          <div className="h-px w-10 rounded-full bg-accent/50" />
        )}
      </div>
    </div>
  );
}
