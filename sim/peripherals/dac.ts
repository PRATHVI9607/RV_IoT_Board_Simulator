import type { AccessSize, Peripheral } from "./types";

/**
 * LPC2148 DAC (UM10139 §22). 10-bit buffered voltage output on P0.25 (AOUT).
 *
 *  DACR  0xE006C000  [15:6] VALUE (10-bit), [16] BIAS
 *
 * The DAC output feeds the virtual oscilloscope automatically.
 */
export class DAC implements Peripheral {
  readonly name = "DAC";
  readonly base = 0xe006c000;
  readonly size = 0x04;

  private dacr = 0;
  /** Circular sample buffer for the oscilloscope (pre-allocated, fast). */
  readonly samples = new Float32Array(4096);
  private writePos = 0;
  private _sampleCount = 0;

  reset(): void {
    this.dacr = 0;
    this.samples.fill(0);
    this.writePos = 0;
    this._sampleCount = 0;
  }

  /** DAC output voltage 0–3.3 V. */
  get voltage(): number {
    return ((this.dacr >>> 6) & 0x3ff) * (3.3 / 1023);
  }

  /** Raw 10-bit DAC value (0–1023). */
  get value(): number {
    return (this.dacr >>> 6) & 0x3ff;
  }

  get sampleCount(): number { return this._sampleCount; }

  read(offset: number, _size: AccessSize): number {
    return offset === 0 ? this.dacr : 0;
  }

  write(offset: number, value: number, _size: AccessSize): void {
    if (offset === 0) {
      this.dacr = value >>> 0;
      this.samples[this.writePos] = this.voltage;
      this.writePos = (this.writePos + 1) & 4095;
      this._sampleCount++;
    }
  }
}
