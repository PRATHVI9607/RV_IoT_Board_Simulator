import type { GPIO } from "./gpio";

/**
 * 5-digit serial seven-segment display (shift-register driven), per the
 * RV-IoT board: DATA = P0.19, CLK = P0.20, STROBE = P0.30.
 *
 * On each CLK rising edge the DATA bit is shifted into a 40-bit register
 * (MSB first). On a STROBE pulse the 40 bits latch into 5 digit bytes
 * (segment patterns a,b,c,d,e,f,g,dp per digit).
 *
 * Like the LCD/keypad it has an `enabled` flag so the user can select whether
 * it is wired to the board (it shares P0.19/P0.20 with the LCD and keypad).
 */
const DATA_PORT = 0, DATA_PIN = 19;
const CLK_PORT = 0, CLK_PIN = 20;
const STB_PORT = 0, STB_PIN = 30;

// Blank digit = all segments off. The RV-IoT display is COMMON-ANODE
// (active-low), so 0xFF means "all segments off" (blank).
const BLANK = 0xff;

export class SevenSeg {
  private shift: bigint = 0n;     // up to 40 bits
  private digits = new Uint8Array(5).fill(BLANK);
  private prevClk = false;
  private prevStb = false;

  enabled = false; // off by default — user connects it when needed
  revision = 0;

  constructor(private gpio: GPIO) {
    gpio.onChange(() => this.sample());
  }

  reset(): void {
    this.shift = 0n;
    this.digits.fill(BLANK);
    this.prevClk = false;
    this.prevStb = false;
    this.revision++;
  }

  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    if (!on) this.digits.fill(BLANK);
    this.revision++;
  }

  getDigits(): number[] {
    return Array.from(this.digits);
  }

  private sample(): void {
    if (!this.enabled) return;
    const clk = this.gpio.pinLevel(CLK_PORT, CLK_PIN);
    const stb = this.gpio.pinLevel(STB_PORT, STB_PIN);
    const data = this.gpio.pinLevel(DATA_PORT, DATA_PIN);

    // Shift on CLK rising edge.
    if (clk && !this.prevClk) {
      this.shift = ((this.shift << 1n) | (data ? 1n : 0n)) & ((1n << 40n) - 1n);
    }
    // Latch on STROBE rising edge.
    if (stb && !this.prevStb) {
      for (let d = 0; d < 5; d++) {
        const byte = Number((this.shift >> BigInt((4 - d) * 8)) & 0xffn);
        this.digits[d] = byte;
      }
      this.revision++;
    }
    this.prevClk = clk;
    this.prevStb = stb;
  }
}
