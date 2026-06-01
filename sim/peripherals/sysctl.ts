import type { AccessSize, Peripheral } from "./types";

/**
 * System Control Block (UM10139 §3) — PLL, power, VPB divider, MEMMAP, and the
 * external-interrupt registers. We do not model real clocking; the important
 * behaviour is that PLLSTAT reports PLOCK as soon as the PLL is enabled and
 * fed, so the ubiquitous `while (!(PLLSTAT & PLOCK));` startup loop terminates.
 */
export class SystemControl implements Peripheral {
  readonly name = "SystemControl";
  readonly base = 0xe01fc000;
  readonly size = 0x200;

  private regs = new Map<number, number>();
  private pllEnabled = false;

  reset(): void {
    this.regs.clear();
    this.pllEnabled = false;
  }

  read(offset: number, _size: AccessSize): number {
    switch (offset) {
      case 0x088: // PLLSTAT — mirror PLLCON, force PLOCK (bit 10) when enabled
        return (this.pllEnabled ? 0x0400 : 0) | (this.regs.get(0x080) ?? 0);
      default:
        return this.regs.get(offset) ?? 0;
    }
  }

  write(offset: number, value: number, _size: AccessSize): void {
    this.regs.set(offset, value >>> 0);
    if (offset === 0x080) this.pllEnabled = (value & 0x1) !== 0; // PLLCON.PLLE
  }
}

/**
 * Pin Connect Block (UM10139 §7) — PINSEL0/1/2. Stored so the debugger can
 * show them; peripheral pin ownership is not enforced in Phase 1.
 */
export class PinConnect implements Peripheral {
  readonly name = "PinConnect";
  readonly base = 0xe002c000;
  readonly size = 0x20;
  private regs = new Uint32Array(8);

  reset(): void {
    this.regs.fill(0);
  }
  read(offset: number): number {
    return this.regs[(offset >> 2) & 7] >>> 0;
  }
  write(offset: number, value: number): void {
    this.regs[(offset >> 2) & 7] = value >>> 0;
  }
}
