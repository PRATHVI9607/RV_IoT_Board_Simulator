# RV-IoT LPC2148 Board Simulator — Product Requirements Document

**Version:** 1.0.0  
**Date:** June 2026  
**Author:** Loki @ RVCE  
**Project Codename:** `LOKI-SIM`  
**Target Audience:** This PRD is written as a direct build specification for Claude Code. Every section is actionable.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision & Goals](#3-product-vision--goals)
4. [Board Hardware Extraction (from Image)](#4-board-hardware-extraction-from-image)
5. [System Architecture](#5-system-architecture)
6. [Technology Stack](#6-technology-stack)
7. [Design System & UI Specification](#7-design-system--ui-specification)
8. [Core Simulation Engine](#8-core-simulation-engine)
9. [Feature Modules — Detailed Specification](#9-feature-modules--detailed-specification)
   - 9.1 Hex File Loader & ELF Parser
   - 9.2 ARM7TDMI CPU Emulator
   - 9.3 Memory Map Emulator
   - 9.4 GPIO Controller
   - 9.5 UART Peripheral
   - 9.6 I2C Peripheral
   - 9.7 SPI Peripheral
   - 9.8 ADC Peripheral
   - 9.9 DAC Peripheral
   - 9.10 PWM Controller
   - 9.11 Timer/Counter
   - 9.12 Interrupt Controller (VIC)
   - 9.13 LCD Display Emulator (20×4 Alphanumeric)
   - 9.14 Seven-Segment Display Emulator
   - 9.15 Matrix Keypad Emulator
   - 9.16 Logic Controller (8 LEDs + 8 Switches)
   - 9.17 Stepper Motor Emulator
   - 9.18 DC Motor Emulator
   - 9.19 Servo Motor Emulator
   - 9.20 Buzzer Emulator
   - 9.21 Elevator Interface
   - 9.22 Oscilloscope (Virtual)
   - 9.23 Keil uVision 5 Debug Interface
   - 9.24 Register Inspector & Memory Viewer
   - 9.25 Serial Monitor (UART Terminal)
   - 9.26 Peripheral Wiring Canvas (External Peripherals)
10. [Board 2D/3D Render Specification](#10-board-2d3d-render-specification)
11. [State Management Architecture](#11-state-management-architecture)
12. [File I/O & Session Persistence](#12-file-io--session-persistence)
13. [Design Taste Frontend Integration](#13-design-taste-frontend-integration)
14. [Folder & File Structure](#14-folder--file-structure)
15. [Build & Dev Tooling](#15-build--dev-tooling)
16. [Testing Strategy](#16-testing-strategy)
17. [Performance Targets](#17-performance-targets)
18. [Accessibility & Responsiveness](#18-accessibility--responsiveness)
19. [Phase Roadmap](#19-phase-roadmap)
20. [Appendix A — LPC2148 Register Reference](#20-appendix-a--lpc2148-register-reference)
21. [Appendix B — Skill Reference for Claude Code](#21-appendix-b--skill-reference-for-claude-code)

---

## 1. Executive Summary

**LOKI-SIM** is a browser-based, visually stunning simulation environment for the **RV-IoT ARM All-in-One Board**, which is built around the **NXP LPC2148 ARM7TDMI-S 32-bit microcontroller**. The simulator allows students and engineers at RVCE to:

- Upload a compiled `.hex` file (just like Flash Magic) and see it execute cycle-accurately on a virtual board.
- Interact with every peripheral visible on the RV-IoT board — LEDs, switches, LCD, 7-seg display, keypad, motors, buzzer, DAC, ADC — via a beautiful rendered 2D board visual.
- Attach external peripherals through a drag-and-drop wiring canvas.
- Debug in real time with a Keil uVision 5-style debugging panel: register view, memory map, disassembler, breakpoints, watch variables, call stack.
- Visualize signals with a built-in oscilloscope and logic analyzer.

The entire product is a **Next.js 14 (App Router) web application**, self-contained, deployable to Vercel or any static host, with zero backend required. All simulation runs in the browser via WebAssembly (for the ARM7 core) and TypeScript (for peripherals).

---

## 2. Problem Statement

RVCE students enrolled in **CS344AI — IoT & Embedded Computing** lab work on the LPC2148-based RV-IoT board. The current workflow is:

1. Write C code → Compile with Keil uVision 5 → Generate `.hex` → Flash with Flash Magic → Observe on physical hardware.

**Pain points:**
- Physical boards are shared resources. Students cannot practice at home.
- Debugging is limited to LED blinking or UART output — no register-level visibility.
- Proteus supports LPC2148 but lacks the exact RV-IoT board peripherals (ULN2803 stepper, DRV8801 DC motor, specific LCD wiring, elevator interface, etc.).
- Keil simulation lacks peripheral interaction (you can't "press a button" in Keil).
- No single tool combines: hex upload + board simulation + oscilloscope + serial monitor + debug panel.

**LOKI-SIM** solves all of these in one browser tab.

---

## 3. Product Vision & Goals

### Vision

A photorealistic (or stylized 2D) simulation of the RV-IoT board that feels alive — LEDs actually glow, the LCD renders characters, the motor spins, the oscilloscope waveform traces in real time — while also providing the deep debug power of a professional IDE.

### Goals

| # | Goal | Priority |
|---|------|----------|
| G1 | Upload real `.hex` / `.elf` files and execute them | P0 |
| G2 | Accurately simulate all on-board peripherals from the image | P0 |
| G3 | Beautiful, non-generic board UI (2D top-down board render) | P0 |
| G4 | Keil-style debug panel (registers, memory, breakpoints) | P0 |
| G5 | Virtual oscilloscope with pin selection | P1 |
| G6 | External peripheral wiring canvas | P1 |
| G7 | Serial monitor (UART terminal) | P1 |
| G8 | Logic analyzer (8-channel) | P1 |
| G9 | 3D board render option (Three.js) | P2 |
| G10 | Save/load simulation sessions | P2 |

### Non-Goals (v1)

- Cloud save / user accounts
- Multi-board simulation (only one LPC2148 at a time)
- Real-time collaboration
- Mobile-first layout (desktop priority)

---

## 4. Board Hardware Extraction (from Image)

This section extracts every component from the uploaded RV-IoT board image. These are the ground truth inputs for the simulation.

### 4.1 Microcontroller

| Property | Value |
|----------|-------|
| IC | LPC2148 |
| Architecture | ARM7TDMI-S |
| Bits | 32-bit |
| Manufacturer | NXP |
| Clock | Up to 60 MHz |
| Flash | 512 KB on-chip |
| RAM | 40 KB on-chip (32 KB local + 8 KB USB) |
| GPIO Ports | PORT0 (P0.0–P0.31), PORT1 (P1.16–P1.31) |

### 4.2 Serial Ports (top-left cluster)

| Interface | Notes | Pins |
|-----------|-------|------|
| UART | via MAX232 RS-232 level shifter | P0.0 (TXD0), P0.1 (RXD0) |
| UART1 | Secondary UART | P0.8 (TXD1), P0.9 (RXD1) |
| WiFi / Bluetooth | Connected via UART (external module header) | Same as UART |
| Real Time Clock | External 16-bit | I2C pins (P0.2/P0.3) |
| I2C | On-board | P0.2 (SDA), P0.3 (SCL) |
| SPI | For SPI display, SD Card | P0.4 (SCK0), P0.5 (MISO0), P0.6 (MOSI0), P0.7 (SSEL0) |

### 4.3 Displays

#### 20×4 Alphanumeric LCD (center-top area)

| Signal | Pin |
|--------|-----|
| Data Bus (4-bit mode) | P0.16–P0.19 |
| RS | P0.20 |
| EN | P1.25 |
| RW | GND (write-only) |

#### Seven-Segment Display (top-center, 5-digit)

| Signal | Pin |
|--------|-----|
| DATA | P0.19 |
| CLK | P0.20 |
| STROBE | P0.30 |
| Type | Serial shift-register driven, 5 digits |

### 4.4 Analog I/O

| Feature | Pins | Notes |
|---------|------|-------|
| ADC inputs | AD1.2 = P0.29, AD1.3 = P0.30, AD1.4 = P0.31 | From LDR, LM35 temp sensor, Potentiometer, Joystick |
| External ADC input | P0.25 (AOUT also configurable) | Joystick axis |
| DAC output | P0.25 (AOUT) | DAC connector with SIGNAL and GND pins for oscilloscope |

### 4.5 Matrix Keypad (center-bottom)

| Signal | Pins | Notes |
|--------|------|-------|
| Rows (OUTPUT) | P0.16–P0.19 | 4 rows |
| Columns (INPUT) | P1.16–P1.19 | COL0=P1.16, COL1=P1.17, COL2=P1.18, COL3=P1.19 |
| Layout | 4×4 grid | 0–9, A–F plus *, # |

**Keypad matrix layout:**
```
Col:  P1.19  P1.18  P1.17  P1.16
       COL3   COL2   COL1   COL0
P0.16  0      1      2      3     (row 0)
P0.17  4      5      6      7     (row 1)
P0.18  8      9      A      B     (row 2)
P0.19  C      D      E      F     (row 3)
```

### 4.6 Motor Interfaces (right side)

#### Stepper Motor 1 & 2 (ULN2803 IC)

| Signal | Pins |
|--------|------|
| Control | P0.16–P0.19 (shared with keypad rows, mux-able) |
| Second set | P0.20–P0.24 |
| Driver IC | ULN2803 Darlington array |

#### DC Motor (DRV8801 IC)

| Signal | Pin |
|--------|-----|
| DIR (direction) | P0.28 |
| PWM6 (speed control) | P0.9 / PWM6 |
| Driver IC | DRV8801 |

#### Servo Motor 1 & 2

| Signal | Pin |
|--------|-----|
| PWM4 | Servo 1 |
| PWM5 | Servo 2 |
| Used pins | From PWM controller |

### 4.7 Logic Controller (bottom-left)

| Component | Pins | Details |
|-----------|------|---------|
| 8 LEDs | P0.16–P0.19, P1.16–P1.31 | Active-low or active-high configurable |
| 8 Switches | P0.16–P0.19, P1.16–P1.31 | Pull-up configurable |
| Buzzer | P0.16–P0.19 (with ULN transistor) | Tone generation via PWM or GPIO toggle |

### 4.8 Elevator Interface (bottom-right)

| Component | Notes |
|-----------|-------|
| Floor buttons | Mapped to GPIO P0.16–P0.19, P0.20–P0.23 |
| Floor indicators | LED array driven from PORT1 |
| Motor relay | Via DC Motor interface |

### 4.9 Additional Connectors / Headers

| Connector | Purpose |
|-----------|---------|
| DAC connector | SIGNAL + GND pins for external oscilloscope |
| ISP header | Programming via Flash Magic (UART0 + ISP pin) |
| JTAG header | For debugging (simulated in LOKI-SIM) |
| External peripheral headers | Expose all PORT0 and PORT1 pins for user wiring |

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          LOKI-SIM Browser App                        │
│                                                                       │
│  ┌──────────────┐   ┌─────────────────┐   ┌──────────────────────┐  │
│  │  HEX/ELF    │   │  ARM7 Core      │   │  Peripheral Bus      │  │
│  │  Loader     │──▶│  (WebAssembly)  │◀─▶│  (TypeScript)        │  │
│  │             │   │  - Fetch/Decode │   │  - GPIO              │  │
│  └──────────────┘   │  - Execute     │   │  - UART              │  │
│                     │  - VIC         │   │  - I2C / SPI         │  │
│  ┌──────────────┐   │  - Timers      │   │  - ADC / DAC         │  │
│  │  Debug UI   │   └─────────────────┘   │  - PWM / Timers      │  │
│  │  - Regs     │            │            └──────────┬───────────┘  │
│  │  - Memory   │            │                       │               │
│  │  - Disasm   │            ▼                       ▼               │
│  │  - BP       │   ┌─────────────────┐   ┌──────────────────────┐  │
│  └──────────────┘   │  Memory Map     │   │  Board Render Layer  │  │
│                     │  - Flash 512KB  │   │  - 2D SVG Board      │  │
│  ┌──────────────┐   │  - SRAM 32KB   │   │  - 3D Three.js Board │  │
│  │  Oscilloscope│   │  - MMIO Regs   │   │  - Peripheral UIs    │  │
│  │  Logic Anal. │   └─────────────────┘   └──────────────────────┘  │
│  └──────────────┘                                                     │
│                                                                       │
│  ┌──────────────┐   ┌─────────────────┐   ┌──────────────────────┐  │
│  │  Serial Mon  │   │  Wiring Canvas  │   │  Session Store       │  │
│  │  (UART term) │   │  (ext periph.)  │   │  (IndexedDB)         │  │
│  └──────────────┘   └─────────────────┘   └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.1 Simulation Clock Model

- The ARM7 core runs at a configurable clock: 12 MHz (crystal), 48 MHz (USB PLL), or 60 MHz (max).
- The simulation executes in discrete "tick" batches using `requestAnimationFrame` for smooth UI updates.
- Each animation frame: execute N ARM7 cycles → update peripheral state → redraw changed UI elements.
- Target: simulate ~1 million cycles per second in WebAssembly (fast enough for lab programs at 12 MHz visual speed).
- Speed controls: 0.25×, 0.5×, 1×, 2×, 10×, MAX, PAUSED.

### 5.2 Memory Map (LPC2148)

| Region | Start | End | Description |
|--------|-------|-----|-------------|
| On-chip Flash | `0x00000000` | `0x0007FFFF` | 512 KB Flash |
| On-chip SRAM | `0x40000000` | `0x40007FFF` | 32 KB local SRAM |
| USB SRAM | `0x7FD00000` | `0x7FD01FFF` | 8 KB |
| APB Peripherals | `0xE0000000` | `0xEFFFFFFF` | All MMIO regs |
| AHB Peripherals | `0xFFE00000` | `0xFFFFFFFF` | EMAC, etc. |
| VIC | `0xFFFFF000` | `0xFFFFFFFF` | Interrupt Controller |

---

## 6. Technology Stack

### 6.1 Frontend Framework

| Layer | Technology | Reason |
|-------|-----------|--------|
| Framework | **Next.js 14 (App Router)** | RSC, file-based routing, Vercel deploy |
| Language | **TypeScript 5.x** | Full type safety for MMIO, peripheral state |
| Styling | **Tailwind v4** | Utility-first, dark-tech theme |
| Animation | **Motion (motion/react)** | Smooth LED glow, oscilloscope drawing |
| 2D Render | **SVG + React** | Board render, pin highlights |
| 3D Render | **Three.js (r158+)** | Optional 3D board view |
| Canvas | **PixiJS 8** | Oscilloscope, logic analyzer high-perf canvas |
| State | **Zustand** | Global sim state, peripheral registers |
| Icons | **@phosphor-icons/react** | Consistent icon family |

### 6.2 Simulation Engine

| Layer | Technology | Reason |
|-------|-----------|--------|
| ARM7 Core | **Rust → WebAssembly** | Near-native speed for fetch/decode/execute |
| Rust emulator | `arm7tdmi-rs` or custom | Handle Thumb + ARM32 instruction sets |
| Hex Parser | TypeScript (IntelHex) | Parse `.hex` Intel format |
| ELF Parser | TypeScript (`elfinfo`) | Parse `.elf` for debug symbols |
| Peripheral Bus | TypeScript MMIO | Memory-mapped peripheral stubs |

> **Note for Claude Code:** If the Rust WASM build pipeline is too complex for Phase 1, implement the ARM7 core in TypeScript first (slower but functional) and migrate to WASM in Phase 2. The peripheral bus interface should be identical either way.

### 6.3 Storage

| Purpose | Technology |
|---------|-----------|
| Session persistence | `IndexedDB` via `idb` package |
| Hex file storage | `File` API + `ArrayBuffer` |
| User preferences | `localStorage` |

### 6.4 Build Tooling

| Tool | Config |
|------|--------|
| Bundler | Next.js built-in (Turbopack for dev) |
| WASM | `@next/wasm` + Rust `wasm-pack` |
| Linting | ESLint + `@typescript-eslint` |
| Formatting | Prettier |
| Testing | Vitest + Testing Library |

---

## 7. Design System & UI Specification

> **Design Read:** _"Reading this as: engineering simulation tool for CS students, with a Dark Tech / Hacker IDE aesthetic, leaning toward dark zinc/slate + neon cyan/green accents + monospace data display."_

### 7.1 Design Dials (from `design-taste-frontend` skill)

```
DESIGN_VARIANCE: 7     (structured but visually distinctive)
MOTION_INTENSITY: 6    (LED glow pulses, oscilloscope real-time trace, panel transitions)
VISUAL_DENSITY: 8      (cockpit/IDE level — lots of data panels, not airy)
```

### 7.2 Color Palette

```css
/* CSS Custom Properties — global.css */
:root {
  --bg-primary:     #0a0e14;   /* deep near-black, blue-tinted */
  --bg-secondary:   #0f1520;   /* panel backgrounds */
  --bg-tertiary:    #161d2b;   /* card/pane interiors */
  --bg-board:       #1a2035;   /* PCB green tinted dark blue */
  --accent-cyan:    #00d4ff;   /* primary accent, scope traces, active pins */
  --accent-green:   #39ff14;   /* neon green, LEDs, active signals */
  --accent-amber:   #ffb300;   /* warnings, timers */
  --accent-red:     #ff4136;   /* errors, breakpoints */
  --accent-purple:  #9b59ff;   /* interrupt signals, VIC */
  --text-primary:   #e2e8f0;   /* main text */
  --text-secondary: #8892a4;   /* labels, muted */
  --text-mono:      #7ee8a2;   /* register values, hex addresses */
  --border-dim:     #1e2a3a;   /* subtle borders */
  --border-active:  #00d4ff44; /* glowing active border */
  --pcb-trace:      #2d6a4f;   /* PCB trace color for board art */
  --led-glow-green: #39ff14;
  --led-glow-red:   #ff4136;
  --led-glow-amber: #ffb300;
}
```

### 7.3 Typography

```
Display/Panels:  "Geist" (sans-serif)
Monospace:       "Geist Mono" or "JetBrains Mono" (register values, addresses, code)
Size Scale:
  xs:  10px  (pin labels on board)
  sm:  12px  (register names, labels)
  base: 14px (panel body text)
  lg:  16px  (panel headers)
  xl:  20px  (section headings)
  2xl: 28px  (app title)
```

### 7.4 Layout Structure

The app has a **fixed IDE-style layout** with resizable panes:

```
┌─────────────────────────────────────────────────────────────┐
│  TOOLBAR: [Upload Hex] [▶ Run] [⏸ Pause] [⏹ Stop]          │
│           [⚡ Speed: 1x ▾] [🕐 Cycle: 0] [⚙ Settings]       │
├────────────────────────────────┬────────────────────────────┤
│                                │  DEBUG PANEL (right)        │
│   BOARD CANVAS (center)        │  ┌──────────────────────┐  │
│                                │  │  Registers            │  │
│   [2D SVG Board Render]        │  │  R0-R15, CPSR, SPSR  │  │
│                                │  ├──────────────────────┤  │
│   (interactive pins,           │  │  Memory View          │  │
│    glowing LEDs,               │  │  [hex dump]           │  │
│    LCD showing text,           │  ├──────────────────────┤  │
│    keypad clickable,           │  │  Breakpoints          │  │
│    motor animation)            │  ├──────────────────────┤  │
│                                │  │  Disassembler         │  │
│                                │  ├──────────────────────┤  │
│                                │  │  Watch Variables      │  │
│                                │  └──────────────────────┘  │
├────────────────────────────────┴────────────────────────────┤
│  BOTTOM TABS:                                                │
│  [Oscilloscope] [Logic Analyzer] [Serial Monitor]           │
│  [Peripheral Wiring] [Event Log]                            │
└─────────────────────────────────────────────────────────────┘
```

### 7.5 PCB Board Visual Style

The center board canvas should look like:
- A **dark navy/green PCB** (color: `#0d1f12` to `#111c0f`) with a slight texture (subtle noise filter via SVG `feTurbulence`).
- ICs are **gray/silver DIP/SOIC packages** with pin markings.
- Copper traces in **muted gold/amber** (`#b08847` at 30% opacity).
- Active GPIO pins **glow cyan** with a soft drop shadow (`filter: drop-shadow(0 0 4px var(--accent-cyan))`).
- Active output pins **glow green**.
- LEDs rendered as circles with radial gradient glow when HIGH.
- The LPC2148 IC is the centerpiece — large, labeled, with all 64 pins shown and their current state.

### 7.6 Motion Rules

Motivated animations only (per skill rule):

| Animation | Reason | Implementation |
|-----------|--------|---------------|
| LED glow pulse | Communicates HIGH/LOW signal state | CSS keyframe radial glow |
| Oscilloscope line draw | Shows real-time signal waveform | PixiJS Canvas path |
| Panel slide-in | Feedback on tab switch | Motion `AnimatePresence` |
| Register value flash | Shows when value changes | Background flash on `<td>` |
| Breakpoint hit | Board freeze + red flash | Full-screen overlay flash |
| LCD character render | Character appears with 10ms cursor blink | CSS animation |
| Motor rotation SVG | Communicates motor running state | CSS `rotate` animation speed based on PWM duty |

---

## 8. Core Simulation Engine

### 8.1 ARM7TDMI-S CPU Emulator

The CPU emulator is the heart of LOKI-SIM. It must:

#### Instruction Sets Supported
- **ARM32** (32-bit instructions, non-Thumb)
- **Thumb** (16-bit instruction subset) — LPC2148 boots in ARM32 but switches on `BX` instruction
- **Thumb-2** is NOT present in ARM7TDMI — do not implement

#### Register File
```
General Purpose:  R0–R12
Stack Pointer:    R13 (SP)
Link Register:    R14 (LR)
Program Counter:  R15 (PC)
Status Register:  CPSR (Current Program Status Register)
                  SPSR (Saved PSR per exception mode)
```

#### CPSR Bit Layout
```
[31] N - Negative
[30] Z - Zero
[29] C - Carry
[28] V - Overflow
[7]  I - IRQ disable
[6]  F - FIQ disable
[5]  T - Thumb state
[4:0] M - Processor mode (User/FIQ/IRQ/SVC/Abort/Undefined/System)
```

#### Processor Modes
```
0b10000  User
0b10001  FIQ
0b10010  IRQ
0b10011  Supervisor (SVC)
0b10111  Abort
0b11011  Undefined
0b11111  System
```

#### Execution Pipeline
- 3-stage pipeline: Fetch → Decode → Execute
- PC = instruction address + 8 (ARM) or +4 (Thumb) due to pipeline prefetch
- Implement this correctly — many bugs stem from wrong PC value during execution

#### Key ARM32 Instruction Groups to Implement
1. Data Processing (MOV, ADD, SUB, AND, ORR, EOR, BIC, LSL, LSR, ASR, ROR, CMP, TST, TEQ)
2. Load/Store (LDR, STR, LDRB, STRB, LDRH, STRH, LDM, STM, PUSH, POP)
3. Branch (B, BL, BX, BLX)
4. Multiply (MUL, MLA, UMULL, UMLAL, SMULL, SMLAL)
5. PSR Transfer (MRS, MSR)
6. SWI (Software Interrupt — used for semihosting)
7. Coprocessor (CDP, LDC, STC, MCR, MRC — stub for now)

#### ARM7 WebAssembly Interface (Rust)
```rust
// Exported WASM functions
#[wasm_bindgen]
pub fn cpu_step(n_cycles: u32) -> StepResult;

#[wasm_bindgen]
pub fn cpu_read_reg(reg: u8) -> u32;

#[wasm_bindgen]
pub fn cpu_write_reg(reg: u8, val: u32);

#[wasm_bindgen]
pub fn cpu_read_mem(addr: u32, size: u8) -> u32;

#[wasm_bindgen]
pub fn cpu_write_mem(addr: u32, val: u32, size: u8);

#[wasm_bindgen]
pub fn cpu_load_program(hex_bytes: &[u8]);

#[wasm_bindgen]
pub fn cpu_reset();

#[wasm_bindgen]
pub fn cpu_get_pc() -> u32;

#[wasm_bindgen]
pub fn cpu_get_cpsr() -> u32;
```

> **Note for Claude Code:** For Phase 1, implement the CPU in TypeScript. The Rust WASM can replace it in Phase 2 with the same interface contract.

---

## 9. Feature Modules — Detailed Specification

### 9.1 Hex File Loader & ELF Parser

**Purpose:** Load compiled programs (as produced by Keil uVision 5) into simulated Flash memory.

**Supported Formats:**
- Intel HEX (`.hex`) — primary, produced by Keil
- ELF (`.elf`) — for debug symbols (function names, variable names, source line mapping)
- Binary (`.bin`) — raw binary at address 0

**Intel HEX Parser:**
```typescript
interface HexRecord {
  type: 0x00 | 0x01 | 0x02 | 0x03 | 0x04 | 0x05;
  // 00=Data, 01=EOF, 02=Extended Segment, 03=Start Segment, 
  // 04=Extended Linear Address, 05=Start Linear Address
  address: number;
  data: Uint8Array;
}

function parseIntelHex(hexText: string): { 
  segments: Array<{ address: number; data: Uint8Array }>;
  entryPoint: number;
}
```

**UI Component — `<HexLoader />`:**
- Drag-and-drop zone (full board canvas as drop target when no hex loaded)
- File picker button
- Progress bar for large files
- Validation: checksum verification, address range check (must fit LPC2148 flash)
- After load: show summary (file size, entry point, code size, data size)
- Auto-reset CPU and reload memory on new file upload

**ELF Symbol Table:**
- Parse `.symtab` section for function and variable addresses
- Parse `.debug_line` for source-line-to-address mapping (DWARF2)
- Use symbols in: disassembler (show function names), memory viewer (variable names), watch window

### 9.2 ARM7TDMI CPU Emulator

See Section 8.1 for full specification.

**Additional UI requirements:**
- **Step Into:** execute one instruction
- **Step Over:** execute until next instruction at same call depth
- **Step Out:** execute until function returns (LR match)
- **Run to Cursor:** run until PC = address where user clicked in disassembler
- **Continue:** run at full speed until breakpoint or stop

### 9.3 Memory Map Emulator

**Flash Memory (`0x00000000`–`0x0007FFFF`):**
- 512 KB, initialized from loaded HEX
- Read-only during execution (writes are ignored with console warning)
- Support `IAP` (In-Application Programming) command emulation (stub)

**SRAM (`0x40000000`–`0x40007FFF`):**
- 32 KB, read/write
- Initialized to 0x00 on reset
- Stack grows downward from `0x40008000`

**MMIO Peripheral Registers (`0xE0000000`+):**
- All register reads/writes are intercepted by the peripheral bus
- Each peripheral module owns its address range and handles read/write
- Unknown address read returns `0xDEADC0DE` (with console warning)

**Memory Viewer UI:**
- Hex dump: `[Address] [Hex bytes × 16] [ASCII]`
- Color coding: Flash = blue tint, SRAM = green tint, MMIO = amber tint
- Jump-to-address input
- Search: hex pattern or ASCII string
- Editable cells (click a byte to edit it — useful for debugging)

### 9.4 GPIO Controller

**LPC2148 GPIO Registers:**

| Register | Address | Description |
|----------|---------|-------------|
| IO0PIN | 0xE0028000 | Port 0 Pin Value |
| IO0SET | 0xE0028004 | Port 0 Output Set |
| IO0DIR | 0xE0028008 | Port 0 Direction |
| IO0CLR | 0xE002800C | Port 0 Output Clear |
| IO1PIN | 0xE0028010 | Port 1 Pin Value |
| IO1SET | 0xE0028014 | Port 1 Output Set |
| IO1DIR | 0xE0028018 | Port 1 Direction |
| IO1CLR | 0xE002801C | Port 1 Output Clear |

**Simulation Logic:**
- `IO0DIR` bit = 1 → pin is OUTPUT. CPU writes to `IO0SET`/`IO0CLR` to control.
- `IO0DIR` bit = 0 → pin is INPUT. External (simulated) stimulus drives `IO0PIN`.
- Output pins drive connected peripheral models.
- Input pins read from peripheral models (switch state, keypad column, etc.).

**Board Render:**
- Each of the 32 PORT0 pins + 16 PORT1 pins shown as colored dots along the LPC2148 IC edges.
- Direction: INPUT = white outline, OUTPUT = filled.
- State: HIGH = cyan glow, LOW = dim.
- Click on a PIN (when configured as INPUT) to manually toggle it (for testing without peripherals).

### 9.5 UART Peripheral

**LPC2148 UART0 Registers:**

| Register | Address | Description |
|----------|---------|-------------|
| U0RBR | 0xE000C000 | Receive Buffer Register (read) |
| U0THR | 0xE000C000 | Transmit Holding Register (write) |
| U0DLL | 0xE000C000 | Divisor Latch Low (DLAB=1) |
| U0DLM | 0xE000C004 | Divisor Latch High (DLAB=1) |
| U0IER | 0xE000C004 | Interrupt Enable Register |
| U0IIR | 0xE000C008 | Interrupt ID Register (read) |
| U0FCR | 0xE000C008 | FIFO Control Register (write) |
| U0LCR | 0xE000C00C | Line Control Register |
| U0LSR | 0xE000C014 | Line Status Register |
| U0SCR | 0xE000C01C | Scratch Pad Register |

**Baud Rate Calculation:**
```
Baud = PCLK / (16 × (256×DLM + DLL) × (1 + DivAddVal/MulVal))
```

**Simulation:**
- TX: when CPU writes to `U0THR`, enqueue byte in TX ring buffer → display in Serial Monitor.
- RX: when user types in Serial Monitor, enqueue bytes in RX ring buffer → CPU reads from `U0RBR`.
- LSR.THRE bit reflects TX buffer empty state.
- UART1 on P0.8/P0.9 — same model, different base address `0xE0010000`.
- Raise UART RX interrupt when RX buffer non-empty (if IER.RBR_IE set).

**Serial Monitor UI:**
- Monospace terminal panel (bottom tab).
- Output pane: shows bytes sent by CPU (auto-detect ASCII vs hex).
- Input pane: type to send to CPU RX.
- Baud rate display (computed from DLL/DLM).
- Newline mode selector: LF / CRLF / CR.
- Clear button.
- Optional: binary/hex view toggle.
- Show timestamps per line (simulation cycle count).

### 9.6 I2C Peripheral

**LPC2148 I2C0 Registers (base: 0xE001C000):**

| Register | Offset | Description |
|----------|--------|-------------|
| I2C0CONSET | 0x00 | Control Set Register |
| I2C0STAT | 0x04 | Status Register |
| I2C0DAT | 0x08 | Data Register |
| I2C0ADR | 0x0C | Slave Address Register |
| I2C0SCLH | 0x10 | SCL Duty Cycle High |
| I2C0SCLL | 0x14 | SCL Duty Cycle Low |
| I2C0CONCLR | 0x18 | Control Clear Register |

**Simulation:**
- State machine: IDLE → START → ADDRESS → ACK → DATA → ACK → STOP.
- Status codes per LPC2148 I2C state machine (0x08=START sent, 0x18=SLA+W sent, etc.).
- External I2C device models can be registered (e.g., simulated AT24C02 EEPROM, PCF8574 I/O expander).
- I2C activity visible in Logic Analyzer panel (SDA + SCL traces).

### 9.7 SPI Peripheral

**LPC2148 SPI0 Registers (base: 0xE0020000):**

| Register | Offset | Description |
|----------|--------|-------------|
| S0SPCR | 0x00 | Control Register |
| S0SPSR | 0x04 | Status Register |
| S0SPDR | 0x08 | Data Register |
| S0SPCCR | 0x0C | Clock Counter Register |
| S0SPINT | 0x1C | Interrupt Register |

**Simulation:**
- Full-duplex SPI: when CPU writes `S0SPDR`, simulate MOSI byte transfer and capture MISO.
- External SPI device models: simulated SD card (stub), SPI display (stub).
- SPI clock frequency derived from `S0SPCCR`.
- Raise SPI interrupt when transfer complete (if enabled).

### 9.8 ADC Peripheral

**LPC2148 ADC1 Registers (base: 0xE0034000):**

| Register | Offset | Description |
|----------|--------|-------------|
| AD1CR | 0x00 | A/D Control Register |
| AD1GDR | 0x04 | A/D Global Data Register |
| AD1STAT | 0x30 | A/D Status Register |

**Channels:**
- AD1.2 (P0.29) — LDR (Light Dependent Resistor)
- AD1.3 (P0.30) — LM35 Temperature Sensor
- AD1.4 (P0.31) — Potentiometer / Joystick

**Simulation:**
- Each ADC channel has a **virtual input slider** on the board UI.
- LDR slider: 0 (dark) to 4095 (bright light) — shows a sun/moon icon.
- LM35 slider: temperature 0°C to 100°C — shows thermometer icon.
- Potentiometer: rotary knob SVG (draggable 0°–270°), maps to 0–4095.
- Joystick: 2-axis draggable circle, maps X/Y to two ADC channels.
- ADC result = (slider_value / 100%) × 1023 (10-bit) when START bit set.
- Conversion delay: simulate ~2.5 µs (configurable cycles).
- Burst mode: continuous conversion, update GDR after each conversion.
- Raise ADC interrupt when DONE bit set (if IE bit in CR).

### 9.9 DAC Peripheral

**LPC2148 DAC Registers:**

| Register | Address | Description |
|----------|---------|-------------|
| DACR | 0xE006C000 | D/A Converter Register |

**DACR bits:**
- [15:6] VALUE — 10-bit DAC value (0–1023 maps to 0–3.3V)
- [16] BIAS — Power/speed tradeoff

**Simulation:**
- When CPU writes DACR, compute voltage: `V = (VALUE / 1023) × 3.3`.
- Feed voltage to the **DAC output signal** visible in the Oscilloscope.
- DAC connector on board shows live voltage readout.
- The oscilloscope auto-connects to DAC output trace by default.

### 9.10 PWM Controller

**LPC2148 PWM Registers (base: 0xE0014000):**

| Register | Offset | Description |
|----------|--------|-------------|
| PWMIR | 0x00 | Interrupt Register |
| PWMTCR | 0x04 | Timer Control Register |
| PWMTC | 0x08 | Timer Counter |
| PWMPR | 0x0C | Prescale Register |
| PWMPC | 0x10 | Prescale Counter |
| PWMMCR | 0x14 | Match Control Register |
| PWMMR0-6 | 0x18–0x30 | Match Registers 0–6 |
| PWMPCR | 0x4C | PWM Control Register |
| PWMLER | 0x50 | Latch Enable Register |

**PWM Channels (on LPC2148):**
- PWM1–PWM6 (6 single-edge channels)
- PWM1 period set by MR0
- PWM4 = P0.21 (Servo 1)
- PWM5 = P0.22 (Servo 2)
- PWM6 = P0.9 (DC Motor Speed)

**Simulation:**
- Compute duty cycle: `duty% = (MRx / MR0) × 100`
- DC Motor speed = proportional to PWM6 duty cycle.
- Servo angle: `angle = ((duty% - 5) / 10) × 180°` (standard servo mapping: 5–10% duty = 0°–180°)
- PWM waveform visible in Oscilloscope panel.
- Oscilloscope PWM channel: shows rectangular wave at correct frequency and duty cycle.

### 9.11 Timer/Counter

**LPC2148 Timer0 Registers (base: 0xE0004000):**

| Register | Offset | Description |
|----------|--------|-------------|
| T0IR | 0x00 | Interrupt Register |
| T0TCR | 0x04 | Timer Control Register |
| T0TC | 0x08 | Timer Counter (read-only) |
| T0PR | 0x0C | Prescale Register |
| T0PC | 0x10 | Prescale Counter |
| T0MCR | 0x14 | Match Control Register |
| T0MR0-3 | 0x18–0x24 | Match Registers 0–3 |
| T0CCR | 0x28 | Capture Control Register |
| T0CR0-3 | 0x2C–0x38 | Capture Registers 0–3 |
| T0EMR | 0x3C | External Match Register |

**Timer1 base:** `0xE0008000` — same layout.

**Simulation:**
- Timer counter increments every PCLK/(PR+1) cycles.
- On match: set interrupt flag, optionally reset TC (MR_R), optionally trigger interrupt (MR_I).
- MR_S: stop timer on match.
- Capture: sample TC on rising/falling edge of external pin (stub for simulation).
- Raise TIMER0/1 interrupt when match interrupt enabled.
- Visible in Debug panel: T0TC live value, match register values.

### 9.12 Interrupt Controller (VIC)

**LPC2148 VIC Registers (base: 0xFFFFF000):**

| Register | Offset | Description |
|----------|--------|-------------|
| VICIRQStatus | 0x000 | IRQ Status |
| VICFIQStatus | 0x004 | FIQ Status |
| VICRawIntr | 0x008 | Raw Interrupt Status |
| VICIntSelect | 0x00C | IRQ/FIQ Select |
| VICIntEnable | 0x010 | Interrupt Enable |
| VICIntEnClr | 0x014 | Enable Clear |
| VICSoftInt | 0x018 | Software Interrupt |
| VICSoftIntClear | 0x01C | Software Interrupt Clear |
| VICProtection | 0x020 | Protection Enable |
| VICVectAddr | 0x030 | Vector Address Register |
| VICDefVectAddr | 0x034 | Default Vector Address |
| VICVectAddr0-15 | 0x100–0x13C | Vector Addresses |
| VICVectCntl0-15 | 0x200–0x23C | Vector Controls |

**LPC2148 Interrupt Sources (key ones):**

| Slot | Source |
|------|--------|
| 0 | WDT |
| 1 | Reserved |
| 2 | ARM Core |
| 3 | ARM Core |
| 4 | Timer0 |
| 5 | Timer1 |
| 6 | UART0 |
| 7 | UART1 |
| 8 | PWM |
| 9 | I2C0 |
| 10 | SPI0 |
| 11 | SPI1 / SSP |
| 12 | PLL |
| 13 | RTC |
| 14 | EINT0 |
| 15 | EINT1 |
| 16 | EINT2 |
| 17 | EINT3 |
| 18 | ADC0 |
| 19 | I2C1 |
| 20 | BOD |
| 21 | ADC1 |
| 22 | USB |

**VIC Simulation Logic:**
- On each tick: check all enabled interrupt sources.
- If IRQ pending and CPSR.I = 0: save state, enter IRQ mode, jump to VICVectAddr.
- Vectored interrupt: find highest-priority enabled vectored slot, set VICVectAddr.
- Non-vectored: jump to VICDefVectAddr.
- On IRQ return (`SUBS PC, LR, #4`): restore CPSR, return to interrupted address.
- VIC panel in debug UI shows all 32 slots, their enable/disable, and pending status.

### 9.13 LCD Display Emulator (20×4 Alphanumeric)

**Hardware Configuration (from board image):**
- Mode: 4-bit data bus
- Data: P0.16 (D4), P0.17 (D5), P0.18 (D6), P0.19 (D7)
- RS: P0.20 (Register Select: 0=command, 1=data)
- EN: P1.25 (Enable pulse triggers operation)
- RW: GND (write-only)

**HD44780 Command Emulation:**

| Command | Code | Description |
|---------|------|-------------|
| Clear Display | 0x01 | Clear all chars, return home |
| Return Home | 0x02 | Move cursor to 0,0 |
| Entry Mode | 0x04–0x07 | Cursor direction, shift |
| Display ON/OFF | 0x08–0x0F | Display, cursor, blink |
| Cursor Shift | 0x10–0x1F | Move cursor or shift display |
| Function Set | 0x20–0x3F | 4/8-bit, 1/2-line, 5×8/5×11 |
| Set CGRAM Addr | 0x40–0x7F | Custom char address |
| Set DDRAM Addr | 0x80–0xFF | Set cursor position |

**DDRAM Address Mapping:**
```
Line 0: 0x00–0x13 (positions 0–19)
Line 1: 0x40–0x53 (positions 64–83)
Line 2: 0x14–0x27 (positions 20–39)
Line 3: 0x54–0x67 (positions 84–103)
```

**LCD UI Component `<LCDDisplay />`:**
- 20 columns × 4 rows of character cells.
- Each cell: monospace character, `14×24px`, with `#9FE2BF` green text on `#0d1a0d` dark green background.
- Pixel-font rendering: use a 5×8 dot-matrix font (render each character as a small bitmap grid for authenticity).
- Cursor blink: when cursor enabled, flash at ~500ms cycle.
- Custom chars (CGRAM): store up to 8 custom 5×8 bitmaps; render when char code 0–7 written.
- Backlight toggle: click on LCD to toggle backlight (glow effect).

**GPIO Monitoring:**
- Simulate EN pulse detection: monitor P1.25 rising then falling edge.
- On falling edge of EN: if RS=0, process command. If RS=1, write char to DDRAM.
- Handle 4-bit mode: accumulate two nibbles before processing.

### 9.14 Seven-Segment Display Emulator

**Hardware (from board image):**
- 5 digits, shift-register driven
- DATA: P0.19, CLK: P0.20, STROBE: P0.30

**Simulation:**
- Monitor P0.19, P0.20, P0.30 GPIO states.
- On CLK rising edge: shift DATA bit into serial register.
- On STROBE pulse: latch 5×8 bits (40 bits total) into display buffer.
- Each byte maps to one digit's segment pattern (a,b,c,d,e,f,g,dp).

**7-Seg UI Component `<SevenSegDisplay />`:**
- 5 standard 7-segment digit displays in a row.
- SVG-rendered segments: `a` (top), `b` (top-right), `c` (bottom-right), `d` (bottom), `e` (bottom-left), `f` (top-left), `g` (middle).
- Active segments: `#ff6600` (orange-red LED color) with glow.
- Inactive segments: `#1a0800` (very dim amber).
- Decimal point (dp) per digit.
- Optional: decimal number overlay (show decoded value below display).

### 9.15 Matrix Keypad Emulator

**Hardware (from board image):**
- 4×4 keypad
- Rows (OUTPUT from CPU): P0.16, P0.17, P0.18, P0.19
- Columns (INPUT to CPU): P1.16, P1.17, P1.18, P1.19

**Scan Logic:**
- CPU drives one ROW LOW at a time, reads COLUMNS.
- If a key is pressed at intersection, that COLUMN reads LOW.
- Keypad UI intercepts this: when user presses UI key, set corresponding column pin LOW only when the row pin for that key is LOW.

**Keypad UI Component `<MatrixKeypad />`:**
- 4×4 grid of buttons: `0–9, A–F`.
- Each button: `48×48px`, rounded, with neon-green label.
- Press style: `scale(0.95)` + green glow.
- Key labels (from board image, top-to-bottom, left-to-right):
  ```
  0  1  2  3
  4  5  6  7
  8  9  A  B
  C  D  E  F
  ```
- Keyboard shortcut: physical keyboard keys `0–9`, `A–F` press the corresponding virtual key.

### 9.16 Logic Controller (8 LEDs + 8 Switches)

**Hardware:**
- 8 LEDs on PORT0/PORT1 (driven by CPU output pins)
- 8 Switches (drive CPU input pins, pull-up by default = HIGH, pressed = LOW)
- Buzzer (digital GPIO, connected through transistor)

**LED Component `<LEDArray count=8 />`:**
- Each LED: 16px circle.
- OFF: `#1a0a0a` dark red, no glow.
- ON (GREEN): `#39ff14` with `drop-shadow(0 0 8px #39ff14)`.
- ON (RED): `#ff4136` with `drop-shadow(0 0 8px #ff4136)`.
- ON (AMBER): `#ffb300` with glow.
- Configurable color per LED.
- Label below each LED showing pin number.

**Switch Component `<SwitchArray count=8 />`:**
- Each switch: toggle slider, or momentary push button (configurable).
- State: UP = HIGH (pull-up), DOWN = LOW (pressed).
- Visual: small rectangular physical switch SVG with toggle animation.
- Keyboard shortcut: `1–8` keys to toggle switches 1–8.

**Buzzer Component `<Buzzer />`:**
- When buzzer pin goes HIGH: play a square wave tone via `AudioContext`.
- Frequency: configurable (default 2kHz).
- PWM-driven buzzer: frequency derived from PWM period, play accordingly.
- UI: small buzzer SVG icon that vibrates (CSS shake animation) when active.
- Mute button.

### 9.17 Stepper Motor Emulator

**Hardware:**
- Two steppers, ULN2803 Darlington driver
- Coils driven by P0.16–P0.19 (Stepper 1) and P0.20–P0.24 (Stepper 2)

**Step Sequence Detection:**
- Monitor 4 GPIO pins for step patterns.
- Full-step: `1000 → 0100 → 0010 → 0001 → ...` (detects CW or CCW).
- Half-step: 8-step sequence.
- Wave drive: single coil at a time.

**Stepper Motor UI `<StepperMotor id=1|2 />`:**
- SVG top-down view of a stepper motor (circular body with shaft).
- Shaft rotates by `step_angle` per step (1.8° for 200-step motor, 7.5° for 48-step).
- Step angle configurable.
- Step count display.
- Direction indicator (CW / CCW) with arrow.
- Speed: derive from time between steps → show RPM.
- Coil state: 4 small indicator dots showing which coil is active.

### 9.18 DC Motor Emulator

**Hardware:**
- DRV8801 driver IC
- DIR: P0.28 (GPIO)
- Speed (PWM6): P0.9

**Simulation:**
- Speed = PWM6 duty cycle (0–100%).
- Direction: P0.28 HIGH = CW, LOW = CCW.

**DC Motor UI `<DCMotor />`:**
- SVG motor body with rotating shaft disk.
- Rotation speed: `animation-duration = map(speed%, 0–100, 2s–0.1s)`.
- Direction: CW or CCW `rotate` transform.
- Speed percentage display.
- Current (simulated): `I = (speed% / 100) × 1.5A` — display as a gauge.
- Direction arrow overlay.

### 9.19 Servo Motor Emulator

**Hardware:**
- Servo 1: PWM4 (P0.21)
- Servo 2: PWM5 (P0.22)
- Standard servo: 1ms pulse = 0°, 2ms pulse = 180°, period = 20ms

**Simulation:**
- Read PWM match registers for PWM4/PWM5.
- Compute pulse width from duty cycle.
- Map to angle: `angle = ((pulse_ms - 1.0) / 1.0) × 180`
- Clamp to 0°–180°.

**Servo UI `<ServoMotor id=1|2 />`:**
- SVG servo body with a rotating arm/horn.
- Arm animates to exact angle with smooth `transition: transform 0.3s ease`.
- Angle display in degrees.
- Pulse width display in ms.
- Min/max angle indicators (0° and 180° marks).

### 9.20 Buzzer Emulator

See Section 9.16. Additional detail:

**Tone generation:**
```typescript
function playBuzzer(frequency: number, volume: number) {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume * 0.1, ctx.currentTime);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  return () => osc.stop(); // return cleanup
}
```

- When buzzer GPIO goes HIGH → start oscillator.
- When GPIO goes LOW → stop oscillator.
- If driven by PWM → use PWM frequency as oscillator frequency.

### 9.21 Elevator Interface

**Hardware:**
- Floor call buttons: GPIO P0.16–P0.19, P0.20–P0.23
- Floor indicators: LED array on PORT1
- Motor relay → DC Motor interface

**Elevator UI `<ElevatorInterface />`:**
- Vertical elevator shaft SVG on the right of the board.
- Elevator car rectangle that moves up/down based on motor direction and speed.
- Floor buttons (3–4 floors) as call buttons.
- Floor indicator lights (LEDs) showing current floor.
- Door open/close animation (two panels slide apart/together).
- This is used specifically for the "Elevator Control" lab program common in RVCE.

### 9.22 Oscilloscope (Virtual)

**Purpose:** Visualize analog and digital signals over time. The primary tool for understanding ADC, DAC, PWM, and GPIO behavior.

**UI Component `<Oscilloscope />`:**

**Layout:**
- Full-width panel in bottom tab area.
- Time axis (X): configurable timebase (50µs/div to 1s/div, 10 divisions).
- Voltage axis (Y): 0–3.3V or -3.3V–3.3V, configurable scale.
- Up to 4 simultaneous channels.

**Channels:**
- CH1: DAC output (P0.25 / AOUT) — auto-connected
- CH2: PWM output (selectable: PWM1–PWM6)
- CH3: GPIO pin (any pin, user-selectable)
- CH4: GPIO pin (any pin, user-selectable)

**Rendering:**
- Use **PixiJS 8** for hardware-accelerated canvas rendering.
- Ring buffer: store last N samples (N = timebase × sample rate).
- Sample rate: match simulation cycle rate (interpolated to screen pixels).
- Waveform colors: CH1=cyan, CH2=yellow, CH3=green, CH4=purple.
- Grid: subtle 10×8 grid (10 time divs × 8 voltage divs).
- Trigger: rising/falling edge trigger on any channel. Stabilizes waveform display.
- Measurements panel: auto-measure frequency, period, duty cycle, Vpp, Vavg, Vrms.

**Controls:**
- Timebase: rotary selector (50µs, 100µs, 500µs, 1ms, 5ms, 10ms, 50ms, 100ms, 500ms, 1s per division).
- Voltage scale: V/div (0.1, 0.5, 1.0, 2.0 V/div).
- Position offset per channel (vertical shift).
- Run/Stop toggle.
- Single capture mode.
- Export waveform as PNG.

**Oscilloscope visual theme:**
- Classic dark green phosphor: `#001a00` background, `#00ff41` grid lines at 15% opacity.
- OR switch to modern dark: `#0a0e14` background, `#1e2a3a` grid.
- Toggle: "Phosphor mode" button.

### 9.23 Keil uVision 5 Debug Interface

**Purpose:** Mirror the experience of Keil uVision 5 debugging for familiarity. Students who know Keil should feel immediately at home.

**Debug Toolbar:**
```
[▶ Run F5]  [⏸ Pause]  [⏹ Stop]  [↓ Step Into F11]  [→ Step Over F10]
[↑ Step Out Shift+F11]  [⚡ Run to Cursor]  [⏱ Timing Info]
```

**Register Window:**
```
┌─────────────────────────────────────────────────────┐
│ REGISTERS                              [auto-refresh] │
├────────────┬────────────┬──────────────────────────  │
│ R0  00000000│ R8  00000000│ MSP   40008000             │
│ R1  00000000│ R9  00000000│ PSP   00000000             │
│ R2  00000000│ R10 00000000│ CPSR  600000D3             │
│ R3  00000000│ R11 00000000│  N=0 Z=0 C=0 V=0          │
│ R4  00000000│ R12 00000000│  I=1 F=0 T=0              │
│ R5  00000000│ SP  40007F00│  Mode: Supervisor          │
│ R6  00000000│ LR  FFFFFFFF│                            │
│ R7  00000000│ PC  00000000│                            │
└─────────────┴────────────┴──────────────────────────  │
```
- Changed registers flash amber for 200ms.
- Click any register value to edit it (write-back to CPU state).
- Show CPSR decoded: individual flag bits.

**Disassembler Window:**
- Show 20 instructions centered on current PC.
- Current instruction: highlighted in cyan background.
- Format: `[Address]  [Opcode hex]  [Mnemonic]  [Operands]  [Comment]`
- Example: `00000080  E3A00005  MOV R0, #5       ; Set counter`
- If ELF loaded: show function name above each function start.
- Click any address: set/unset breakpoint (red dot in left margin).
- Double-click address: "Run to here."

**Memory Window:**
- 4 independent memory view panels (like Keil's Memory 1–4).
- Each: 16 bytes per row.
- Format: `[Address]  [Hex×16]  [ASCII]`
- Live: updates every simulation step.
- Input address bar with expressions (e.g., `0x40000000`, `&myVariable`).
- "Find" button for byte pattern search.

**Watch Window:**
- User adds variable names (from ELF symbol table) or addresses.
- Shows: name, address, type (if ELF available), current value (hex + decimal).
- Supports array display and struct member drill-down (if DWARF info available).

**Call Stack Window:**
- Shows current call stack by unwinding LR chain.
- Format: `Frame 0: main() at main.c:42`
- Clickable frames to navigate to that address in disassembler.

**Breakpoints Window:**
- List of all breakpoints.
- Enable/disable checkbox.
- Condition: add expression-based conditional breakpoints.
- Hit count: track how many times each BP was hit.

**Peripheral Registers Window:**
- Tree view of all peripheral register groups (GPIO, UART, Timer, PWM, ADC, etc.).
- Expand to see individual register names, addresses, current values.
- Values update live.
- Click any field to edit.
- Bitfield decoder: shows bit-by-bit meaning (e.g., CPSR mode bits).

### 9.24 Register Inspector & Memory Viewer

Covered in Section 9.23. Standalone use:

**Quick Register Inspector `<RegisterInspector />`:**
- In the right debug panel (always visible).
- Compact mode: shows R0–R15, PC, SP, LR, CPSR in a 2-column table.
- Toggle: expanded mode (shows all modes' banked registers).

### 9.25 Serial Monitor (UART Terminal)

See Section 9.5. Additional UI requirements:

**Terminal emulation:**
- Support ANSI escape codes (color codes for boards that send colored output).
- Auto-scroll to bottom (with "pause scroll" button).
- Timestamps: show cycle count or simulated time.
- Export log to `.txt` file.
- Send file: upload a text file and send its bytes over RX.

### 9.26 Peripheral Wiring Canvas (External Peripherals)

**Purpose:** Add external components not on the RV-IoT board (sensors, displays, modules) and wire them to exposed headers.

**UI `<WiringCanvas />`:**
- Side panel or bottom tab: "External Peripherals".
- Palette of available external components:
  - Generic LED (single)
  - Push button
  - Potentiometer
  - LDR (light sensor)
  - LM35 (temperature sensor)
  - Ultrasonic sensor (HC-SR04) — triggers/echo pins
  - DHT11 (temperature + humidity, single-wire protocol)
  - AT24C02 EEPROM (I2C)
  - PCF8574 I/O Expander (I2C)
  - SSD1306 OLED Display (I2C)
  - HC-05 Bluetooth Module (UART)
  - Generic IR Receiver
  - Relay module
  - Voltage divider
  - Logic gates (AND, OR, NOT — for combinational experiments)

**Wiring Mechanism:**
- Drag a component from palette onto canvas.
- Click a component pin → drag wire → click an LPC2148 exposed header pin.
- Wire routing: orthogonal routing (like Proteus) or free bezier curve.
- Wire colors: VCC=red, GND=black, signal=user-selected color.
- Delete wire: click wire → Delete key.
- Component configuration: click component → property panel (e.g., LED color, resistor value, sensor range).

**External Component Simulation:**
- Once wired, the external component registers itself with the peripheral bus on the connected pins.
- It responds to GPIO reads/writes just like on-board peripherals.
- Example: wired LED → turn on when GPIO OUTPUT goes HIGH.

---

## 10. Board 2D/3D Render Specification

### 10.1 2D Board Render (Primary — Phase 1)

The center panel renders the RV-IoT board as a detailed 2D SVG/React composition.

**Board Zones (from image, laid out spatially):**

```
┌─────────────────────────────────────────────────────────────────┐
│  [SERIAL PORTS]    [7-SEG DISPLAY]              [RV ARM BOARD]  │
│  UART/I2C/SPI      P0.19/P0.20/P0.30                            │
│                                                                   │
│  [20×4 LCD]                            [STEPPER MOTOR 1&2]      │
│  P0.16-P0.19,RS=P0.20,EN=P1.25        P0.16-P0.19,P0.20-P0.24 │
│                                                                   │
│  [ANALOG INPUTS]    [LPC 2148]         [DC MOTOR]               │
│  AD1.2/AD1.3/AD1.4  NXP ARM7          P0.28(DIR), P0.9(PWM6)  │
│  (LDR/LM35/POT/JOY) 32-BIT CORE                                 │
│                                         [SERVO 1&2]              │
│  [DAC CONNECTOR]   [MATRIX KEYPAD]      PWM4/PWM5               │
│  P0.25 AOUT         ROWS P0.16-P0.19                            │
│  SIG/GND            COLS P1.16-P1.19    [ELEVATOR]              │
│                                          P0.16-P0.23            │
│  [BUZZER]                                                         │
│  P0.16-P0.19                                                     │
│                                                                   │
│  [LOGIC CONTROLLER]                                              │
│  8 LEDs + 8 Switches                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Rendering Details:**

1. **PCB Background:** Dark forest green (`#0d1a10`) with a SVG noise texture.
2. **LPC2148 IC (center):** 64-pin LQFP package. Large rectangle with pin stubs on all 4 sides. Show port labels (P0.0, P0.1... P0.31 on one side, P1.16... P1.31 on another). Current pin state shown by color.
3. **Each Peripheral Zone:** Has a rectangular boundary with a header label (e.g., "SERIAL PORTS" in red like the original board markings). Internal component graphics.
4. **Copper traces:** Show key traces (e.g., LCD data bus from MCU to LCD) as thin amber lines.
5. **DIP IC packages:** ULN2803 (18 pins), DRV8801 (shown as small rectangle with label).
6. **Connectors/Headers:** Shown as rows of square pads.

**Board Pan & Zoom:**
- Mouse wheel to zoom (50%–400%).
- Click + drag to pan.
- Double-click a peripheral zone to "zoom into" it (smooth animation, full panel view).
- "Fit to screen" button resets view.
- Minimap in bottom-right corner showing current viewport position.

### 10.2 3D Board Render (Phase 2 — Three.js)

**Tech:** Three.js r158, custom GLTF model of the board.

**Features:**
- Photorealistic PCB material (green/blue PCB with solder mask texture).
- 3D component models: DIP ICs, resistors, capacitors, headers.
- LED point lights: when LED is HIGH, add a `PointLight` above it.
- LCD panel: flat rectangle with `CanvasTexture` fed from the LCD simulator.
- Camera: orbit controls (rotate, zoom, pan).
- Toggle between 2D and 3D with smooth crossfade.
- Component hover: highlight hovered component, show tooltip with name and pin state.

**Performance:** Three.js scene runs in a separate `<canvas>` with `requestAnimationFrame`, fed state updates from the simulation store. Do not block the simulation loop with render.

---

## 11. State Management Architecture

### 11.1 Zustand Store Structure

```typescript
// store/simulatorStore.ts
interface SimulatorState {
  // CPU State
  cpu: {
    registers: Uint32Array;    // R0–R15 + CPSR + SPSR
    pc: number;
    cpsr: number;
    mode: CPUMode;
    halted: boolean;
    cycles: number;
  };

  // Memory
  memory: {
    flash: Uint8Array;         // 512 KB
    sram: Uint8Array;          // 32 KB
  };

  // GPIO State
  gpio: {
    port0: {
      pin: number;             // IO0PIN — current pin values
      dir: number;             // IO0DIR — direction (1=output)
      set: number;             // pending SET (write-only)
      clr: number;             // pending CLR (write-only)
    };
    port1: {
      pin: number;
      dir: number;
      set: number;
      clr: number;
    };
  };

  // Peripheral States
  peripherals: {
    uart0: UARTState;
    uart1: UARTState;
    i2c0: I2CState;
    spi0: SPIState;
    timer0: TimerState;
    timer1: TimerState;
    pwm: PWMState;
    adc1: ADCState;
    dac: DACState;
    vic: VICState;
    rtc: RTCState;
  };

  // Board Peripheral UI State
  board: {
    leds: boolean[];           // 8 LEDs
    switches: boolean[];       // 8 Switches
    keypad: boolean[][];       // 4×4 key states
    lcd: LCDState;
    sevenSeg: SevenSegState;
    buzzerActive: boolean;
    buzzerFrequency: number;
    adcInputs: number[];       // 0–1023, per channel
    dacOutput: number;         // 0–3.3V
    dcMotor: DCMotorState;
    servo: ServoState[];
    stepper: StepperState[];
  };

  // Simulation Control
  sim: {
    status: 'idle' | 'running' | 'paused' | 'error' | 'breakpoint';
    speed: 0.25 | 0.5 | 1 | 2 | 10 | 'max';
    breakpoints: Set<number>;
    watchpoints: Watchpoint[];
    hexLoaded: boolean;
    hexFilename: string;
    entryPoint: number;
  };

  // Oscilloscope
  oscilloscope: {
    channels: OscChannel[];
    timebase: number;          // µs per division
    sampleBuffer: Float32Array[];
    running: boolean;
    trigger: TriggerConfig;
  };

  // Debug
  debug: {
    disassembly: DisasmLine[];
    callStack: StackFrame[];
    watchVariables: WatchVar[];
    selectedMemoryAddress: number;
    symbolTable: Map<number, string>;
  };
}
```

### 11.2 Actions

Key Zustand actions:

```typescript
interface SimulatorActions {
  loadHex(hexText: string, filename: string): void;
  reset(): void;
  run(): void;
  pause(): void;
  stop(): void;
  stepInto(): void;
  stepOver(): void;
  stepOut(): void;
  setBreakpoint(address: number): void;
  removeBreakpoint(address: number): void;
  setSpeed(speed: SimSpeed): void;
  writeGPIO(port: 0|1, pin: number, value: boolean): void;
  pressKey(row: number, col: number): void;
  releaseKey(row: number, col: number): void;
  setADCInput(channel: number, value: number): void;
  toggleSwitch(index: number): void;
  addWatchVariable(name: string, address: number): void;
  setMemoryView(address: number): void;
}
```

### 11.3 Peripheral Bus (MMIO)

```typescript
// peripheralBus.ts
interface PeripheralDevice {
  baseAddress: number;
  size: number;
  read(offset: number, size: 8 | 16 | 32): number;
  write(offset: number, value: number, size: 8 | 16 | 32): void;
  tick(cycles: number): void;      // called each simulation tick
}

class PeripheralBus {
  private devices: PeripheralDevice[] = [];

  register(device: PeripheralDevice): void;
  read32(address: number): number;
  read16(address: number): number;
  read8(address: number): number;
  write32(address: number, value: number): void;
  write16(address: number, value: number): void;
  write8(address: number, value: number): void;
  tickAll(cycles: number): void;
}
```

---

## 12. File I/O & Session Persistence

### 12.1 Hex File Import

- Accept: `.hex`, `.elf`, `.bin` via `<input type="file">` or drag-and-drop.
- Parse in-browser (no server needed).
- Validate: Intel HEX checksum, address range, ELF magic bytes.
- On success: flash memory updated, CPU reset, session filename shown in toolbar.

### 12.2 Session Save/Load (IndexedDB)

```typescript
interface SimSession {
  id: string;
  name: string;
  createdAt: Date;
  hexData: ArrayBuffer;
  hexFilename: string;
  boardState: Partial<SimulatorState['board']>;
  breakpoints: number[];
  watchVariables: WatchVar[];
  oscilloscopeConfig: OscConfig;
  wiringCanvas: WiringState;
}
```

- "Save Session" → stores full session to IndexedDB.
- "Load Session" → restores board state and hex.
- "Sessions" panel: list saved sessions with timestamp and hex filename.
- Export session as `.loki-sim` JSON file (download).
- Import `.loki-sim` file (upload).

### 12.3 Export / Screenshot

- "Screenshot Board" → export board canvas as PNG (via `html2canvas` or native Canvas API).
- "Export Oscilloscope" → export waveform as PNG or CSV.
- "Export Serial Log" → download as `.txt`.

---

## 13. Design Taste Frontend Integration

> This section tells Claude Code exactly how to use the `/design-taste-frontend` skill during implementation.

### 13.1 Design Read

**"Reading this as: technical engineering simulation IDE for CS students and electronics engineers, with a Dark Tech / Hacker IDE aesthetic, leaning toward dark zinc/slate base + neon cyan/green accent + monospace-heavy data display + high density."**

### 13.2 Dial Values

```
DESIGN_VARIANCE: 7     (structured panels, but distinctive non-generic look)
MOTION_INTENSITY: 6    (LED glows, scope traces, register flash — all motivated)
VISUAL_DENSITY: 8      (this is a cockpit — maximum data, minimum decoration)
```

### 13.3 Font Usage

```
Display:    Geist (weights 400, 500, 600)
Monospace:  Geist Mono (register values, hex addresses, disassembler, serial terminal)
Install:    next/font with Google Fonts subset
```

### 13.4 Anti-Default Rules (enforce these)

- No Inter font (use Geist).
- No AI-purple gradients.
- No centered hero sections.
- No generic glassmorphism on everything (use it ONLY for tooltip overlays and modal backdrops).
- No boring card shadows — use `border` + subtle inner glow instead.
- No emoji in UI (use Phosphor icons).
- No generic loading spinners — use layout-shaped skeleton loaders.
- Buttons: tactile, `-translate-y-[1px]` on `:active`.
- One accent color: **Cyan `#00d4ff`**. Everything else is Zinc/Slate.

### 13.5 Component Conventions

```typescript
// All buttons use this base class
const btnBase = "
  px-3 py-1.5 rounded text-sm font-medium
  border border-zinc-700 bg-zinc-800
  text-zinc-200 hover:bg-zinc-700
  active:-translate-y-px transition-transform
  focus-visible:outline-none focus-visible:ring-2 
  focus-visible:ring-cyan-400/50
";

// Accent (primary action) buttons
const btnAccent = `${btnBase}
  bg-cyan-500/20 border-cyan-500/40 text-cyan-300
  hover:bg-cyan-500/30
`;

// Danger (stop, reset) buttons
const btnDanger = `${btnBase}
  bg-red-500/20 border-red-500/40 text-red-300
  hover:bg-red-500/30
`;

// Panel headers
const panelHeader = "
  text-xs font-semibold uppercase tracking-widest
  text-zinc-400 border-b border-zinc-800 pb-2 mb-3
";

// Register value cells
const regValue = "
  font-mono text-sm text-emerald-400
  tabular-nums
";
```

### 13.6 Motion Rules (LOKI-SIM specific)

| Animation | Trigger | Implementation | Justification |
|-----------|---------|----------------|---------------|
| LED ON | GPIO pin goes HIGH | `keyframes: { boxShadow: '0 0 0px → 0 0 12px #39ff14' }` | Communicates signal state |
| Register flash | Register value changes | `background: amber → transparent 200ms` | Shows register was modified |
| Scope trace | Each simulation tick | PixiJS line append | Real-time waveform |
| Panel tab switch | User clicks tab | `AnimatePresence + slide-in 150ms` | Smooth orientation |
| Breakpoint hit | PC == breakpoint address | Full-screen red flash 300ms + pause | Critical state change |
| Motor rotation | PWM duty cycle > 0 | CSS `rotate` animation speed from duty% | Motor is running |
| Keypad press | User click | `scale(0.95)` + green glow 100ms | Tactile feedback |
| Hex upload | File dropped | Board fade-in + reset animation | Program loaded |

---

## 14. Folder & File Structure

```
loki-sim/
├── app/                           # Next.js App Router
│   ├── layout.tsx                 # Root layout, fonts, providers
│   ├── page.tsx                   # Main simulator page
│   ├── globals.css                # CSS variables, base styles
│   └── providers.tsx              # Zustand, theme providers (client)
│
├── components/
│   ├── board/                     # Board render components
│   │   ├── BoardCanvas.tsx        # Main board SVG container
│   │   ├── LPC2148IC.tsx          # MCU chip render with pins
│   │   ├── PCBBackground.tsx      # Board texture and traces
│   │   ├── PinIndicator.tsx       # Individual pin state dot
│   │   └── zones/                 # Peripheral zone components
│   │       ├── SerialPortZone.tsx
│   │       ├── LCDZone.tsx
│   │       ├── SevenSegZone.tsx
│   │       ├── KeypadZone.tsx
│   │       ├── AnalogZone.tsx
│   │       ├── MotorZone.tsx
│   │       └── LogicControllerZone.tsx
│   │
│   ├── peripherals/               # Peripheral UI widgets
│   │   ├── LCDDisplay.tsx         # 20×4 LCD render
│   │   ├── SevenSegDisplay.tsx    # 5-digit 7-seg display
│   │   ├── MatrixKeypad.tsx       # 4×4 keypad
│   │   ├── LEDArray.tsx           # 8 LEDs
│   │   ├── SwitchArray.tsx        # 8 switches
│   │   ├── Buzzer.tsx             # Buzzer with audio
│   │   ├── DCMotor.tsx            # DC motor animation
│   │   ├── StepperMotor.tsx       # Stepper motor animation
│   │   ├── ServoMotor.tsx         # Servo arm animation
│   │   ├── Potentiometer.tsx      # Rotary knob
│   │   ├── ADCInputs.tsx          # ADC slider panel
│   │   ├── DACOutput.tsx          # DAC voltage display
│   │   └── ElevatorInterface.tsx  # Elevator shaft UI
│   │
│   ├── debug/                     # Debug panel components
│   │   ├── DebugPanel.tsx         # Right panel container
│   │   ├── RegisterWindow.tsx     # R0–R15, PC, CPSR
│   │   ├── Disassembler.tsx       # Disassembly view
│   │   ├── MemoryViewer.tsx       # Hex dump
│   │   ├── WatchWindow.tsx        # Watch variables
│   │   ├── CallStack.tsx          # Call stack
│   │   ├── Breakpoints.tsx        # Breakpoint manager
│   │   ├── VICPanel.tsx           # Interrupt controller view
│   │   └── PeripheralRegs.tsx     # MMIO register tree
│   │
│   ├── instruments/               # Virtual instruments
│   │   ├── Oscilloscope.tsx       # Virtual oscilloscope
│   │   ├── LogicAnalyzer.tsx      # 8-channel logic analyzer
│   │   └── SerialMonitor.tsx      # UART terminal
│   │
│   ├── wiring/                    # External peripheral wiring
│   │   ├── WiringCanvas.tsx       # Drag-and-drop wiring
│   │   ├── ComponentPalette.tsx   # External component picker
│   │   └── components/            # External component models
│   │       ├── ExternalLED.tsx
│   │       ├── PushButton.tsx
│   │       └── ...
│   │
│   ├── layout/                    # App chrome
│   │   ├── Toolbar.tsx            # Top toolbar
│   │   ├── BottomTabs.tsx         # Oscilloscope/Monitor tabs
│   │   ├── StatusBar.tsx          # Cycle count, speed, status
│   │   └── ResizablePanels.tsx    # Panel resize handles
│   │
│   └── ui/                        # Design system primitives
│       ├── Button.tsx
│       ├── Panel.tsx
│       ├── Tooltip.tsx
│       ├── Badge.tsx
│       ├── Input.tsx
│       └── Select.tsx
│
├── sim/                           # Simulation engine (TypeScript)
│   ├── cpu/
│   │   ├── arm7.ts                # ARM7TDMI CPU (TS Phase 1)
│   │   ├── decoder.ts             # Instruction decoder
│   │   ├── executor.ts            # Instruction executor
│   │   ├── thumb.ts               # Thumb instruction set
│   │   └── alu.ts                 # ALU operations (flags etc.)
│   │
│   ├── memory/
│   │   ├── memoryMap.ts           # Memory read/write router
│   │   ├── flash.ts               # Flash memory model
│   │   └── sram.ts                # SRAM model
│   │
│   ├── peripherals/
│   │   ├── bus.ts                 # Peripheral bus
│   │   ├── gpio.ts                # GPIO controller
│   │   ├── uart.ts                # UART 0/1
│   │   ├── i2c.ts                 # I2C 0/1
│   │   ├── spi.ts                 # SPI 0
│   │   ├── timer.ts               # Timer 0/1
│   │   ├── pwm.ts                 # PWM controller
│   │   ├── adc.ts                 # ADC 0/1
│   │   ├── dac.ts                 # DAC
│   │   ├── vic.ts                 # VIC (interrupt controller)
│   │   └── rtc.ts                 # RTC (stub)
│   │
│   ├── loader/
│   │   ├── hexParser.ts           # Intel HEX parser
│   │   ├── elfParser.ts           # ELF/DWARF parser
│   │   └── binLoader.ts           # Raw binary loader
│   │
│   └── engine.ts                  # Main simulation loop
│
├── store/
│   ├── simulatorStore.ts          # Main Zustand store
│   ├── boardStore.ts              # Board UI state
│   └── sessionStore.ts            # Session persistence
│
├── hooks/
│   ├── useSimulator.ts            # Simulation control hook
│   ├── useOscilloscope.ts         # Oscilloscope data hook
│   ├── useKeyboard.ts             # Global keyboard shortcuts
│   └── useSession.ts              # Session save/load
│
├── lib/
│   ├── disassembler.ts            # ARM7 disassembler
│   ├── audioContext.ts            # Buzzer audio singleton
│   ├── pixiScope.ts               # PixiJS oscilloscope canvas
│   └── indexedDB.ts               # Session persistence
│
├── wasm/                          # (Phase 2) Rust WASM
│   └── arm7-core/                 # Rust crate
│       ├── src/
│       │   ├── lib.rs
│       │   ├── cpu.rs
│       │   ├── decoder.rs
│       │   └── memory.rs
│       └── Cargo.toml
│
├── public/
│   ├── fonts/                     # Self-hosted Geist fonts
│   └── board-assets/             # SVG component graphics
│       ├── ic-lpc2148.svg
│       ├── ic-uln2803.svg
│       ├── ic-drv8801.svg
│       └── ...
│
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts             # Tailwind v4 config
└── README.md
```

---

## 15. Build & Dev Tooling

### 15.1 package.json (key dependencies)

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.5.0",
    "zustand": "^4.5.0",
    "motion": "^11.0.0",
    "@phosphor-icons/react": "^2.1.0",
    "pixi.js": "^8.2.0",
    "three": "^0.165.0",
    "idb": "^8.0.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "eslint": "^8.57.0",
    "prettier": "^3.3.0",
    "vitest": "^1.6.0",
    "@testing-library/react": "^16.0.0",
    "@types/three": "^0.165.0"
  }
}
```

### 15.2 next.config.ts

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    turbo: {},             // Turbopack for dev
  },
  webpack(config) {
    // Enable WASM support (Phase 2)
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default nextConfig;
```

### 15.3 Scripts

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write .",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "wasm:build": "cd wasm/arm7-core && wasm-pack build --target web"
  }
}
```

---

## 16. Testing Strategy

### 16.1 Unit Tests (Vitest)

Priority test suites:

**CPU Emulator tests:**
```typescript
// sim/cpu/__tests__/arm7.test.ts
describe('ARM7 MOV instruction', () => {
  it('MOV R0, #5 sets R0 to 5', () => { ... });
  it('MOVS R0, #0 sets Z flag', () => { ... });
  it('MOV PC, LR returns from function', () => { ... });
});

describe('ARM7 LDR/STR', () => {
  it('STR R0, [R1] writes to SRAM', () => { ... });
  it('LDR R0, [R1, #4] reads with offset', () => { ... });
  it('PUSH/POP round-trip', () => { ... });
});

describe('ARM7 Branch', () => {
  it('BL sets LR and jumps to target', () => { ... });
  it('BX switches to Thumb mode', () => { ... });
});
```

**Peripheral tests:**
```typescript
describe('GPIO Controller', () => {
  it('Writing IO0SET sets pins', () => { ... });
  it('Writing IO0CLR clears pins', () => { ... });
  it('INPUT pin reads external value', () => { ... });
});

describe('UART0', () => {
  it('TX byte appears in TX buffer', () => { ... });
  it('RX byte readable from U0RBR', () => { ... });
  it('THRE bit clears on write', () => { ... });
});

describe('Intel HEX Parser', () => {
  it('Parses simple data records', () => { ... });
  it('Handles extended address records', () => { ... });
  it('Detects checksum errors', () => { ... });
});
```

### 16.2 Integration Tests

- Load a known `.hex` file (LED blink program) and verify GPIO toggles at expected intervals.
- Load UART echo program → send byte via serial monitor → verify echo received.
- Load ADC read program → set slider → verify ADC register value.

### 16.3 Visual Regression Tests

- Use Playwright + `@playwright/test` for screenshot tests of:
  - Board idle state (no hex loaded)
  - Board running state (LEDs lit, LCD showing text)
  - Oscilloscope showing PWM waveform
  - Debug panel showing registers

---

## 17. Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| ARM7 cycle throughput (TS) | 500K cycles/sec minimum | Tight loop, no allocations |
| ARM7 cycle throughput (WASM) | 5M+ cycles/sec | Rust WASM Phase 2 |
| Board render frame rate | 60 fps | React reconciliation minimized, SVG not re-rendered every frame |
| Oscilloscope render | 60 fps | PixiJS, WebGL |
| Hex file load time | < 500ms (512KB hex) | Async parser, non-blocking |
| Memory viewer update | < 50ms per scroll | Virtualized list |
| Time to first meaningful paint | < 2s | Next.js SSR, deferred JS |
| Bundle size | < 2MB gzipped | Code splitting per panel |

**Performance rules for Claude Code:**
- Never store DOM references in Zustand. Only serializable state.
- Use `useMemo` and `useCallback` aggressively in peripheral UI components (they re-render frequently).
- Board canvas SVG: only update changed pins, not the full SVG tree. Use `React.memo` per pin component.
- Oscilloscope: DO NOT use React state for sample data. Use PixiJS directly.
- Simulation loop: runs in `requestAnimationFrame` callback. No async/await inside the loop.

---

## 18. Accessibility & Responsiveness

### 18.1 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `F5` | Run / Continue |
| `F10` | Step Over |
| `F11` | Step Into |
| `Shift+F11` | Step Out |
| `Ctrl+F5` | Stop |
| `Ctrl+R` | Reset & Reload |
| `F9` | Toggle Breakpoint at PC |
| `Ctrl+O` | Open Hex File |
| `Ctrl+S` | Save Session |
| `1–8` | Toggle Switches 1–8 |
| `0–9, A–F` | Keypad key press |
| `Escape` | Close modal / dismiss tooltip |
| `Ctrl+Shift+P` | Command palette |

### 18.2 WCAG AA Compliance

- All text: 4.5:1 contrast ratio minimum.
- Icons paired with text labels (not icon-only critical actions).
- `aria-label` on all icon buttons.
- Focus rings: `focus-visible:ring-2 ring-cyan-400/50` — always visible.
- Keyboard-navigable all panels.
- No information conveyed by color alone (add shape/label for LED on/off).

### 18.3 Responsiveness

- **Primary target:** Desktop 1440×900+.
- **Secondary:** 1280×800 laptops (RVCE lab machines).
- **Mobile:** Not a priority for v1 — show "best on desktop" notice on <768px.
- Panels are resizable via drag handles (store sizes in localStorage).
- Bottom tab panel: collapsible (hide to give more board space).
- Debug panel: collapsible (hide for presentation mode).

---

## 19. Phase Roadmap

### Phase 1 — Core Simulator (Weeks 1–6)

**Goal:** A working hex-upload-and-run simulator for GPIO, LCD, UART, and basic debug.

**Deliverables:**
- Next.js project scaffold with dark-tech design system.
- Intel HEX parser.
- ARM7TDMI emulator in TypeScript (partial — enough for RVCE lab programs).
  - Support: MOV, ADD, SUB, AND, ORR, LDR, STR, B, BL, BX, CMP, PUSH, POP, MUL.
  - Thumb instruction support (most lab code uses Thumb).
- GPIO controller (PORT0 + PORT1).
- UART0 peripheral + Serial Monitor.
- 2D board SVG render (static layout, no interaction yet).
- LED array UI (responds to GPIO changes).
- Switch array UI (sends GPIO input).
- Keypad UI (sends GPIO input via row/column scanning).
- 20×4 LCD emulator (HD44780 command set, 4-bit mode).
- Basic debug panel: registers, PC, running/paused/step.

### Phase 2 — Full Peripheral Suite (Weeks 7–12)

**Deliverables:**
- All peripheral MMIO implementations: Timer0/1, PWM, ADC, DAC, I2C, SPI, VIC.
- Virtual Oscilloscope (PixiJS).
- Logic Analyzer.
- Complete debug panel: disassembler, memory viewer, watch window, call stack, breakpoints.
- Motor UIs: DC motor, stepper motor, servo motor.
- Seven-segment display emulator.
- Buzzer with Web Audio API.
- Elevator interface.
- ELF parser + symbol table integration.
- Session save/load (IndexedDB).

### Phase 3 — WASM Core & 3D (Weeks 13–20)

**Deliverables:**
- Rust ARM7TDMI core compiled to WebAssembly.
- Performance uplift: 10× simulation speed.
- Three.js 3D board render.
- External peripheral wiring canvas.
- SPI device models (SD card stub, SPI OLED).
- I2C device models (AT24C02 EEPROM, PCF8574).
- WiFi/Bluetooth module simulation (UART passthrough to WebSocket).
- Command palette (`Ctrl+Shift+P`).
- Complete keyboard shortcut system.
- Automated test suite (Vitest + Playwright).

---

## 20. Appendix A — LPC2148 Register Reference

### A.1 System Control Block (SCB) — Base: `0xE01FC000`

| Register | Offset | Description |
|----------|--------|-------------|
| MEMMAP | 0x040 | Memory Map Control |
| PLLCON | 0x080 | PLL Control Register |
| PLLCFG | 0x084 | PLL Configuration |
| PLLSTAT | 0x088 | PLL Status |
| PLLFEED | 0x08C | PLL Feed Sequence |
| PCON | 0x0C0 | Power Control |
| PCONP | 0x0C4 | Power Control for Peripherals |
| VPBDIV | 0x100 | VPB (Peripheral) Bus Clock Divider |
| EXTINT | 0x140 | External Interrupt Flag Register |
| EXTWAKE | 0x144 | External Interrupt Wakeup Register |
| EXTMODE | 0x148 | External Interrupt Mode Register |
| EXTPOLAR | 0x14C | External Interrupt Polarity |
| RSID | 0x180 | Reset Source ID Register |
| CSPR | 0x184 | CPU Status |
| SCS | 0x1A0 | System Control and Status |

### A.2 Pin Connect Block (PINSEL) — Base: `0xE002C000`

| Register | Offset | Description |
|----------|--------|-------------|
| PINSEL0 | 0x00 | PIN Function Select 0 (P0.0–P0.15) |
| PINSEL1 | 0x04 | PIN Function Select 1 (P0.16–P0.31) |
| PINSEL2 | 0x14 | PIN Function Select 2 (P1.16–P1.31) |

**PINSEL bits per pin (2 bits):**
- `00` → GPIO
- `01` → Primary function (UART, I2C, etc.)
- `10` → Secondary function
- `11` → Tertiary function

**Simulation:** Peripheral MMIO modules check PINSEL to know if they own a particular pin.

### A.3 Watchdog Timer (WDT) — Base: `0xE0000000`

| Register | Offset | Description |
|----------|--------|-------------|
| WDMOD | 0x00 | Watchdog Mode Register |
| WDTC | 0x04 | Watchdog Timer Constant |
| WDFEED | 0x08 | Watchdog Feed Sequence |
| WDTV | 0x0C | Watchdog Timer Value |

**Simulation:** If WDMOD.WDEN set and WDT not fed (0xAA, 0x55) within WDTC cycles, trigger reset.

### A.4 Full Peripheral Address Map

| Peripheral | Base Address |
|-----------|-------------|
| WDT | 0xE0000000 |
| Timer 0 | 0xE0004000 |
| Timer 1 | 0xE0008000 |
| UART 0 | 0xE000C000 |
| UART 1 | 0xE0010000 |
| PWM | 0xE0014000 |
| I2C 0 | 0xE001C000 |
| SPI 0 | 0xE0020000 |
| RTC | 0xE0024000 |
| GPIO 0/1 | 0xE0028000 |
| PIN Select | 0xE002C000 |
| ADC 0 | 0xE0030000 |
| I2C 1 | 0xE005C000 |
| ADC 1 | 0xE0034000 |
| DAC | 0xE006C000 |
| SPI 1/SSP | 0xE0068000 |
| USB | 0xE0090000 |
| SCB (system) | 0xE01FC000 |
| MAC/EMAC | 0xFFE00000 |
| VIC | 0xFFFFF000 |

---

## 21. Appendix B — Skill Reference for Claude Code

> Claude Code must follow these directives when building LOKI-SIM. This appendix consolidates all design and code standards for the implementing agent.

### B.1 Design Skill (`/design-taste-frontend`)

Always read `/mnt/skills/user/design-taste-frontend/SKILL.md` before generating any UI component.

Key rules to enforce:
1. **Never use Inter font.** Use Geist + Geist Mono.
2. **Never use purple gradients.** Use zinc/slate base + cyan accent.
3. **Never center-align hero sections.** Board canvas is full-width, debug panel is flush right.
4. **Use Phosphor icons only.** Never mix with Lucide or raw SVG icons.
5. **Buttons need tactile feedback.** Always add `active:-translate-y-px`.
6. **LED glow must be motivated.** Only glow when GPIO pin is HIGH — not decorative.
7. **Never use `h-screen`.** Use `min-h-[100dvh]`.
8. **Motion must be motivated.** Each animation in this PRD has a stated reason (see Section 13.6).
9. **One accent color: cyan.** No teal, no blue, no purple in the same component.
10. **No card shadows with black.** Use `ring-1 ring-zinc-700` borders for panel separation.

### B.2 Component Build Order for Claude Code

Build in this order to ensure testability at each stage:

1. Design system: `global.css`, `globals.ts` CSS variables, Tailwind config, font setup.
2. Layout chrome: `Toolbar.tsx`, `ResizablePanels.tsx`, `StatusBar.tsx`, `BottomTabs.tsx`.
3. Simulation core: `hexParser.ts`, `memoryMap.ts`, basic `arm7.ts` (MOV/LDR/STR/B/BL).
4. GPIO controller: `gpio.ts` + basic `BoardCanvas.tsx` with LED indicators.
5. LED array + Switch array peripherals.
6. UART0 + `SerialMonitor.tsx`.
7. LCD emulator: `LCDDisplay.tsx` + `lcd.ts`.
8. Matrix keypad: `MatrixKeypad.tsx`.
9. Debug panel: `RegisterWindow.tsx`, `Disassembler.tsx`, `MemoryViewer.tsx`.
10. Full ARM7 instruction set completion.
11. Timer0/1, PWM, ADC, DAC.
12. Motor UIs, Seven-Segment, Buzzer.
13. VIC (interrupt controller).
14. Oscilloscope (PixiJS).
15. Logic Analyzer.
16. ELF parser.
17. Session persistence.
18. Wiring Canvas.
19. Three.js 3D board (Phase 3).
20. WASM CPU core (Phase 3).

### B.3 Code Quality Rules

- TypeScript strict mode (`"strict": true` in `tsconfig.json`).
- No `any` types in simulation core. Use proper typings for all MMIO registers.
- All magic numbers (register addresses, bit masks) in named constants.
- Each peripheral module: self-contained, testable in isolation.
- Simulation loop: pure function of state — no side effects except via the peripheral bus interface.
- All user-facing text: no AI-generated marketing copy. Plain, functional labels.
- Comments: explain WHY, not WHAT. ARM7-specific behavior must cite the LPC2148 User Manual section.

### B.4 File Naming Conventions

```
components/board/zones/       → PascalCase, suffix "Zone" (e.g., LCDZone.tsx)
components/peripherals/       → PascalCase, no suffix (e.g., LCDDisplay.tsx)
components/debug/             → PascalCase, suffix "Window" or "Panel"
sim/cpu/                      → camelCase (arm7.ts, decoder.ts)
sim/peripherals/              → camelCase, named by peripheral (uart.ts, gpio.ts)
store/                        → camelCase, suffix "Store" (simulatorStore.ts)
hooks/                        → camelCase, prefix "use" (useSimulator.ts)
lib/                          → camelCase, functional name (disassembler.ts)
```

### B.5 Testing Commands

```bash
# Run all unit tests
npm run test

# Run specific peripheral test
npx vitest sim/peripherals/__tests__/gpio.test.ts

# Visual regression
npx playwright test

# Build check (TypeScript)
npx tsc --noEmit
```

### B.6 Deployment

```bash
# Local development
npm run dev

# Production build
npm run build
npm run start

# Deploy to Vercel
npx vercel --prod
```

No backend required. All simulation runs in-browser.

---

## Final Notes for Claude Code

**Start with this command:**
```bash
npx create-next-app@latest loki-sim \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --no-eslint
cd loki-sim
```

**Then install dependencies:**
```bash
npm install zustand motion @phosphor-icons/react pixi.js three idb clsx tailwind-merge
npm install -D @types/three vitest @testing-library/react
```

**The most important thing:** LOKI-SIM must feel like a *real instrument*, not a toy. Every UI element should communicate meaningful data. Every animation must have a hardware analog. When a student uploads their RVCE lab hex file and sees the LCD light up with the expected text, the LEDs blink in the right pattern, and the serial monitor shows the UART output — that moment of recognition is the entire product.

Build it. Make it beautiful. Make it work.

---

*End of PRD — LOKI-SIM v1.0.0*  
*Total specification: ~30 pages*  
*Prepared for Claude Code implementation*
