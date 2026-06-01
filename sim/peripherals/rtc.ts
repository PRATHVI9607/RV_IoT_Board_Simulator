import type { AccessSize, Peripheral } from "./types";

/**
 * LPC2148 RTC stub (UM10139 §25). Returns wall-clock time.
 * Base: 0xE0024000
 */
export class RTC implements Peripheral {
  readonly name = "RTC";
  readonly base = 0xe0024000;
  readonly size = 0x60;

  private iir = 0;
  private amr = 0;
  private ccr = 0;
  private ciir = 0;

  reset(): void {
    this.iir = this.amr = this.ccr = this.ciir = 0;
  }

  private now(): Date { return new Date(); }

  read(offset: number, _s: AccessSize): number {
    const d = this.now();
    switch (offset) {
      case 0x00: return this.iir;
      case 0x08: return this.amr;
      case 0x0c: return this.ciir;
      case 0x10: return this.ccr;
      case 0x20: return d.getSeconds();
      case 0x24: return d.getMinutes();
      case 0x28: return d.getHours();
      case 0x2c: return d.getDate();
      case 0x30: return d.getDay();
      case 0x34: return d.getMonth() + 1;
      case 0x38: return d.getFullYear();
      default: return 0;
    }
  }

  write(offset: number, value: number, _s: AccessSize): void {
    switch (offset) {
      case 0x00: this.iir &= ~value; break;
      case 0x08: this.amr = value; break;
      case 0x0c: this.ciir = value; break;
      case 0x10: this.ccr = value; break;
    }
  }
}
