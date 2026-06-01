import type { AccessSize, Peripheral } from "./types";

/**
 * LPC2148 PWM peripheral (UM10139 §20). Single PWM unit with 6 channels.
 * Timer-based: TC counts from 0 to MR0 (period). Each channel matches at MRx
 * for its rising/falling edge.
 *
 * Base: 0xE0014000
 *  PWMIR   0x00  interrupt register
 *  PWMTCR  0x04  timer control (enable/reset)
 *  PWMTC   0x08  timer counter
 *  PWMPR   0x0C  prescale
 *  PWMPC   0x10  prescale counter
 *  PWMMCR  0x14  match control
 *  PWMMR0  0x18  match 0 (period)
 *  PWMMR1  0x1C  match 1
 *  PWMMR2  0x20  match 2
 *  PWMMR3  0x24  match 3
 *  PWMMR4  0x28  match 4
 *  PWMMR5  0x2C  match 5
 *  PWMMR6  0x30  match 6
 *  PWMPCR  0x4C  PWM control (single/double edge)
 *  PWMLER  0x50  latch enable
 */
export class PWM implements Peripheral {
  readonly name = "PWM";
  readonly base = 0xe0014000;
  readonly size = 0x80;

  private ir = 0;
  private tcr = 0;
  private tc = 0;
  private pr = 0;
  private pc = 0;
  private mcr = 0;
  private mr = new Uint32Array(7); // MR0..MR6
  private pcr = 0;
  private ler = 0;
  private mrShadow = new Uint32Array(7);

  reset(): void {
    this.ir = this.tcr = this.tc = this.pr = this.pc = this.mcr = this.pcr = this.ler = 0;
    this.mr.fill(0);
    this.mrShadow.fill(0);
  }

  /**
   * Duty cycle 0–1 for channel 1..6 based on MR0 (period) and MRx (match).
   * Returns 0 if not enabled or period is 0.
   */
  dutyCycle(ch: 1 | 2 | 3 | 4 | 5 | 6): number {
    const period = this.mr[0];
    if (period === 0) return 0;
    const match = this.mr[ch];
    return Math.min(1, Math.max(0, match / period));
  }

  /**
   * PWM period in PCLK ticks (MR0 + 1).
   */
  get period(): number {
    return (this.mr[0] + 1) >>> 0;
  }

  tick(cycles: number): void {
    if (!(this.tcr & 0x1)) return;
    if (this.tcr & 0x2) { this.tc = this.pc = 0; return; }
    const period = (this.pr >>> 0) + 1;
    const total = this.pc + cycles;
    const ticks = Math.floor(total / period);
    this.pc = total % period;
    const newTc = (this.tc + ticks) >>> 0;
    const mr0 = this.mr[0] >>> 0;
    if (mr0 > 0 && newTc > mr0) {
      this.tc = newTc % (mr0 + 1);
      // Latch shadow registers on period reset
      if (this.ler) {
        for (let i = 0; i < 7; i++) if (this.ler & (1 << i)) this.mr[i] = this.mrShadow[i];
        this.ler = 0;
      }
    } else {
      this.tc = newTc;
    }
  }

  irqPending(): boolean { return this.ir !== 0; }

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
      case 0x28: return this.mr[4] >>> 0;
      case 0x2c: return this.mr[5] >>> 0;
      case 0x30: return this.mr[6] >>> 0;
      case 0x4c: return this.pcr;
      case 0x50: return this.ler;
      default: return 0;
    }
  }

  write(offset: number, value: number, _size: AccessSize): void {
    value >>>= 0;
    switch (offset) {
      case 0x00: this.ir &= ~value; break;
      case 0x04: this.tcr = value & 0x3; break;
      case 0x08: this.tc = value; break;
      case 0x0c: this.pr = value; break;
      case 0x10: this.pc = value; break;
      case 0x14: this.mcr = value; break;
      // Match registers go into shadow; latched into mr[] when LER bit set
      case 0x18: this.mrShadow[0] = value; break;
      case 0x1c: this.mrShadow[1] = value; break;
      case 0x20: this.mrShadow[2] = value; break;
      case 0x24: this.mrShadow[3] = value; break;
      case 0x28: this.mrShadow[4] = value; break;
      case 0x2c: this.mrShadow[5] = value; break;
      case 0x30: this.mrShadow[6] = value; break;
      case 0x4c: this.pcr = value; break;
      case 0x50:
        this.ler = value;
        // Immediate latch if timer is stopped (common init pattern)
        if (!(this.tcr & 0x1)) {
          for (let i = 0; i < 7; i++) if (value & (1 << i)) this.mr[i] = this.mrShadow[i];
          this.ler = 0;
        }
        break;
    }
  }
}
