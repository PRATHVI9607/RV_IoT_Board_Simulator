import { ARM7, MODE_NAMES } from "./cpu/arm7";
import { MemoryBus } from "./memory/memoryMap";
import { GPIO } from "./peripherals/gpio";
import { UART } from "./peripherals/uart";
import { Timer } from "./peripherals/timer";
import { PWM } from "./peripherals/pwm";
import { ADC } from "./peripherals/adc";
import { DAC } from "./peripherals/dac";
import { VIC } from "./peripherals/vic";
import { I2C } from "./peripherals/i2c";
import { SPI } from "./peripherals/spi";
import { RTC } from "./peripherals/rtc";
import { SystemControl, PinConnect } from "./peripherals/sysctl";
import { LCD, type LCDState } from "./peripherals/lcd";
import { Keypad } from "./peripherals/keypad";
import { SevenSeg } from "./peripherals/sevenseg";
import type { Peripheral } from "./peripherals/types";
import { parseIntelHex, parseBinary, type ParsedHex } from "./loader/hexParser";
import { parseElf, type ElfSymbol } from "../lib/elfParser";

export type SimStatus = "idle" | "running" | "paused" | "breakpoint" | "halted" | "error";

const PCLK = 15_000_000;

export interface CpuSnapshot {
  regs: number[];
  cpsr: number;
  spsr: number;
  pc: number;
  modeName: string;
  thumb: boolean;
  flags: { N: boolean; Z: boolean; C: boolean; V: boolean; I: boolean; F: boolean };
  cycles: number;
}

export interface GpioSnapshot {
  pin: [number, number];
  out: [number, number];
  dir: [number, number];
}

export interface PeriphSnapshot {
  pwmDuty: number[];       // duty 0-1 for CH1..6
  adcInputs: number[];     // 0-1023 per channel
  dacVoltage: number;      // 0-3.3V
  timer0tc: number;
  timer1tc: number;
  vicIrqStatus: number;
}

export interface Snapshot {
  cpu: CpuSnapshot;
  gpio: GpioSnapshot;
  periph: PeriphSnapshot;
  lcd: LCDState;
  lcdRevision: number;
  sevenSeg: number[];
  status: SimStatus;
  warnings: number;
}

// IRQ source numbers (LPC2148 UM Table 42)
export const IRQ = {
  TIMER0: 4, TIMER1: 5, UART0: 6, UART1: 7, PWM: 8,
  I2C0: 9, SPI0: 10, SPI1: 11, PLL: 12, RTC: 13,
  ADC0: 18, I2C1: 19, ADC1: 21, USB: 22,
} as const;

export class Engine {
  readonly bus = new MemoryBus();
  readonly cpu: ARM7;
  readonly gpio = new GPIO();
  readonly uart0: UART;
  readonly uart1: UART;
  readonly timer0: Timer;
  readonly timer1: Timer;
  readonly pwm = new PWM();
  readonly adc1: ADC;
  readonly dac = new DAC();
  readonly vic = new VIC();
  readonly i2c0: I2C;
  readonly i2c1: I2C;
  readonly spi0: SPI;
  readonly spi1: SPI;
  readonly rtc = new RTC();
  readonly sysctl = new SystemControl();
  readonly pinconnect = new PinConnect();
  readonly lcd: LCD;
  readonly keypad: Keypad;
  readonly sevenSeg: SevenSeg;

  private tickables: Peripheral[] = [];

  status: SimStatus = "idle";
  breakpoints = new Set<number>();
  entryPoint = 0;
  hexName = "";
  hexInfo: ParsedHex | null = null;
  symbolTable = new Map<number, ElfSymbol>();

  constructor() {
    this.cpu = new ARM7(this.bus);
    this.uart0 = new UART(0xe000c000, "UART0", PCLK);
    this.uart1 = new UART(0xe0010000, "UART1", PCLK);
    this.timer0 = new Timer(0xe0004000, "Timer0");
    this.timer1 = new Timer(0xe0008000, "Timer1");
    this.adc1 = new ADC(0xe0034000, "ADC1");
    this.i2c0 = new I2C(0xe001c000, "I2C0");
    this.i2c1 = new I2C(0xe005c000, "I2C1");
    this.spi0 = new SPI(0xe0020000, "SPI0");
    this.spi1 = new SPI(0xe0068000, "SPI1");
    this.lcd = new LCD(this.gpio);
    this.keypad = new Keypad(this.gpio);
    this.sevenSeg = new SevenSeg(this.gpio);

    const devices: Peripheral[] = [
      this.gpio, this.uart0, this.uart1,
      this.timer0, this.timer1, this.pwm,
      this.adc1, this.dac, this.vic,
      this.i2c0, this.i2c1, this.spi0, this.spi1,
      this.rtc, this.sysctl, this.pinconnect,
    ];
    for (const d of devices) this.bus.register(d);
    this.tickables = [this.timer0, this.timer1, this.pwm, this.adc1, this.dac, this.i2c0, this.i2c1];
  }

  // ---- program loading ---------------------------------------------------

  loadHexText(text: string, filename: string): ParsedHex {
    const parsed = parseIntelHex(text);
    this.loadParsed(parsed, filename);
    return parsed;
  }

  loadBinary(bytes: Uint8Array, filename: string): ParsedHex {
    const parsed = parseBinary(bytes);
    this.loadParsed(parsed, filename);
    return parsed;
  }

  loadElf(bytes: Uint8Array, filename: string): ParsedHex {
    const elf = parseElf(bytes);
    const hexLike: ParsedHex = {
      segments: elf.segments,
      entryPoint: elf.entryPoint,
      byteCount: elf.segments.reduce((s, seg) => s + seg.data.length, 0),
      minAddress: elf.segments.reduce((m, seg) => Math.min(m, seg.address), 0xffffffff),
      maxAddress: elf.segments.reduce((m, seg) => Math.max(m, seg.address + seg.data.length), 0),
    };
    this.symbolTable = elf.symbols;
    this.loadParsed(hexLike, filename);
    return hexLike;
  }

  private loadParsed(parsed: ParsedHex, filename: string): void {
    this.bus.flash.fill(0);
    for (const seg of parsed.segments) this.bus.loadSegment(seg.address, seg.data);
    this.hexInfo = parsed;
    this.hexName = filename;
    this.entryPoint = parsed.entryPoint || 0;
    this.reset();
    this.status = "paused";
  }

  // ---- control -----------------------------------------------------------

  reset(): void {
    this.bus.resetMemory();
    this.gpio.reset();
    this.uart0.reset(); this.uart1.reset();
    this.timer0.reset(); this.timer1.reset();
    this.pwm.reset(); this.adc1.reset(); this.dac.reset();
    this.vic.reset(); this.i2c0.reset(); this.i2c1.reset();
    this.spi0.reset(); this.spi1.reset();
    this.rtc.reset(); this.sysctl.reset(); this.pinconnect.reset();
    this.lcd.reset(); this.keypad.reset(); this.sevenSeg.reset();
    this.cpu.reset();
    this.cpu.pc = this.entryPoint >>> 0;
    this.bus.cycleRef.value = 0;
    if (this.status !== "idle") this.status = "paused";
  }

  private tickAll(cycles: number): void {
    for (const t of this.tickables) t.tick?.(cycles);
    // Route peripheral IRQ states into VIC
    this.vic.setRaw(IRQ.TIMER0, this.timer0.irqPending());
    this.vic.setRaw(IRQ.TIMER1, this.timer1.irqPending());
    this.vic.setRaw(IRQ.UART0, this.uart0.irqPending());
    this.vic.setRaw(IRQ.UART1, this.uart1.irqPending());
    this.vic.setRaw(IRQ.ADC1, this.adc1.irqPending());
    this.vic.setRaw(IRQ.I2C0, this.i2c0.irqPending());
    this.vic.setRaw(IRQ.SPI0, this.spi0.irqPending());
    // Raise IRQ to CPU if pending and CPU has IRQs enabled
    if (this.vic.irqPending()) {
      const vector = this.vic.getIRQVector();
      if (vector !== 0) this.cpu.raiseIRQ();
    }
    this.bus.cycleRef.value = this.cpu.cycles;
  }

  run(budget: number): SimStatus {
    if (!this.hexInfo) return this.status;
    for (let i = 0; i < budget; i++) {
      if (this.cpu.status !== "ok") {
        this.status = this.cpu.status === "undefined" ? "error" : "halted";
        return this.status;
      }
      if (i > 0 && this.breakpoints.has(this.cpu.pc >>> 0)) {
        this.status = "breakpoint";
        return this.status;
      }
      this.cpu.step();
      this.tickAll(1);
    }
    return this.status;
  }

  stepInto(): void {
    if (!this.hexInfo || this.cpu.status !== "ok") return;
    this.cpu.step(); this.tickAll(1);
  }

  stepOver(): void {
    if (!this.hexInfo || this.cpu.status !== "ok") return;
    const ret = this.nextSequentialPC();
    if (ret === null) { this.stepInto(); return; }
    this.cpu.step(); this.tickAll(1);
    let guard = 5_000_000;
    while (this.cpu.status === "ok" && this.cpu.pc !== ret && guard-- > 0) {
      if (this.breakpoints.has(this.cpu.pc >>> 0)) break;
      this.cpu.step(); this.tickAll(1);
    }
  }

  stepOut(): void {
    if (!this.hexInfo || this.cpu.status !== "ok") return;
    const target = this.cpu.regs[14] & ~1;
    this.cpu.step(); this.tickAll(1);
    let guard = 5_000_000;
    while (this.cpu.status === "ok" && this.cpu.pc !== target && guard-- > 0) {
      if (this.breakpoints.has(this.cpu.pc >>> 0)) break;
      this.cpu.step(); this.tickAll(1);
    }
  }

  private nextSequentialPC(): number | null {
    const pc = this.cpu.pc >>> 0;
    if (this.cpu.T) {
      const op = this.bus.read16(pc);
      if ((op & 0xf800) === 0xf000) return (pc + 4) >>> 0;
      return null;
    }
    const op = this.bus.read32(pc);
    if ((op & 0x0f000000) >>> 24 === 0x0b) return (pc + 4) >>> 0;
    if ((op & 0x0ffffff0) === 0x012fff30) return (pc + 4) >>> 0;
    return null;
  }

  toggleBreakpoint(addr: number): void {
    addr >>>= 0;
    if (this.breakpoints.has(addr)) this.breakpoints.delete(addr);
    else this.breakpoints.add(addr);
  }

  snapshot(): Snapshot {
    const c = this.cpu;
    return {
      cpu: {
        regs: Array.from(c.regs),
        cpsr: c.getCPSR(),
        spsr: c.getSPSR(),
        pc: c.pc >>> 0,
        modeName: MODE_NAMES[c.mode] ?? "?",
        thumb: c.T,
        flags: { N: c.N, Z: c.Z, C: c.C, V: c.V, I: c.I, F: c.F },
        cycles: c.cycles,
      },
      gpio: {
        pin: [this.gpio.pinRegister(0), this.gpio.pinRegister(1)],
        out: [this.gpio.out[0], this.gpio.out[1]],
        dir: [this.gpio.dir[0], this.gpio.dir[1]],
      },
      periph: {
        pwmDuty: [1,2,3,4,5,6].map(ch => this.pwm.dutyCycle(ch as 1|2|3|4|5|6)),
        adcInputs: Array.from(this.adc1.inputs),
        dacVoltage: this.dac.voltage,
        timer0tc: this.timer0.read(0x08, 32),
        timer1tc: this.timer1.read(0x08, 32),
        vicIrqStatus: this.vic.read(0x00, 32),
      },
      lcd: this.lcd.getState(),
      lcdRevision: this.lcd.revision,
      sevenSeg: this.sevenSeg.getDigits(),
      status: this.status,
      warnings: this.bus.warnings.length,
    };
  }

  readMem(addr: number, length: number): Uint8Array {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) out[i] = this.bus.read8((addr + i) >>> 0);
    return out;
  }
}
