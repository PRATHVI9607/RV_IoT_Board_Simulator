import type { AccessSize, Peripheral } from "./types";

/**
 * LPC2148 Vectored Interrupt Controller (UM10139 §5).
 *
 * Base: 0xFFFFF000
 *  VICIRQStatus  0x000  pending IRQ sources (masked)
 *  VICFIQStatus  0x004  pending FIQ sources
 *  VICRawIntr    0x008  raw interrupt status
 *  VICIntSelect  0x00C  IRQ/FIQ select (1=FIQ)
 *  VICIntEnable  0x010  enable bits
 *  VICIntEnClr   0x014  clear enable
 *  VICSoftInt    0x018  software interrupt
 *  VICSoftIntClear 0x01C clear software int
 *  VICProtection 0x020  protection
 *  VICVectAddr   0x030  current active ISR address (read: acknowledge; write: EOI)
 *  VICDefVectAddr 0x034 default (non-vectored) handler address
 *  VICVectAddr0-15  0x100–0x13C  vectored handler addresses
 *  VICVectCntl0-15  0x200–0x23C  vectored channel controls
 *
 * IRQ source numbers (LPC2148 UM Table 42):
 *   0 WDT, 4 Timer0, 5 Timer1, 6 UART0, 7 UART1, 8 PWM,
 *   9 I2C0, 10 SPI0, 12 PLL, 13 RTC, 14 EINT0..17 EINT3,
 *   18 ADC0, 19 I2C1, 21 ADC1, 22 USB
 */
export class VIC implements Peripheral {
  readonly name = "VIC";
  readonly base = 0xfffff000;
  readonly size = 0x1000; // full 4 KB VIC window (UM10139 §5)

  private rawIntr = 0;   // raw interrupt inputs (from peripherals)
  private intSel = 0;    // 0=IRQ, 1=FIQ
  private intEnable = 0;
  private softInt = 0;
  private protection = 0;
  private vectAddr = new Uint32Array(16);
  private vectCntl = new Uint32Array(16);
  private defVectAddr = 0;
  private currentVectAddr = 0;

  reset(): void {
    this.rawIntr = 0;
    this.intSel = 0;
    this.intEnable = 0;
    this.softInt = 0;
    this.vectAddr.fill(0);
    this.vectCntl.fill(0);
    this.defVectAddr = 0;
    this.currentVectAddr = 0;
  }

  /** Called by peripheral bus each tick — raise/lower interrupt line n. */
  setRaw(line: number, active: boolean): void {
    if (active) this.rawIntr |= (1 << line);
    else this.rawIntr &= ~(1 << line);
  }

  private get effectiveRaw(): number {
    return (this.rawIntr | this.softInt) >>> 0;
  }

  irqPending(): boolean {
    const pending = this.effectiveRaw & this.intEnable & ~this.intSel;
    return pending !== 0;
  }

  fiqPending(): boolean {
    const pending = this.effectiveRaw & this.intEnable & this.intSel;
    return pending !== 0;
  }

  /** Returns the vector address for the highest-priority active IRQ. */
  getIRQVector(): number {
    const pending = this.effectiveRaw & this.intEnable & ~this.intSel;
    for (let slot = 0; slot < 16; slot++) {
      const cntl = this.vectCntl[slot];
      if (!(cntl & 0x20)) continue; // slot not enabled
      const source = cntl & 0x1f;
      if (pending & (1 << source)) {
        this.currentVectAddr = this.vectAddr[slot];
        return this.currentVectAddr;
      }
    }
    this.currentVectAddr = this.defVectAddr;
    return this.defVectAddr;
  }

  read(offset: number, _size: AccessSize): number {
    if (offset >= 0x100 && offset < 0x140) return this.vectAddr[(offset - 0x100) >> 2];
    if (offset >= 0x200 && offset < 0x240) return this.vectCntl[(offset - 0x200) >> 2];
    switch (offset) {
      case 0x000: return this.effectiveRaw & this.intEnable & ~this.intSel;
      case 0x004: return this.effectiveRaw & this.intEnable & this.intSel;
      case 0x008: return this.effectiveRaw;
      case 0x00c: return this.intSel;
      case 0x010: return this.intEnable;
      case 0x018: return this.softInt;
      case 0x020: return this.protection;
      case 0x030:
        this.getIRQVector(); // updates currentVectAddr
        return this.currentVectAddr;
      case 0x034: return this.defVectAddr;
      default: return 0;
    }
  }

  write(offset: number, value: number, _size: AccessSize): void {
    value >>>= 0;
    if (offset >= 0x100 && offset < 0x140) { this.vectAddr[(offset - 0x100) >> 2] = value; return; }
    if (offset >= 0x200 && offset < 0x240) { this.vectCntl[(offset - 0x200) >> 2] = value; return; }
    switch (offset) {
      case 0x00c: this.intSel = value; break;
      case 0x010: this.intEnable |= value; break;
      case 0x014: this.intEnable &= ~value; break;
      case 0x018: this.softInt |= value; break;
      case 0x01c: this.softInt &= ~value; break;
      case 0x020: this.protection = value & 1; break;
      case 0x030: this.currentVectAddr = 0; break; // EOI: clear active interrupt
      case 0x034: this.defVectAddr = value; break;
    }
  }
}
