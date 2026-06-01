import type { AccessSize, Peripheral } from "./types";

/**
 * LPC2148 UART0/UART1 (UM10139 §11/§12). 16C550-compatible.
 *
 *  0x00  RBR (read) / THR (write) / DLL (when DLAB=1)
 *  0x04  DLM (when DLAB=1) / IER
 *  0x08  IIR (read) / FCR (write)
 *  0x0C  LCR        (bit 7 = DLAB)
 *  0x14  LSR        (bit 0 RDR, bit 5 THRE, bit 6 TEMT)
 *  0x1C  SCR
 *
 * Transmission is instantaneous in the model: a byte written to THR is
 * appended to `txChars` (shown in the Serial Monitor) and THRE stays set.
 */
export class UART implements Peripheral {
  readonly size = 0x20;
  readonly name: string;

  private dll = 1;
  private dlm = 0;
  private lcr = 0;
  private ier = 0;
  private scr = 0;
  private fcr = 0;

  private rxQueue: number[] = [];
  /** Bytes the CPU has transmitted, drained by the UI each frame. */
  txChars: number[] = [];

  constructor(
    readonly base: number,
    name: string,
    private pclk: number,
  ) {
    this.name = name;
  }

  reset(): void {
    this.dll = 1;
    this.dlm = 0;
    this.lcr = 0;
    this.ier = 0;
    this.scr = 0;
    this.fcr = 0;
    this.rxQueue = [];
    this.txChars = [];
  }

  /** Push bytes received from the outside world (Serial Monitor input). */
  feedRx(bytes: ArrayLike<number>): void {
    for (let i = 0; i < bytes.length; i++) this.rxQueue.push(bytes[i] & 0xff);
  }

  /** Drain transmitted bytes for display. */
  drainTx(): number[] {
    if (this.txChars.length === 0) return [];
    const out = this.txChars;
    this.txChars = [];
    return out;
  }

  get baud(): number {
    const divisor = (this.dlm << 8) | this.dll;
    if (divisor === 0) return 0;
    return Math.round(this.pclk / (16 * divisor));
  }

  irqPending(): boolean {
    // RX data available interrupt
    return (this.ier & 0x1) !== 0 && this.rxQueue.length > 0;
  }

  private get dlab(): boolean {
    return (this.lcr & 0x80) !== 0;
  }

  read(offset: number, _size: AccessSize): number {
    switch (offset) {
      case 0x00:
        if (this.dlab) return this.dll;
        return this.rxQueue.length > 0 ? this.rxQueue.shift()! : 0;
      case 0x04:
        return this.dlab ? this.dlm : this.ier;
      case 0x08: {
        // IIR: bit0=1 means no interrupt pending. Report RDA when RX has data.
        if (this.rxQueue.length > 0 && this.ier & 0x1) return 0x04; // RDA
        return 0x01; // none pending
      }
      case 0x0c:
        return this.lcr;
      case 0x14: {
        // LSR: RDR | THRE | TEMT
        let lsr = 0x60; // THRE + TEMT always (instant TX)
        if (this.rxQueue.length > 0) lsr |= 0x01; // RDR
        return lsr;
      }
      case 0x1c:
        return this.scr;
      default:
        return 0;
    }
  }

  write(offset: number, value: number, _size: AccessSize): void {
    value &= 0xff;
    switch (offset) {
      case 0x00:
        if (this.dlab) this.dll = value;
        else this.txChars.push(value); // THR
        break;
      case 0x04:
        if (this.dlab) this.dlm = value;
        else this.ier = value;
        break;
      case 0x08:
        this.fcr = value;
        break;
      case 0x0c:
        this.lcr = value;
        break;
      case 0x1c:
        this.scr = value;
        break;
    }
  }
}
