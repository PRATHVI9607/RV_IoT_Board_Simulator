import type { AccessSize, Peripheral } from "./types";

/**
 * LPC2148 legacy GPIO (UM10139 §8). Port 0 (P0.0–P0.31) and Port 1
 * (P1.16–P1.31, but modeled as full 32-bit for simplicity).
 *
 *  IO0PIN  0x00  pin value
 *  IO0SET  0x04  output set (write 1 to drive high)
 *  IO0DIR  0x08  direction (1 = output)
 *  IO0CLR  0x0C  output clear (write 1 to drive low)
 *  IO1PIN  0x10 ... (same layout, +0x10)
 *
 * The "out" latch holds what the CPU drives on output pins. The "ext" value
 * holds what external hardware (switches, keypad columns) drives on input
 * pins. A pin reads from `out` if it is an output, else from `ext`.
 */
export class GPIO implements Peripheral {
  readonly name = "GPIO";
  readonly base = 0xe0028000;
  readonly size = 0x20;

  out = [0, 0]; // [port0, port1] output latch
  dir = [0, 0]; // direction (1 = output)
  ext = [0, 0]; // externally driven input levels

  /** Notified synchronously whenever an output latch or direction changes. */
  private listeners: Array<() => void> = [];

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  private fire(): void {
    for (const fn of this.listeners) fn();
  }

  reset(): void {
    this.out = [0, 0];
    this.dir = [0, 0];
    this.ext = [0, 0];
  }

  /** Live level of an output pin (what the LCD/LED/etc. sees). */
  pinLevel(port: 0 | 1, pin: number): boolean {
    const mask = 1 << pin;
    const isOutput = (this.dir[port] & mask) !== 0;
    const src = isOutput ? this.out[port] : this.ext[port];
    return (src & mask) !== 0;
  }

  /** Value the CPU reads from IOxPIN. */
  pinRegister(port: 0 | 1): number {
    return ((this.out[port] & this.dir[port]) | (this.ext[port] & ~this.dir[port])) >>> 0;
  }

  /** Drive an external input pin (from board peripherals). */
  setExternalPin(port: 0 | 1, pin: number, high: boolean): void {
    const mask = 1 << pin;
    if (high) this.ext[port] |= mask;
    else this.ext[port] &= ~mask;
  }

  read(offset: number, _size: AccessSize): number {
    const port = (offset >= 0x10 ? 1 : 0) as 0 | 1;
    const reg = offset & 0x0f;
    switch (reg) {
      case 0x00:
        return this.pinRegister(port);
      case 0x04:
        return this.out[port] >>> 0;
      case 0x08:
        return this.dir[port] >>> 0;
      case 0x0c:
        return 0; // reading IOxCLR is undefined; LPC returns 0
      default:
        return 0;
    }
  }

  write(offset: number, value: number, _size: AccessSize): void {
    value >>>= 0;
    const port = (offset >= 0x10 ? 1 : 0) as 0 | 1;
    const reg = offset & 0x0f;
    switch (reg) {
      case 0x00: // IOxPIN: write whole output latch
        this.out[port] = value;
        break;
      case 0x04: // IOxSET
        this.out[port] = (this.out[port] | value) >>> 0;
        break;
      case 0x08: // IOxDIR
        this.dir[port] = value;
        break;
      case 0x0c: // IOxCLR
        this.out[port] = (this.out[port] & ~value) >>> 0;
        break;
    }
    this.fire();
  }
}
