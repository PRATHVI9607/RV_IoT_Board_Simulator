"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSim, getEngine } from "@/store/simulatorStore";
import { PixiScope } from "@/lib/pixiScope";
import { Button } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/Panel";
import { Play, Pause, Camera } from "@phosphor-icons/react";

const COLORS = [0x00d4ff, 0xffcc00, 0x4ade80, 0xb44dff]; // CH1 cyan, CH2 yellow, CH3 green, CH4 purple
const LABELS = ["CH1 DAC", "CH2 PWM6", "CH3 P0.0", "CH4 P0.1"];

const TIMEBASES = [0.05, 0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000]; // ms/div

export function Oscilloscope() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scopeRef = useRef<PixiScope | null>(null);
  const [phosphor, setPhosphor] = useState(false);
  const [running, setRunning] = useState(true);
  const [timebaseIdx, setTimebaseIdx] = useState(3); // 1ms/div default
  const dacVoltage = useSim((s) => s.snap.periph.dacVoltage);
  const duty = useSim((s) => s.snap.periph.pwmDuty);
  const gpio = useSim((s) => s.snap.gpio);

  const W = 680;
  const H = 200;

  // Build channel configs
  const buildChannels = useCallback(() => {
    const eng = getEngine();
    const dacSamples = eng.dac.samples;
    const writePos = eng.dac.sampleCount % 4096;

    // CH2: PWM6 duty as a square wave (just display duty level)
    const pwm6Duty = duty[5];
    const pwmSamples = new Float32Array(4096).fill(pwm6Duty * 3.3);

    // CH3/4: GPIO P0.0 and P0.1 as 0/3.3V digital
    const p0out = gpio.out[0];
    const gp0 = (p0out & 1) !== 0 ? 3.3 : 0;
    const gp1 = (p0out & 2) !== 0 ? 3.3 : 0;
    const gpSamples0 = new Float32Array(4096).fill(gp0);
    const gpSamples1 = new Float32Array(4096).fill(gp1);

    return [
      { label: LABELS[0], color: COLORS[0], samples: dacSamples, writePos, totalSamples: Math.min(4096, eng.dac.sampleCount), enabled: true, vOffset: 0.5, scale: 1.0 },
      { label: LABELS[1], color: COLORS[1], samples: pwmSamples, writePos: 0, totalSamples: 4096, enabled: pwm6Duty > 0.01, vOffset: 0.2, scale: 1.0 },
      { label: LABELS[2], color: COLORS[2], samples: gpSamples0, writePos: 0, totalSamples: 4096, enabled: (gpio.dir[0] & 1) !== 0, vOffset: 0.7, scale: 1.0 },
      { label: LABELS[3], color: COLORS[3], samples: gpSamples1, writePos: 0, totalSamples: 4096, enabled: (gpio.dir[0] & 2) !== 0, vOffset: 0.85, scale: 1.0 },
    ];
  }, [duty, gpio]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const scope = new PixiScope({
      width: W, height: H,
      timebaseMsPerDiv: TIMEBASES[timebaseIdx],
      sampleRate: 1000,
      channels: buildChannels(),
      phosphorMode: phosphor,
    });
    scope.mount(canvasRef.current).then(() => {
      scopeRef.current = scope;
    });
    return () => { scope.destroy(); scopeRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scopeRef.current?.updateConfig({ channels: buildChannels(), phosphorMode: phosphor });
  }, [buildChannels, phosphor]);

  useEffect(() => {
    scopeRef.current?.setPaused(!running);
  }, [running]);

  function exportPng() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "oscilloscope.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Oscilloscope"
        right={
          <div className="flex items-center gap-1.5">
            <select
              value={timebaseIdx}
              onChange={(e) => { setTimebaseIdx(+e.target.value); scopeRef.current?.updateConfig({ timebaseMsPerDiv: TIMEBASES[+e.target.value] }); }}
              className="rounded border border-line bg-bg px-1 py-0.5 font-mono text-[10px] text-fg"
              aria-label="Timebase"
            >
              {TIMEBASES.map((t, i) => (
                <option key={t} value={i}>{t < 1 ? `${t*1000}µs` : `${t}ms`}/div</option>
              ))}
            </select>
            <Button variant="ghost" onClick={() => setPhosphor(p => !p)} title="Toggle phosphor mode">
              CRT
            </Button>
            <Button variant="ghost" onClick={() => setRunning(r => !r)} aria-label={running ? "Pause scope" : "Run scope"}>
              {running ? <Pause size={12} /> : <Play size={12} />}
            </Button>
            <Button variant="ghost" onClick={exportPng} aria-label="Export PNG">
              <Camera size={12} />
            </Button>
          </div>
        }
      />
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="scope-canvas w-full"
          aria-label="Oscilloscope display"
        />
        {/* Channel legend — colour driven by a CSS variable so no inline style */}
        <div className="absolute bottom-2 left-2 flex gap-3">
          {LABELS.map((l, i) => {
            const hex = `#${COLORS[i].toString(16).padStart(6, "0")}`;
            return (
              <span key={l} className="flex items-center gap-1 font-mono text-[9px]">
                <svg width="16" height="6" aria-hidden>
                  <rect width="16" height="6" rx="3" fill={hex} />
                </svg>
                {l}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
