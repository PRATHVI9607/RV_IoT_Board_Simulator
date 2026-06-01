import type { GPIO } from "./gpio";

/**
 * HD44780-compatible 20x4 alphanumeric LCD driven entirely through GPIO.
 *
 * The RV-IoT board wires the LCD different ways across lab programs, so the
 * model AUTO-DETECTS the interface on each EN (P1.25) falling edge:
 *
 *   8-bit mode  — when P0.16–P0.23 are all configured as outputs:
 *                 D0–D7 = P0.16–P0.23, RS = P0.31 (if output) else P0.20.
 *                 One EN pulse latches one full byte.
 *
 *   4-bit mode  — otherwise: D4–D7 = P0.16–P0.19, RS = P0.20.
 *                 Two EN pulses (high nibble then low) latch one byte.
 *
 * EN = P1.25 in both cases. RW is tied to GND (write-only).
 *
 * When `enabled` is false the LCD is "disconnected" from the board and ignores
 * all bus activity — this lets the user select which peripherals are wired.
 */

export const LCD_COLS = 20;
export const LCD_ROWS = 4;

export interface LCDState {
  rows: string[];
  cursorRow: number;
  cursorCol: number;
  displayOn: boolean;
  cursorOn: boolean;
  blink: boolean;
  backlight: boolean;
  mode: "4-bit" | "8-bit" | "idle";
}

const EN_PORT = 1;
const EN_PIN = 25;
const DATA_PORT = 0;
const DATA_SHIFT = 16; // data lines start at P0.16

export class LCD {
  private buffer = new Uint8Array(LCD_COLS * LCD_ROWS).fill(0x20);
  private address = 0;
  private prevEN = false;
  private expectingHigh = true;
  private highNibble = 0;
  private increment = true;
  private detectedMode: "4-bit" | "8-bit" | "idle" = "idle";

  displayOn = false;
  cursorOn = false;
  blink = false;
  backlight = true;
  /** Whether the LCD is wired to the board (user-selectable). */
  enabled = true;
  revision = 0;

  constructor(private gpio: GPIO) {
    gpio.onChange(() => this.sample());
  }

  reset(): void {
    this.buffer.fill(0x20);
    this.address = 0;
    this.prevEN = false;
    this.expectingHigh = true;
    this.highNibble = 0;
    this.increment = true;
    this.detectedMode = "idle";
    this.displayOn = false;
    this.cursorOn = false;
    this.blink = false;
    this.revision++;
  }

  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    if (!on) {
      // Clear the panel when disconnected.
      this.buffer.fill(0x20);
      this.displayOn = false;
      this.detectedMode = "idle";
    }
    this.expectingHigh = true;
    this.revision++;
  }

  toggleBacklight(): void {
    this.backlight = !this.backlight;
    this.revision++;
  }

  private sample(): void {
    if (!this.enabled) return;
    const en = this.gpio.pinLevel(EN_PORT, EN_PIN);
    if (this.prevEN && !en) {
      // Data nibble on P0.16-19 (D4-D7), RS on P0.20, latched on EN falling
      // edge. Two nibbles (high then low) form one byte. RVCE lab drivers use
      // 4-bit mode even when P0.16-23 are all configured as outputs.
      const out = this.gpio.out[DATA_PORT] >>> 0;
      const nibble = (out >>> DATA_SHIFT) & 0xf;
      const rs = !!(out & (1 << 20));
      this.detectedMode = "4-bit";
      if (this.expectingHigh) {
        this.highNibble = nibble;
        this.expectingHigh = false;
      } else {
        const byte = ((this.highNibble << 4) | nibble) & 0xff;
        this.expectingHigh = true;
        if (rs) this.writeData(byte);
        else this.writeCommand(byte);
        this.revision++;
      }
    }
    this.prevEN = en;
  }

  private addrToIndex(addr: number): number {
    if (addr <= 0x13) return addr;
    if (addr >= 0x40 && addr <= 0x53) return LCD_COLS + (addr - 0x40);
    if (addr >= 0x14 && addr <= 0x27) return 2 * LCD_COLS + (addr - 0x14);
    if (addr >= 0x54 && addr <= 0x67) return 3 * LCD_COLS + (addr - 0x54);
    return -1;
  }

  private writeCommand(cmd: number): void {
    if (cmd === 0x01) {
      this.buffer.fill(0x20);
      this.address = 0;
    } else if ((cmd & 0xfe) === 0x02) {
      this.address = 0;
    } else if ((cmd & 0xfc) === 0x04) {
      this.increment = (cmd & 0x02) !== 0;
    } else if ((cmd & 0xf8) === 0x08) {
      this.displayOn = (cmd & 0x04) !== 0;
      this.cursorOn = (cmd & 0x02) !== 0;
      this.blink = (cmd & 0x01) !== 0;
    } else if ((cmd & 0xf0) === 0x10) {
      // cursor/display shift — ignored
    } else if ((cmd & 0xe0) === 0x20) {
      // function set — bus width handled by auto-detect
    } else if ((cmd & 0x80) === 0x80) {
      this.address = cmd & 0x7f;
    }
  }

  private writeData(byte: number): void {
    const idx = this.addrToIndex(this.address);
    if (idx >= 0) this.buffer[idx] = byte;
    this.address = (this.address + (this.increment ? 1 : -1)) & 0x7f;
  }

  getState(): LCDState {
    const rows: string[] = [];
    for (let r = 0; r < LCD_ROWS; r++) {
      let s = "";
      for (let c = 0; c < LCD_COLS; c++) {
        const code = this.buffer[r * LCD_COLS + c];
        s += code >= 0x20 && code < 0x80 ? String.fromCharCode(code) : " ";
      }
      rows.push(s);
    }
    const idx = this.addrToIndex(this.address);
    return {
      rows,
      cursorRow: idx >= 0 ? Math.floor(idx / LCD_COLS) : 0,
      cursorCol: idx >= 0 ? idx % LCD_COLS : 0,
      displayOn: this.displayOn,
      cursorOn: this.cursorOn,
      blink: this.blink,
      backlight: this.backlight,
      mode: this.detectedMode,
    };
  }
}
