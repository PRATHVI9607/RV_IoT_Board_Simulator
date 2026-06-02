import type { AccessSize, Peripheral } from "./types";

/**
 * LPC2148 ADC1 (UM10139 §21). 10-bit successive-approximation ADC.
 *
 * Base: 0xE0034000 (ADC1). ADC0 at 0xE0030000 (same layout).
 *  AD1CR    0x00  control: SEL[7:0], CLKDIV[15:8], BURST[16], CLKS[19:17],
 *                          START[26:24], EDGE[27]
 *  AD1GDR   0x04  global data: RESULT[15:6], CHN[26:24], DONE[31]
 *  AD1STAT  0x30  status: DONE[7:0] per channel, ADINT[8]
 *
 * Channels mapped to the RV-IoT board:
 *   CH2 (P0.29) → LDR
 *   CH3 (P0.30) → LM35 temperature sensor
 *   CH4 (P0.31) → Potentiometer / Joystick Y
 *   CH5 (P0.25) → Joystick X (AOUT pin, dual-use)
 */
export class ADC implements Peripheral {
  readonly size = 0x34;
  readonly name: string;

  private cr = 0;
  private gdr = 0;
  private stat = 0;

  /** Virtual ADC input values 0–1023 per channel (set by UI sliders). */
  readonly inputs = new Uint16Array(8);

  private convDelay = 0; // countdown in PCLK ticks until conversion done
  private convertingCh = -1;

  constructor(readonly base: number, name: string) {
    this.name = name;
    this.inputs.fill(512);
  }

  reset(): void {
    this.cr = this.gdr = this.stat = 0;
    this.dr.fill(0);
    this.convDelay = 0;
    this.convertingCh = -1;
  }

  /** Per-channel data registers ADxDR0..7 (offsets 0x10..0x2C). */
  private dr = new Uint32Array(8);

  /** Record a finished conversion into both the global and channel registers. */
  private storeResult(ch: number, v: number): void {
    const word = ((v << 6) | (ch << 24) | 0x80000000) >>> 0;
    this.gdr = word;
    this.dr[ch] = ((v << 6) | 0x80000000) >>> 0; // ADxDRn has no CHN field
    this.stat |= (1 << ch) | 0x100;
  }

  /** Set a virtual input value (0–1023) for a given channel. */
  setInput(ch: number, value: number): void {
    if (ch >= 0 && ch < 8) this.inputs[ch] = Math.max(0, Math.min(1023, value));
  }

  tick(cycles: number): void {
    // BURST mode: continuously convert all selected channels
    if (this.cr & 0x00010000) {
      const sel = this.cr & 0xff;
      for (let ch = 0; ch < 8; ch++) {
        if (sel & (1 << ch)) this.storeResult(ch, this.inputs[ch]);
      }
      return;
    }
    // Software-START mode
    const start = (this.cr >>> 24) & 0x7;
    if (start !== 0 && this.convertingCh < 0) {
      const sel = this.cr & 0xff;
      for (let ch = 0; ch < 8; ch++) {
        if (sel & (1 << ch)) { this.convertingCh = ch; break; }
      }
      this.convDelay = 25; // ~2.5µs at 10MHz PCLK
      // Clear START bits (simulate hardware clearing after conversion start)
      this.cr &= ~(0x7 << 24);
    }
    if (this.convertingCh >= 0 && this.convDelay > 0) {
      this.convDelay = Math.max(0, this.convDelay - cycles);
      if (this.convDelay === 0) {
        this.storeResult(this.convertingCh, this.inputs[this.convertingCh]);
        this.convertingCh = -1;
      }
    }
  }

  irqPending(): boolean {
    return (this.stat & 0x100) !== 0 && (this.cr & 0x00000100) !== 0;
  }

  read(offset: number, _size: AccessSize): number {
    // Per-channel data registers ADxDR0..7 at 0x10, 0x14, ... 0x2C.
    if (offset >= 0x10 && offset <= 0x2c) {
      const ch = (offset - 0x10) >> 2;
      const v = this.dr[ch];
      this.dr[ch] &= ~0x80000000; // reading clears that channel's DONE
      return v;
    }
    switch (offset) {
      case 0x00: return this.cr;
      case 0x04: {
        const v = this.gdr;
        this.gdr &= ~0x80000000; // reading GDR clears DONE
        this.stat &= ~0x100;
        return v;
      }
      case 0x30: return this.stat;
      default: return 0;
    }
  }

  write(offset: number, value: number, _size: AccessSize): void {
    if (offset === 0x00) this.cr = value >>> 0;
  }
}
