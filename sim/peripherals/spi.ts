import type { AccessSize, Peripheral } from "./types";

/**
 * LPC2148 SPI0 (UM10139 §16). Full-duplex synchronous serial.
 * Base: 0xE0020000
 *  S0SPCR  0x00  control: CPHA, CPOL, MSTR, LSBF, SPIE, BITS[11:8]
 *  S0SPSR  0x04  status: ABRT, MODF, ROVR, WCOL, SPIF
 *  S0SPDR  0x08  data
 *  S0SPCCR 0x0C  clock counter (min 8)
 *  S0SPINT 0x1C  interrupt flag
 */
export class SPI implements Peripheral {
  readonly size = 0x20;
  readonly name: string;

  private cr = 0;
  private sr = 0x80; // SPIF set (ready)
  private dr = 0;
  private ccr = 8;
  private spint = 0;

  /** External MISO source — overridable by external device models. */
  misoProvider: () => number = () => 0xff;

  constructor(readonly base: number, name: string) {
    this.name = name;
  }

  reset(): void {
    this.cr = 0;
    this.sr = 0x80;
    this.dr = 0;
    this.ccr = 8;
    this.spint = 0;
  }

  irqPending(): boolean {
    return (this.spint & 0x1) !== 0 && (this.cr & 0x80) !== 0;
  }

  read(offset: number, _size: AccessSize): number {
    switch (offset) {
      case 0x00: return this.cr;
      case 0x04: return this.sr;
      case 0x08: {
        const v = this.dr;
        this.sr &= ~0x80; // clear SPIF on read
        return v;
      }
      case 0x0c: return this.ccr;
      case 0x1c: return this.spint;
      default: return 0;
    }
  }

  write(offset: number, value: number, _size: AccessSize): void {
    value >>>= 0;
    switch (offset) {
      case 0x00: this.cr = value; break;
      case 0x08: // write SPDR: simulate immediate transfer
        this.dr = this.misoProvider() & 0xff;
        this.sr |= 0x80; // SPIF
        if (this.cr & 0x80) this.spint = 1; // interrupt if enabled
        break;
      case 0x0c: this.ccr = Math.max(8, value & 0xff); break;
      case 0x1c: this.spint &= ~(value & 1); break; // write 1 to clear
    }
  }
}
