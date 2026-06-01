/**
 * RV-IoT board pin assignments used by the simulator UI. The physical board
 * multiplexes several functions onto shared pins; for a legible demo we pick a
 * non-conflicting default bank for the discrete LEDs and switches and keep the
 * PRD pins for the LCD and keypad.
 */

export interface PinRef {
  port: 0 | 1;
  pin: number;
}

// 8-LED bank on P0.0..P0.7 (classic LPC2148 "LED on PORT0" lab wiring).
export const LED_PINS: PinRef[] = Array.from({ length: 8 }, (_, i) => ({
  port: 0,
  pin: i,
}));

// 8 slide switches on P0.8..P0.15 (inputs, pulled high; pressed = low).
export const SWITCH_PINS: PinRef[] = Array.from({ length: 8 }, (_, i) => ({
  port: 0,
  pin: 8 + i,
}));

// LCD (HD44780, 4-bit) — matches PRD §4.3.
export const LCD_PINS = {
  data: [16, 17, 18, 19], // P0.16..P0.19 = D4..D7
  rs: 20, // P0.20
  enPort: 1 as const,
  en: 25, // P1.25
};

// Keypad rows P0.16..P0.19 (out), cols P1.16..P1.19 (in). UI grid → (row,col).
export const KEYPAD_LABELS: string[][] = [
  ["0", "1", "2", "3"],
  ["4", "5", "6", "7"],
  ["8", "9", "A", "B"],
  ["C", "D", "E", "F"],
];

/** UI cell (uiRow,uiCol) → internal (row = P0.16+row, col = P1.16+col). */
export function keypadCellToMatrix(uiRow: number, uiCol: number): { row: number; col: number } {
  // Leftmost UI column is COL3 (P1.19) per PRD layout, so col index inverts.
  return { row: uiRow, col: 3 - uiCol };
}
