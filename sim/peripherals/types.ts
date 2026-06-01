/** Access width in bits for an MMIO transaction. */
export type AccessSize = 8 | 16 | 32;

/**
 * A memory-mapped peripheral. Each device owns a contiguous [base, base+size)
 * window in the LPC2148 address space and services reads/writes by offset.
 */
export interface Peripheral {
  readonly name: string;
  readonly base: number;
  readonly size: number;
  read(offset: number, size: AccessSize): number;
  write(offset: number, value: number, size: AccessSize): void;
  /** Advance internal timers/state by `cycles` PCLK ticks. Optional. */
  tick?(cycles: number): void;
  /** True while this peripheral is requesting an IRQ (VIC, Phase 2). Optional. */
  irqPending?(): boolean;
  /** Reset to power-on state. Optional. */
  reset?(): void;
}
