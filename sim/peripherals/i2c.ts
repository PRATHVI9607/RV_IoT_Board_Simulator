import type { AccessSize, Peripheral } from "./types";

/**
 * LPC2148 I2C0 (UM10139 §14). State-machine implementation.
 * Base 0xE001C000 (I2C0), 0xE005C000 (I2C1).
 *
 *  I2CxCONSET 0x00  control set (SI, STO, STA, AA, I2EN)
 *  I2CxSTAT   0x04  status (step state machine codes)
 *  I2CxDAT    0x08  data
 *  I2CxADR    0x0C  slave address (with general call bit 0)
 *  I2CxSCLH   0x10  SCL high half-period
 *  I2CxSCLL   0x14  SCL low half-period
 *  I2CxCONCLR 0x18  control clear
 *
 * State codes (UM10139 Table 197, master transmitter):
 *   0x08 START sent
 *   0x10 repeated START
 *   0x18 SLA+W sent, ACK received
 *   0x20 SLA+W sent, NACK
 *   0x28 data sent, ACK
 *   0x30 data sent, NACK
 *   0x38 arbitration lost
 *   0x40 SLA+R sent, ACK
 *   0x48 SLA+R sent, NACK
 *   0x50 data received, ACK
 *   0x58 data received, NACK
 *   0xF8 idle
 */
export class I2C implements Peripheral {
  readonly size = 0x1c;
  readonly name: string;

  private conset = 0;
  private stat = 0xf8; // idle
  private dat = 0;
  private adr = 0;
  private sclh = 0x04;
  private scll = 0x04;

  constructor(readonly base: number, name: string) {
    this.name = name;
  }

  reset(): void {
    this.conset = 0;
    this.stat = 0xf8;
    this.dat = 0;
    this.adr = 0;
    this.sclh = 0x04;
    this.scll = 0x04;
  }

  irqPending(): boolean {
    return (this.conset & 0x08) !== 0; // SI bit
  }

  tick(_cycles: number): void {
    // Simplified: if STA is set and I2EN is on, immediately produce a START condition
    if ((this.conset & 0x20) && (this.conset & 0x40)) {
      this.conset &= ~0x20; // clear STA
      this.stat = 0x08; // START sent
      this.conset |= 0x08; // set SI (interrupt pending)
    }
  }

  read(offset: number, _size: AccessSize): number {
    switch (offset) {
      case 0x00: return this.conset;
      case 0x04: return this.stat;
      case 0x08: return this.dat;
      case 0x0c: return this.adr;
      case 0x10: return this.sclh;
      case 0x14: return this.scll;
      default: return 0;
    }
  }

  write(offset: number, value: number, _size: AccessSize): void {
    value &= 0xff;
    switch (offset) {
      case 0x00: // CONSET
        this.conset |= value & 0x6c;
        if (this.conset & 0x40) this.processState();
        break;
      case 0x08: this.dat = value; break;
      case 0x0c: this.adr = value; break;
      case 0x10: this.sclh = value; break;
      case 0x14: this.scll = value; break;
      case 0x18: // CONCLR
        this.conset &= ~(value & 0x6c);
        if (value & 0x08) { // clearing SI advances state
          this.conset &= ~0x08;
          this.processState();
        }
        break;
    }
  }

  private processState(): void {
    if (!(this.conset & 0x40)) return; // I2EN not set
    switch (this.stat) {
      case 0xf8: // idle
        if (this.conset & 0x20) { // STA
          this.stat = 0x08;
          this.conset = (this.conset | 0x08) & ~0x20;
        }
        break;
      case 0x08: // START sent → write address
      case 0x10:
        if ((this.dat & 0x01) === 0) this.stat = 0x18; // SLA+W ACK (simulated)
        else this.stat = 0x40; // SLA+R ACK
        this.conset |= 0x08;
        break;
      case 0x18: // SLA+W ACK → send data or STOP
      case 0x28: // data sent ACK
        if (this.conset & 0x10) { // STO
          this.stat = 0xf8;
          this.conset &= ~0x10;
        } else {
          this.stat = 0x28; // simulated data ACK
          this.conset |= 0x08;
        }
        break;
      case 0x40: // SLA+R ACK → receive
        this.stat = (this.conset & 0x04) ? 0x50 : 0x58; // AA→ACK or NACK
        this.dat = 0xff; // simulated slave byte
        this.conset |= 0x08;
        break;
      case 0x50: // data received ACK
        this.dat = 0xff;
        this.stat = (this.conset & 0x04) ? 0x50 : 0x58;
        this.conset |= 0x08;
        break;
      case 0x58: // data received NACK (last byte)
        if (this.conset & 0x10) { this.stat = 0xf8; this.conset &= ~0x10; }
        break;
    }
  }
}
