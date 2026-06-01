import type { AccessSize, Peripheral } from "./types";

/**
 * LPC2148 Timer/Counter 0 & 1 (UM10139 §15). Enough to drive the software
 * delay loops that pervade lab code (polling T0TC, or waiting on an MR0
 * match-and-reset).
 *
 *  IR  0x00  interrupt flags (write 1 to clear)
 *  TCR 0x04  bit0 enable, bit1 reset
 *  TC  0x08  timer counter
 *  PR  0x0C  prescale max
 *  PC  0x10  prescale counter
 *  MCR 0x14  per-match: 3 bits each (interrupt, reset, stop)
 *  MR0 0x18 ... MR3 0x24
 */
export class Timer implements Peripheral {
  readonly size = 0x40;
  readonly name: string;

  private ir = 0;
  private tcr = 0;
  private tc = 0;
  private pr = 0;
  private pc = 0;
  private mcr = 0;
  private mr = [0, 0, 0, 0];

  constructor(readonly base: number, name: string) {
    this.name = name;
  }

  reset(): void {
    this.ir = this.tcr = this.tc = this.pr = this.pc = this.mcr = 0;
    this.mr = [0, 0, 0, 0];
  }

  irqPending(): boolean {
    return this.ir !== 0;
  }

  tick(cycles: number): void {
    if (!(this.tcr & 0x1)) return; // not enabled
    if (this.tcr & 0x2) {
      // counter held in reset
      this.tc = 0;
      this.pc = 0;
      return;
    }

    const period = this.pr + 1;
    // Fast path: no match actions configured — just advance.
    if (this.mcr === 0) {
      const total = this.pc + cycles;
      const ticks = Math.floor(total / period);
      this.pc = total % period;
      this.tc = (this.tc + ticks) >>> 0;
      return;
    }

    // Match actions configured: step tick-by-tick so matches are exact.
    let remaining = cycles;
    while (remaining > 0) {
      const toNext = period - this.pc;
      if (toNext > remaining) {
        this.pc += remaining;
        remaining = 0;
        break;
      }
      remaining -= toNext;
      this.pc = 0;
      this.tc = (this.tc + 1) >>> 0;
      for (let m = 0; m < 4; m++) {
        if (this.tc === (this.mr[m] >>> 0)) {
          const ctl = (this.mcr >> (m * 3)) & 0x7;
          if (ctl & 0x1) this.ir |= 1 << m; // interrupt on match
          if (ctl & 0x2) {
            this.tc = 0; // reset on match
          }
          if (ctl & 0x4) {
            this.tcr &= ~0x1; // stop on match
            remaining = 0;
          }
        }
      }
    }
  }

  read(offset: number, _size: AccessSize): number {
    switch (offset) {
      case 0x00: return this.ir;
      case 0x04: return this.tcr;
      case 0x08: return this.tc >>> 0;
      case 0x0c: return this.pr >>> 0;
      case 0x10: return this.pc >>> 0;
      case 0x14: return this.mcr;
      case 0x18: return this.mr[0] >>> 0;
      case 0x1c: return this.mr[1] >>> 0;
      case 0x20: return this.mr[2] >>> 0;
      case 0x24: return this.mr[3] >>> 0;
      default: return 0;
    }
  }

  write(offset: number, value: number, _size: AccessSize): void {
    value >>>= 0;
    switch (offset) {
      case 0x00: this.ir &= ~value; break; // write-1-to-clear
      case 0x04: this.tcr = value & 0x3; break;
      case 0x08: this.tc = value; break;
      case 0x0c: this.pr = value; break;
      case 0x10: this.pc = value; break;
      case 0x14: this.mcr = value; break;
      case 0x18: this.mr[0] = value; break;
      case 0x1c: this.mr[1] = value; break;
      case 0x20: this.mr[2] = value; break;
      case 0x24: this.mr[3] = value; break;
    }
  }
}
