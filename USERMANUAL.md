# LOKI-SIM — Complete User Manual

**RV-IoT LPC2148 (ARM7TDMI-S) Board Simulator**

This manual is written so that **anyone can run any LPC2148 program** and wire up
any peripheral without confusion. Read Section 3 (the workflow) and Section 5
(the pin map) and you can run any lab.

---

## Table of contents
1. [Start the app](#1-start-the-app)
2. [The screen at a glance](#2-the-screen-at-a-glance)
3. [How to run ANY program (the 4-step workflow)](#3-how-to-run-any-program)
4. [Connecting peripherals — the most important idea](#4-connecting-peripherals)
5. [Peripheral pin map — what to write in your code](#5-peripheral-pin-map)
6. [Driving inputs by hand (switches, sensors, buttons)](#6-driving-inputs-by-hand)
7. [The debugger](#7-the-debugger)
8. [The instruments (bottom panel)](#8-the-instruments)
9. [Writing code that actually works on this board](#9-writing-code-that-works)
10. [Per-lab quick recipes](#10-per-lab-quick-recipes)
11. [Keyboard shortcuts](#11-keyboard-shortcuts)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Start the app
```bash
npm install      # first time only
npm run dev      # then open http://localhost:3000
```
Use Chrome or Edge (needed for the buzzer audio and the 3D board). Inside VS Code
you can also do **Ctrl+Shift+P → "Simple Browser: Show"** → `http://localhost:3000`.

---

## 2. The screen at a glance

```
┌─ TOOLBAR ───────────────────────────────────────────────────────────────┐
│  Open · Run/Pause · Stop · Reset · Step · Speed · PC · cycles · STATUS    │
├─ PERIPHERAL TRAY ─────────────────────────────────────────────────────────┤
│  Connect: [LCD] [7-Seg] [Keypad] [ADC] [DAC] [DC Motor] [Stepper 1] ...   │
├────────────────────────────────────────────────┬─────────────────────────┤
│  BOARD                                          │  DEBUGGER                │
│  • LPC2148 CPU (always shown, live pins)        │  [CPU] [Periph] [VIC]    │
│  • Logic Controller: 8 LEDs + 8 switches        │  registers, disassembly, │
│  • + every peripheral you CONNECT from the tray │  breakpoints, memory     │
├────────────────────────────────────────────────┴─────────────────────────┤
│  INSTRUMENTS: [Serial] [GPIO Pins] [Oscilloscope] [Logic] [Wiring] [Log]  │
└───────────────────────────────────────────────────────────────────────────┘
```

The board only shows the peripherals you **connect** (plus the CPU and the LED/
switch bank, which are always present). This keeps everything large and on one
screen instead of cramming all 13 peripherals at once.

---

## 3. How to run ANY program

**Step 1 — Load the program.** Click **Open** (or drag the file onto the board).
Accepted: `.hex` (Keil/Flash Magic output), `.bin`, or `.elf`.

**Step 2 — Connect the peripheral your code uses.** In the **tray** at the top,
click the chip for the peripheral your program drives (e.g. **7-Seg**, **LCD**,
**DC Motor**). It turns green = wired to the CPU. (See Section 4 for why.)

**Step 3 — Set the speed and Run.** Most lab programs have long software-delay
loops, so set speed to **10×** or **MAX** and press **Run (F5)**. Watch the
peripheral respond. The status pill shows **RUNNING**.

**Step 4 — Inspect / interact.** Use the right-hand **Debugger** to watch
registers/memory, set breakpoints (click a disassembly line), and the bottom
**instruments** for serial output, the oscilloscope, or to drive input pins.

> If nothing happens: is the right peripheral connected (Step 2)? Is the speed
> high enough? Is the status RUNNING (not ERROR)? See Section 12.

---

## 4. Connecting peripherals

**Why this exists:** the real RV-IoT board multiplexes many peripherals onto the
**same MCU pins**. For example **P0.16–P0.19** are shared by the LCD data bus, the
keypad rows, the 7-segment data line, *and* the stepper-motor coils. On real
hardware you physically wire up only the peripheral you're using. LOKI-SIM does
the same with the **tray**: a peripheral only reacts to the bus while it is
**connected (green)**.

- **Connect** a peripheral → it appears on the board and interprets the pins.
- **Disconnect** → it's ignored, so it won't "react" to a program meant for a
  different peripheral sharing those pins.

This is why, by default, only the CPU and the LED/switch bank are shown — you
connect exactly what your program needs.

**Pins that are shared (connect only one at a time):**

| Pins | Peripherals that use them |
|------|---------------------------|
| P0.16–P0.19 | LCD data (D4–D7), Keypad rows, Stepper 1 coils, Buzzer |
| P0.19 / P0.20 / P0.30 | 7-Segment DATA / CLK / STROBE (P0.20 is also LCD RS) |
| P0.20–P0.23 | Stepper 2 coils |
| P1.16–P1.19 | Keypad columns, Elevator floor LEDs |

---

## 5. Peripheral pin map

These are the exact pins LOKI-SIM models. **Write your code to these pins** and
the peripheral will respond; use other pins and it won't (that's intended).

### Discrete I/O (always on the board)
| Peripheral | Pins | Notes |
|-----------|------|-------|
| 8 LEDs | **P0.0–P0.7** (outputs) | LED lit when the pin is driven HIGH |
| 8 Switches | **P0.8–P0.15** (inputs) | Released = HIGH (pull-up), pressed = LOW |

### LCD — 20×4 alphanumeric (HD44780, 4-bit)
| Signal | Pin |
|--------|-----|
| Data D4–D7 | **P0.16, P0.17, P0.18, P0.19** |
| RS (register select) | **P0.20** (0 = command, 1 = data) |
| EN (enable strobe) | **P1.25** (data latched on the falling edge) |
| RW | tied to GND (write-only) |

Send each byte as **two nibbles** (high then low) with an EN pulse each. Your
init can configure P0.16–P0.23 as outputs — the model reads only the low nibble
+ RS, so 4-bit drivers work even if all 8 pins are set as outputs.

### 7-Segment — 5 digits, serial shift register (common-anode)
| Signal | Pin |
|--------|-----|
| DATA | **P0.19** |
| CLK | **P0.20** (bit shifted in on the rising edge, MSB first) |
| STROBE | **P0.30** (40 bits latch into 5 digits on the rising edge) |

Segment codes are **active-low** (common-anode): bit 0 = segment ON. Bit order
`a,b,c,d,e,f,g,dp` = bits 0..7. `0xFF` = blank. (e.g. `0x8E` = 'F', `0xC0` = '0'.)

### Matrix Keypad — 4×4
| Signal | Pins |
|--------|------|
| Rows (CPU outputs) | **P0.16, P0.17, P0.18, P0.19** |
| Columns (CPU inputs) | **P1.16, P1.17, P1.18, P1.19** |

Scan by driving one row LOW and reading the columns. A pressed key pulls its
column LOW. Click keys on screen or press `0–9`, `A–F` on your keyboard.

### ADC1 — 10-bit (drag the sliders to set inputs)
| Channel | Pin | Source |
|---------|-----|--------|
| AD1.2 | **P0.29** | LDR (light) |
| AD1.3 | **P0.30** | LM35 temperature |
| AD1.4 | **P0.31** | Potentiometer |

Registers: `AD1CR` (0xE0034000), `AD1GDR` (+0x04, result in bits [15:6], DONE in
bit 31). Software-START and BURST modes both work.

### DAC — 10-bit output
| Signal | Pin | Register |
|--------|-----|----------|
| AOUT | **P0.25** | `DACR` (0xE006C000), VALUE in bits [15:6] |

`V = (VALUE / 1023) × 3.3`. The output feeds **oscilloscope CH1** automatically.

### PWM-driven actuators
| Peripheral | PWM ch | Pin | Extra |
|-----------|--------|-----|-------|
| DC Motor (DRV8801) | PWM6 | **P0.9** (speed) | direction on **P0.28** |
| Servo 1 | PWM4 | **P0.21** | 5 % duty = 0°, 10 % = 180° |
| Servo 2 | PWM5 | **P0.22** | same mapping |
| Buzzer | PWM1 or GPIO | **P0.16–P0.19** | tone via Web Audio |

PWM base 0xE0014000. Set MR0 = period, MRx = match (duty), enable in PWMTCR,
latch with PWMLER, route in PWMPCR.

### Stepper motors (ULN2803)
| Motor | Coil pins |
|-------|-----------|
| Stepper 1 | **P0.16–P0.19** |
| Stepper 2 | **P0.20–P0.23** |

Drive full-step sequence `1000 → 0100 → 0010 → 0001` (or reverse). The UI shows
step count, angle, and direction.

### Elevator
| Part | Pins |
|------|------|
| Floor call buttons (inputs) | **P0.16–P0.19** |
| Floor indicator LEDs (outputs) | **P1.16–P1.19** |
| Lift motor | DC Motor (PWM6 + P0.28) |

The car shows whichever P1.16–P1.19 LED your program drives HIGH.

### UART0 (serial) — always available
TXD0 = **P0.0**, RXD0 = **P0.1**. Base 0xE000C000. Write bytes to `U0THR`; they
appear in the **Serial Monitor**. Type there to deliver bytes to `U0RBR`.

---

## 6. Driving inputs by hand

You don't need a peripheral to feed an input — open the **GPIO Pins** tab
(bottom panel). It lists every pin with its direction (IN/OUT) and live level.
**Click the HIGH/LOW button on any INPUT pin** to drive it. Use this to simulate
a sensor line, a button, or any external signal your code polls.

- **Switches** (P0.8–P0.15): click them on the board, or press `1`–`8`.
- **Keypad** (P1.16–19 cols): click keys, or press `0–9`/`A–F`.
- **ADC**: drag the LDR / LM35 / Potentiometer sliders.
- **Any other input pin**: GPIO Pins tab → click HIGH/LOW.

---

## 7. The debugger (right panel)

**CPU tab**
- **Registers** — R0–R15, SP, LR, PC, CPSR (changed values flash amber), plus the
  N/Z/C/V/I/F/T flags and processor mode.
- **Disassembly** — live ARM/Thumb listing centred on PC. **Click a line to set a
  breakpoint** (red dot); execution pauses there and the screen flashes red.
- **Memory** — hex dump. Type an address + Enter to jump, or click **Flash** /
  **SRAM**.

**Periph tab** — live register values for GPIO, UART, Timer, PWM, ADC, DAC, VIC.

**VIC tab** — interrupt controller: every IRQ source with enable / pending / FIQ.

Stepping: **Step Into (F11)**, **Step Over (F10)**, **Step Out (Shift+F11)**.

---

## 8. The instruments (bottom panel)

| Tab | Use |
|-----|-----|
| **Serial Monitor** | UART0 terminal. Program output appears here; type to send to the CPU. |
| **GPIO Pins** | Direct pin control — view every pin, click INPUT pins to drive them. |
| **Oscilloscope** | 4 channels: CH1 DAC, CH2 PWM6, CH3 P0.0, CH4 P0.1. Timebase, CRT mode, PNG export. |
| **Logic Analyzer** | 8-channel digital trace of P0.0–P0.7. |
| **Wiring** | Drag external parts (sensors, OLED, Bluetooth…) onto a canvas. |
| **Event Log** | Bus warnings — unmapped reads/writes (a stray pointer, wrong address). |

---

## 9. Writing code that works

LOKI-SIM runs **real LPC2148 machine code** and is strict, so wrong code behaves
like wrong code on real hardware:

- **Use the exact pins in Section 5.** If you drive the LCD on the wrong pins,
  nothing shows — the model only responds to the correct pins/protocol.
- **Connect the peripheral** (Section 4) or it won't react at all.
- **Configure pin direction** with IODIR before driving outputs / reading inputs.
- **PLL / startup:** the simulator auto-acknowledges PLL lock, so standard Keil
  startup code runs; you don't need real clock timing.
- **Bad programs fail visibly:**
  - A corrupt `.hex` (bad checksum / record) is rejected on load with an error.
  - An undefined/garbage instruction sets the status to **ERROR** and halts.
  - Accessing an unmapped address is logged in the **Event Log** and reads back
    `0xDEADC0DE`.
  - A program for the wrong pins simply produces no peripheral activity.

Minimum recipe for a GPIO peripheral:
```c
IODIR0 |= mask;     // set the pins you drive as outputs
IOSET0  = mask;     // drive HIGH   (or IOCLR0 = mask for LOW)
x = IOPIN0;         // read inputs
```

---

## 10. Per-lab quick recipes

| Lab | Connect (tray) | Speed | What you see |
|-----|----------------|-------|--------------|
| LED blink | (LEDs always on) | 10× | LEDs on P0.0–7 toggle |
| LCD message | **LCD** | MAX | text on the 20×4 LCD |
| 7-segment (FIRE/HELP) | **7-Seg** | MAX | scrolling/fixed digits |
| Keypad scan | **Keypad** | 2× | pressed keys read by CPU |
| DAC waveform | **DAC** | MAX | waveform on Oscilloscope CH1 |
| ADC read | **ADC** | 2× | move a slider, value changes |
| DC motor / PWM | **DC Motor** | MAX | shaft spins, speed = duty |
| Stepper | **Stepper 1** | MAX | shaft steps, angle counts |
| Servo | **Servo 1** | MAX | arm moves to the angle |
| Elevator | **Elevator** | MAX | car moves between floors |

---

## 11. Keyboard shortcuts

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| `F5` | Run / Pause | `Ctrl+F5` | Stop |
| `F10` | Step Over | `Ctrl+R` | Reset & reload |
| `F11` | Step Into | `F9` | Breakpoint at PC |
| `Shift+F11` | Step Out | `Ctrl+O` | Open file |
| `1`–`8` | Toggle switches | `0–9`,`A–F` | Keypad keys |
| `Ctrl+Shift+P` | Command palette | `Esc` | Close dialogs |

---

## 12. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Peripheral does nothing | **Connect it in the tray** (Section 4); check the pins match Section 5. |
| Loaded but idle | Press **Run** and raise the speed to 10×/MAX (long delay loops). |
| Status = **ERROR** | Undefined instruction — the `.hex` may use an unsupported (coprocessor) op; check the disassembly at PC. |
| Status = **HALTED** | Program reached an idle `while(1)` — usually normal at the end. |
| 7-seg / LCD shows garbage | Make sure the program uses the Section 5 pins and standard HD44780 / common-anode codes. |
| Lots of Event-Log warnings | Program is hitting unmapped addresses (often a stack/pointer bug). |
| Display looks cut off | App targets ≥ 1366-wide screens; maximize the window. Each panel scrolls on its own. |
| Buzzer silent | Click **Mute** to unmute; click the page once (browsers gate audio until interaction). |

---

*Built on Next.js + a from-scratch ARM7TDMI-S core. See `PRD.md` for the full
specification and `README`/source for architecture.*
