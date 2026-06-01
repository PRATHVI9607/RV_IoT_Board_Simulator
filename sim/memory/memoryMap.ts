import type { AccessSize, Peripheral } from "../peripherals/types";

/**
 * LPC2148 address map (User Manual UM10139 §2.1, Table 3).
 * Only the regions LOKI-SIM models are listed; everything else reads as a
 * poison value so stray pointers are obvious in the memory viewer.
 */
export const MEM = {
  FLASH_BASE: 0x00000000,
  FLASH_SIZE: 0x00080000, // 512 KB
  SRAM_BASE: 0x40000000,
  SRAM_SIZE: 0x00008000, // 32 KB
  SRAM_TOP: 0x40008000, // initial stack grows down from here
  PERIPH_BASE: 0xe0000000,
} as const;

/** Returned for reads to unmapped addresses (visible, memorable). */
export const POISON = 0xdeadc0de;

export type BusWarning = { cycle: number; message: string };

/**
 * The memory bus the CPU talks to. Routes by address to Flash, SRAM, or a
 * registered peripheral. Little-endian, matching ARM7TDMI in LE mode.
 */
export class MemoryBus {
  readonly flash = new Uint8Array(MEM.FLASH_SIZE);
  readonly sram = new Uint8Array(MEM.SRAM_SIZE);
  private peripherals: Peripheral[] = [];
  /** offset-indexed lookup is overkill; linear scan over ~12 devices is fine */
  warnings: BusWarning[] = [];
  cycleRef = { value: 0 }; // shared with engine for warning timestamps

  register(p: Peripheral): void {
    this.peripherals.push(p);
  }

  getPeripherals(): readonly Peripheral[] {
    return this.peripherals;
  }

  resetMemory(): void {
    this.sram.fill(0);
    this.warnings = [];
  }

  private warn(message: string): void {
    if (this.warnings.length < 200) {
      this.warnings.push({ cycle: this.cycleRef.value, message });
    }
  }

  private findPeripheral(addr: number): Peripheral | undefined {
    for (const p of this.peripherals) {
      if (addr >= p.base && addr < p.base + p.size) return p;
    }
    return undefined;
  }

  // ---- Reads -------------------------------------------------------------

  read(addr: number, size: AccessSize): number {
    addr >>>= 0;
    if (addr < MEM.FLASH_SIZE) {
      return readLE(this.flash, addr, size);
    }
    if (addr >= MEM.SRAM_BASE && addr < MEM.SRAM_BASE + MEM.SRAM_SIZE) {
      return readLE(this.sram, addr - MEM.SRAM_BASE, size);
    }
    if (addr >= MEM.PERIPH_BASE) {
      const p = this.findPeripheral(addr);
      if (p) return p.read(addr - p.base, size) >>> 0;
      this.warn(`unmapped peripheral read @ 0x${addr.toString(16)}`);
      return POISON;
    }
    this.warn(`read from unmapped address 0x${addr.toString(16)}`);
    return POISON;
  }

  read32(addr: number): number {
    return this.read(addr, 32);
  }
  read16(addr: number): number {
    return this.read(addr, 16);
  }
  read8(addr: number): number {
    return this.read(addr, 8);
  }

  // ---- Writes ------------------------------------------------------------

  write(addr: number, value: number, size: AccessSize): void {
    addr >>>= 0;
    value >>>= 0;
    if (addr < MEM.FLASH_SIZE) {
      // Flash is read-only at runtime (programmed via IAP, not modeled here).
      this.warn(`ignored write to Flash @ 0x${addr.toString(16)}`);
      return;
    }
    if (addr >= MEM.SRAM_BASE && addr < MEM.SRAM_BASE + MEM.SRAM_SIZE) {
      writeLE(this.sram, addr - MEM.SRAM_BASE, value, size);
      return;
    }
    if (addr >= MEM.PERIPH_BASE) {
      const p = this.findPeripheral(addr);
      if (p) {
        p.write(addr - p.base, value, size);
        return;
      }
      this.warn(`unmapped peripheral write @ 0x${addr.toString(16)}`);
      return;
    }
    this.warn(`write to unmapped address 0x${addr.toString(16)}`);
  }

  write32(addr: number, value: number): void {
    this.write(addr, value, 32);
  }
  write16(addr: number, value: number): void {
    this.write(addr, value, 16);
  }
  write8(addr: number, value: number): void {
    this.write(addr, value, 8);
  }

  /** Load a program image segment into Flash (or SRAM if it targets RAM). */
  loadSegment(address: number, data: Uint8Array): void {
    if (address < MEM.FLASH_SIZE) {
      this.flash.set(data.subarray(0, MEM.FLASH_SIZE - address), address);
    } else if (
      address >= MEM.SRAM_BASE &&
      address < MEM.SRAM_BASE + MEM.SRAM_SIZE
    ) {
      this.sram.set(
        data.subarray(0, MEM.SRAM_BASE + MEM.SRAM_SIZE - address),
        address - MEM.SRAM_BASE,
      );
    }
    // segments outside modeled memory are silently dropped
  }
}

function readLE(buf: Uint8Array, off: number, size: AccessSize): number {
  switch (size) {
    case 8:
      return buf[off] ?? 0;
    case 16:
      return ((buf[off] ?? 0) | ((buf[off + 1] ?? 0) << 8)) >>> 0;
    case 32:
      return (
        ((buf[off] ?? 0) |
          ((buf[off + 1] ?? 0) << 8) |
          ((buf[off + 2] ?? 0) << 16) |
          ((buf[off + 3] ?? 0) << 24)) >>>
        0
      );
  }
}

function writeLE(buf: Uint8Array, off: number, value: number, size: AccessSize): void {
  switch (size) {
    case 8:
      buf[off] = value & 0xff;
      break;
    case 16:
      buf[off] = value & 0xff;
      buf[off + 1] = (value >>> 8) & 0xff;
      break;
    case 32:
      buf[off] = value & 0xff;
      buf[off + 1] = (value >>> 8) & 0xff;
      buf[off + 2] = (value >>> 16) & 0xff;
      buf[off + 3] = (value >>> 24) & 0xff;
      break;
  }
}
