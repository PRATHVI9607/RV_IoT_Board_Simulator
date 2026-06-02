"use client";

/**
 * PixiJS-based oscilloscope renderer.
 * Draws up to 4 waveform channels on a hardware-accelerated canvas.
 * Avoids React state for sample data — driven imperatively for performance.
 */

import type { Application, Graphics, Container } from "pixi.js";

export type OscChannel = {
  label: string;
  color: number;    // hex color e.g. 0x00d4ff
  samples: Float32Array;
  writePos: number;
  totalSamples: number;
  enabled: boolean;
  vOffset: number;  // vertical offset 0-1 (0=top, 0.5=center, 1=bottom)
  scale: number;    // V/div
};

export type OscConfig = {
  timebaseMsPerDiv: number;
  sampleRate: number;
  width: number;
  height: number;
  channels: OscChannel[];
  phosphorMode: boolean;
};

const BG_DARK = 0x001400;
const BG_MODERN = 0x0a0e14;
const GRID_PHOSPHOR = 0x004d00;
const GRID_MODERN = 0x1e2a3a;

export class PixiScope {
  private app: Application | null = null;
  private gridGfx: Graphics | null = null;
  private waveGfx: Graphics[] = [];
  private config: OscConfig;
  private rafId = 0;
  private paused = false;

  constructor(config: OscConfig) {
    this.config = config;
  }

  async mount(canvas: HTMLCanvasElement): Promise<void> {
    if (this.app) return;

    // Dynamic import to avoid SSR issues
    const pixi = await import("pixi.js");
    const app = new pixi.Application();
    await app.init({
      canvas,
      width: this.config.width,
      height: this.config.height,
      backgroundColor: this.config.phosphorMode ? BG_DARK : BG_MODERN,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    this.app = app;

    this.gridGfx = new pixi.Graphics();
    app.stage.addChild(this.gridGfx as unknown as Container);

    for (let i = 0; i < 4; i++) {
      const g = new pixi.Graphics();
      app.stage.addChild(g as unknown as Container);
      this.waveGfx.push(g);
    }

    this.drawGrid();
    this.startLoop();
  }

  private drawGrid(): void {
    if (!this.gridGfx) return;
    const { width, height, phosphorMode } = this.config;
    const g = this.gridGfx;
    g.clear();
    const gridColor = phosphorMode ? GRID_PHOSPHOR : GRID_MODERN;
    const alpha = 0.5;

    // 10 horizontal divisions, 8 vertical divisions
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * width;
      g.moveTo(x, 0); g.lineTo(x, height);
    }
    for (let i = 0; i <= 8; i++) {
      const y = (i / 8) * height;
      g.moveTo(0, y); g.lineTo(width, y);
    }
    g.stroke({ color: gridColor, alpha, width: 1 });

    // Center crosshair brighter
    g.moveTo(width / 2, 0); g.lineTo(width / 2, height);
    g.moveTo(0, height / 2); g.lineTo(width, height / 2);
    g.stroke({ color: gridColor, alpha: alpha * 1.5, width: 1 });
  }

  private startLoop(): void {
    const draw = () => {
      if (!this.paused) this.renderWaves();
      this.rafId = requestAnimationFrame(draw);
    };
    this.rafId = requestAnimationFrame(draw);
  }

  private renderWaves(): void {
    if (!this.app) return;
    const { width, height, channels } = this.config;

    channels.forEach((ch, idx) => {
      const g = this.waveGfx[idx];
      if (!g || !ch.enabled || ch.totalSamples < 2) {
        g?.clear();
        return;
      }
      g.clear();

      const n = ch.samples.length;
      const visible = Math.min(n, width);
      const startPos = (ch.writePos - visible + n) % n;

      let first = true;
      for (let px = 0; px < visible; px++) {
        const si = (startPos + px) % n;
        const v = ch.samples[si];  // 0-3.3V
        // Map voltage to Y: center at vOffset*height, scale by scale (V/div)
        const y = ch.vOffset * height - (v - 1.65) * (height / (8 * ch.scale));
        if (first) { g.moveTo(px, y); first = false; }
        else g.lineTo(px, y);
      }
      g.stroke({ color: ch.color, alpha: 0.9, width: 1.5 });
    });
  }

  updateConfig(updates: Partial<OscConfig>): void {
    Object.assign(this.config, updates);
    if (this.app && ("width" in updates || "height" in updates)) {
      const { width, height } = this.config;
      this.app.renderer.resize(width, height);
    }
    if (this.app && ("phosphorMode" in updates || "width" in updates || "height" in updates)) {
      const pMode = this.config.phosphorMode;
      this.app.renderer.background.color = pMode ? BG_DARK : BG_MODERN;
      this.drawGrid();
    }
  }

  setPaused(p: boolean): void { this.paused = p; }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.app?.destroy(false);
    this.app = null;
    this.waveGfx = [];
    this.gridGfx = null;
  }
}
