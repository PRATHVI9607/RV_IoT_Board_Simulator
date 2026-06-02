"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSim, getEngine } from "@/store/simulatorStore";
import { PixiScope } from "@/lib/pixiScope";
import { Button } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/Panel";
import { Play, Pause, Camera } from "@phosphor-icons/react";

const COLORS = [0x00d4ff, 0xffcc00, 0x4ade80, 0xb44dff];
const LABELS = ["CH1 DAC", "CH2 PWM6", "CH3 P0.0", "CH4 P0.1"];
const TIMEBASES = [0.05, 0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000];

export function Oscilloscope() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const scopeRef   = useRef<PixiScope | null>(null);
  const [phosphor, setPhosphor] = useState(false);
  const [running, setRunning] = useState(true);
  const [timebaseIdx, setTimebaseIdx] = useState(3);
  const duty = useSim(s => s.snap.periph.pwmDuty);
  const gpio = useSim(s => s.snap.gpio);

  const buildChannels = useCallback(() => {
    const eng = getEngine();
    const dacSamples = eng.dac.samples;
    const writePos = eng.dac.sampleCount % 4096;
    const pwm6Duty = duty[5];
    const pwmSamples = new Float32Array(4096).fill(pwm6Duty * 3.3);
    const p0out = gpio.out[0];
    return [
      { label: LABELS[0], color: COLORS[0], samples: dacSamples, writePos, totalSamples: Math.min(4096, eng.dac.sampleCount), enabled: true, vOffset: 0.5, scale: 1.0 },
      { label: LABELS[1], color: COLORS[1], samples: pwmSamples, writePos: 0, totalSamples: 4096, enabled: pwm6Duty > 0.01, vOffset: 0.2, scale: 1.0 },
      { label: LABELS[2], color: COLORS[2], samples: new Float32Array(4096).fill((p0out & 1) ? 3.3 : 0), writePos: 0, totalSamples: 4096, enabled: (gpio.dir[0] & 1) !== 0, vOffset: 0.7, scale: 1.0 },
      { label: LABELS[3], color: COLORS[3], samples: new Float32Array(4096).fill((p0out & 2) ? 3.3 : 0), writePos: 0, totalSamples: 4096, enabled: (gpio.dir[0] & 2) !== 0, vOffset: 0.85, scale: 1.0 },
    ];
  }, [duty, gpio]);

  // Measure container and init scope — also resize on ResizeObserver.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let scope: PixiScope | null = null;
    let rafId = 0;

    async function init(w: number, h: number) {
      if (scope) scope.destroy();
      scope = new PixiScope({
        width: w, height: h,
        timebaseMsPerDiv: TIMEBASES[3],
        sampleRate: 1000,
        channels: buildChannels(),
        phosphorMode: phosphor,
      });
      await scope.mount(canvas!);
      scopeRef.current = scope;
    }

    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      const w = Math.max(200, Math.floor(width));
      const h = Math.max(80, Math.floor(height));
      if (scopeRef.current) {
        scopeRef.current.updateConfig({ width: w, height: h });
      } else {
        init(w, h);
      }
    });
    ro.observe(wrap);

    // Initial mount with current size.
    const r = wrap.getBoundingClientRect();
    init(Math.max(200, r.width), Math.max(80, r.height));

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
      scopeRef.current?.destroy();
      scopeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phosphor]);

  useEffect(() => {
    scopeRef.current?.updateConfig({ channels: buildChannels() });
  }, [buildChannels]);

  useEffect(() => {
    scopeRef.current?.setPaused(!running);
  }, [running]);

  function exportPng() {
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.download = "oscilloscope.png";
    a.href = canvasRef.current.toDataURL("image/png");
    a.click();
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Oscilloscope"
        right={
          <div className="flex items-center gap-1.5">
            <select
              value={timebaseIdx}
              onChange={e => {
                const i = +e.target.value;
                setTimebaseIdx(i);
                scopeRef.current?.updateConfig({ timebaseMsPerDiv: TIMEBASES[i] });
              }}
              className="rounded border border-line bg-bg px-1 py-0.5 font-mono text-[10px] text-fg"
              aria-label="Timebase"
            >
              {TIMEBASES.map((t, i) => (
                <option key={t} value={i}>
                  {t < 1 ? `${t * 1000}µs` : `${t}ms`}/div
                </option>
              ))}
            </select>
            <Button variant="ghost" onClick={() => setPhosphor(p => !p)} title="Toggle phosphor mode">
              CRT
            </Button>
            <Button variant="ghost" onClick={() => setRunning(r => !r)} aria-label={running ? "Pause" : "Run"}>
              {running ? <Pause size={12} /> : <Play size={12} />}
            </Button>
            <Button variant="ghost" onClick={exportPng} aria-label="Export PNG">
              <Camera size={12} />
            </Button>
          </div>
        }
      />
      {/* Canvas wrapper fills all remaining height */}
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="scope-canvas h-full w-full"
          aria-label="Oscilloscope display"
        />
        {/* Channel legend overlay */}
        <div className="absolute bottom-2 left-2 flex gap-3">
          {LABELS.map((l, i) => {
            const hex = `#${COLORS[i].toString(16).padStart(6, "0")}`;
            return (
              <span key={l} className="flex items-center gap-1 font-mono text-[9px]">
                <svg width="14" height="5" aria-hidden><rect width="14" height="5" rx="2" fill={hex} /></svg>
                {l}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
