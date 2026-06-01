import type { GPIO } from "./gpio";

/**
 * HD44780-compatible 20x4 alphanumeric LCD, wired per the RV-IoT board:
 *   D4-D7 = P0.16-P0.19, RS = P0.20, EN = P1.25, RW = GND (write only).
 *
 * The controller is driven entirely through GPIO. We snoop the GPIO output
 * latch and latch a nibble on each EN falling edge (HD44780 §"4-bit"). Two
 * nibbles (high then low) form one byte. We assume the driver is consistent
 * (always two nibbles per byte), which matches the LCD routines used in RVCE
 * lab code.
 */

export const LCD_COLS = 20;
export const LCD_ROWS = 4;

export interface LCDState {
  rows: string[]; // LCD_ROWS strings of LCD_COLS chars
  cursorRow: number;
  cursorCol: number;
  displayOn: boolean;
  cursorOn: boolean;
  blink: boolean;
  backlight: boolean;
}

const EN_PORT = 1;
const EN_PIN = 25;
const RS_PORT = 0;
const RS_PIN = 20;
const DATA_PORT = 0;
const DATA_SHIFT = 16; // D4..D7 on P0.16..P0.19

export class LCD {
  private buffer = new Uint8Array(LCD_COLS * LCD_ROWS).fill(0x20);
  private address = 0; // DDRAM address (0x00..0x67)
  private prevEN = false;
  private expectingHigh = true;
  private highNibble = 0;
  private increment = true;

  displayOn = false;
  cursorOn = false;
  blink = false;
  backlight = true;
  /** Bumped on any state change so the UI knows to re-read. */
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
    this.displayOn = false;
    this.cursorOn = false;
    this.blink = false;
    this.revision++;
  }

  toggleBacklight(): void {
    this.backlight = !this.backlight;
    this.revision++;
  }

  private sample(): void {
    const en = this.gpio.pinLevel(EN_PORT, EN_PIN);
    if (this.prevEN && !en) {
      // Falling edge of EN: latch the nibble currently on the data lines.
      const nibble = (this.gpio.out[DATA_PORT] >>> DATA_SHIFT) & 0xf;
      const rs = this.gpio.pinLevel(RS_PORT, RS_PIN);
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
    if (addr <= 0x13) return addr; // row 0
    if (addr >= 0x40 && addr <= 0x53) return LCD_COLS + (addr - 0x40); // row 1
    if (addr >= 0x14 && addr <= 0x27) return 2 * LCD_COLS + (addr - 0x14); // row 2
    if (addr >= 0x54 && addr <= 0x67) return 3 * LCD_COLS + (addr - 0x54); // row 3
    return -1;
  }

  private writeCommand(cmd: number): void {
    if (cmd === 0x01) {
      this.buffer.fill(0x20);
      this.address = 0;
    } else if ((cmd & 0xfe) === 0x02) {
      this.address = 0; // return home
    } else if ((cmd & 0xfc) === 0x04) {
      this.increment = (cmd & 0x02) !== 0; // entry mode: I/D
    } else if ((cmd & 0xf8) === 0x08) {
      this.displayOn = (cmd & 0x04) !== 0;
      this.cursorOn = (cmd & 0x02) !== 0;
      this.blink = (cmd & 0x01) !== 0;
    } else if ((cmd & 0xf0) === 0x10) {
      // cursor / display shift — ignored (no shift mode in lab code)
    } else if ((cmd & 0xe0) === 0x20) {
      // function set — 4-bit/2-line fixed on this board
    } else if ((cmd & 0x80) === 0x80) {
      this.address = cmd & 0x7f; // set DDRAM address
    }
    // 0x40-0x7F set CGRAM: custom chars not modeled in Phase 1
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
    };
  }
}
