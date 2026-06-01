"use client";

import { useState, useRef, useCallback } from "react";
import { useSim } from "@/store/simulatorStore";
import { Button } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/Panel";
import { Trash } from "@phosphor-icons/react";

/** External component palette entry. */
interface ExtComponent {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  pin?: number; // LPC2148 port-0 pin this connects to
  port?: 0 | 1;
}

const PALETTE_ITEMS = [
  { type: "led",       label: "LED",          color: "#4ade80" },
  { type: "button",    label: "Push Button",  color: "#ffb44d" },
  { type: "ldr",       label: "LDR",          color: "#ffd600" },
  { type: "lm35",      label: "LM35 Temp",    color: "#f87171" },
  { type: "ultrasonic",label: "HC-SR04",      color: "#4dc3ff" },
  { type: "oled",      label: "SSD1306 OLED", color: "#b44dff" },
  { type: "relay",     label: "Relay Module", color: "#ff944d" },
  { type: "hc05",      label: "HC-05 BT",     color: "#00d4ff" },
];

let uid = 0;

export function WiringCanvas() {
  const [components, setComponents] = useState<ExtComponent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const canvasRef = useRef<SVGSVGElement>(null);

  const addComponent = (type: string, label: string) => {
    const id = `${type}_${uid++}`;
    setComponents(cs => [...cs, { id, type, label, x: 80 + Math.random() * 160, y: 60 + Math.random() * 100 }]);
  };

  const deleteSelected = () => {
    if (selected) setComponents(cs => cs.filter(c => c.id !== selected));
    setSelected(null);
  };

  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragging.ox;
    const y = e.clientY - rect.top - dragging.oy;
    setComponents(cs => cs.map(c => c.id === dragging.id ? { ...c, x, y } : c));
  }, [dragging]);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="External Peripheral Wiring"
        right={
          selected && (
            <Button variant="danger" onClick={deleteSelected}>
              <Trash size={12} /> Remove
            </Button>
          )
        }
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Palette */}
        <div className="w-36 shrink-0 overflow-auto border-r border-line p-2">
          <p className="mb-2 text-[9px] uppercase tracking-[0.18em] text-muted">Components</p>
          {PALETTE_ITEMS.map(item => (
            <button
              key={item.type}
              onClick={() => addComponent(item.type, item.label)}
              className="mb-1 flex w-full items-center gap-2 rounded border border-line bg-pane px-2 py-1.5 text-left hover:border-accent-line"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] text-fg/80">{item.label}</span>
            </button>
          ))}
        </div>
        {/* Canvas area */}
        <div className="relative flex-1 overflow-hidden bg-[#090d0f]">
          <svg
            ref={canvasRef}
            className="h-full w-full"
            onMouseMove={onMouseMove}
            onMouseUp={() => setDragging(null)}
            onMouseLeave={() => setDragging(null)}
          >
            <defs>
              <pattern id="pcb-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e2a3a" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pcb-grid)" />

            {/* Wires (simple lines from component to a pin stub on the right) */}
            {components.filter(c => c.pin !== undefined).map(c => (
              <line
                key={`wire-${c.id}`}
                x1={c.x + 40}
                y1={c.y + 12}
                x2={c.x + 80}
                y2={c.y + 12}
                stroke={PALETTE_ITEMS.find(p => p.type === c.type)?.color ?? "#4ade80"}
                strokeWidth="1.5"
                strokeDasharray="4 2"
                opacity="0.6"
              />
            ))}

            {/* Components */}
            {components.map(c => {
              const item = PALETTE_ITEMS.find(p => p.type === c.type);
              const color = item?.color ?? "#4ade80";
              const isSel = c.id === selected;
              return (
                <g
                  key={c.id}
                  transform={`translate(${c.x},${c.y})`}
                  onClick={() => setSelected(isSel ? null : c.id)}
                  onMouseDown={e => {
                    e.stopPropagation();
                    setDragging({ id: c.id, ox: e.clientX - canvasRef.current!.getBoundingClientRect().left - c.x, oy: e.clientY - canvasRef.current!.getBoundingClientRect().top - c.y });
                  }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <rect
                    x="0" y="0" width="80" height="24" rx="4"
                    fill="#12151b"
                    stroke={isSel ? "#ffb44d" : color}
                    strokeWidth={isSel ? 1.5 : 1}
                    opacity="0.9"
                  />
                  <circle cx="6" cy="12" r="3" fill={color} />
                  <circle cx="74" cy="12" r="3" fill={color} opacity="0.5" />
                  <text x="14" y="16" fontSize="9" fill="#e2e8f0" fontFamily="monospace">{c.label}</text>
                </g>
              );
            })}
          </svg>
          {components.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-center text-[11px] text-muted/50">
                Add components from the palette and drag to place them.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
