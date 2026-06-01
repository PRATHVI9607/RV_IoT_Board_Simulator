import type { GPIO } from "./gpio";

/**
 * 4x4 matrix keypad (RV-IoT board):
 *   Rows  (CPU outputs): P0.16..P0.19
 *   Cols  (CPU inputs):  P1.16..P1.19  (pulled high, active-low)
 *
 * A pressed key connects its row to its column. A column therefore reads LOW
 * only while the row it shares with a pressed key is being driven LOW by the
 * CPU during scanning. We re-evaluate the column inputs whenever GPIO outputs
 * change or a key is pressed/released.
 *
 * Internal index is [row][col] where row 0 = P0.16 and col 0 = P1.16.
 */
const ROW_PORT = 0;
const ROW_BASE = 16;
const COL_PORT = 1;
const COL_BASE = 16;

export class Keypad {
  private pressed: boolean[][] = [
    [false, false, false, false],
    [false, false, false, false],
    [false, false, false, false],
    [false, false, false, false],
  ];

  /** Whether the keypad is wired to the board (user-selectable). */
  enabled = true;

  constructor(private gpio: GPIO) {
    gpio.onChange(() => this.evaluate());
    this.evaluate();
  }

  reset(): void {
    for (const row of this.pressed) row.fill(false);
    this.evaluate();
  }

  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    if (!on) {
      // Release the column lines (float high) when disconnected.
      for (let col = 0; col < 4; col++) this.gpio.setExternalPin(COL_PORT, COL_BASE + col, true);
    } else {
      this.evaluate();
    }
  }

  /** row 0..3 (P0.16+), col 0..3 (P1.16+). */
  setPressed(row: number, col: number, down: boolean): void {
    this.pressed[row][col] = down;
    this.evaluate();
  }

  isPressed(row: number, col: number): boolean {
    return this.pressed[row][col];
  }

  private evaluate(): void {
    if (!this.enabled) return;
    for (let col = 0; col < 4; col++) {
      let low = false;
      for (let row = 0; row < 4; row++) {
        if (this.pressed[row][col] && !this.gpio.pinLevel(ROW_PORT, ROW_BASE + row)) {
          low = true;
          break;
        }
      }
      // Column is HIGH (pulled up) unless pulled low through a pressed key.
      this.gpio.setExternalPin(COL_PORT, COL_BASE + col, !low);
    }
  }
}
