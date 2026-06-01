# LOKI-SIM — User Manual

**RV-IoT LPC2148 (ARM7TDMI-S) Board Simulator**

A browser-based simulator for the RVCE RV-IoT ARM board. Upload a compiled
`.hex` (from Keil uVision / Flash Magic), `.bin`, or `.elf` and watch it execute
on a virtual board with live peripherals, a Keil-style debugger, an
oscilloscope, a logic analyzer, and more.

---

## 1. Getting started

### Run the app
```bash
npm install      # first time only
npm run dev      # starts dev server
```
Open **http://localhost:3000** in your browser (Chrome/Edge recommended for the
Web Audio buzzer and WebGL 3D board).

> Inside VS Code you can also press **Ctrl+Shift+P → "Simple Browser: Show"** and
> enter `http://localhost:3000` to preview it in the editor.

### Production build
```bash
npm run build
npm run start
```

---

## 2. Loading a program

There are three ways to load a compiled program:

1. **Drag and drop** a `.hex` / `.bin` / `.elf` file anywhere onto the board.
2. Click **Choose file** on the idle board overlay.
3. Click **Open** in the top toolbar.

A bundled demo program (`public/sample-blink.hex`) blinks the 8 LEDs and prints
`RV-IoT OK` over UART0.

| Format | Notes |
|--------|-------|
| `.hex` | Intel HEX — the format Keil uVision and Flash Magic produce. **Primary.** |
| `.bin` | Raw binary, loaded at address `0x00000000`. |
| `.elf` | ELF executable — also loads function/variable **symbol names** for the debugger. |

On load, the CPU resets, Flash is programmed, and the simulator pauses at the
reset vector ready to run.

---

## 3. The toolbar (top bar)

| Control | Shortcut | What it does |
|---------|----------|--------------|
| **Open** | `Ctrl+O` | Load a program file |
| ▶ **Run** | `F5` | Run at full speed until a breakpoint / stop |
| ⏸ **Pause** | `F5` | Pause execution |
| ⏹ **Stop** | `Ctrl+F5` | Stop and reset to the entry point |
| ↺ **Reset** | `Ctrl+R` | Reset CPU + peripherals, reload program |
| ↓ **Step Into** | `F11` | Execute one instruction (enters function calls) |
| → **Step Over** | `F10` | Execute one instruction (runs calls to completion) |
| ↑ **Step Out** | `Shift+F11` | Run until the current function returns |
| ⚡ **Speed** | — | 0.25× / 0.5× / 1× / 2× / 10× / MAX execution rate |

The right side shows the live **PC**, **cycle counter**, and **status**
(IDLE / RUNNING / PAUSED / BREAKPOINT / HALTED / ERROR).

---

## 4. The board (center)

Each peripheral zone is wired to real LPC2148 pins (shown in each zone's label).

### Displays
- **20×4 LCD (HD44780)** — D4-D7 = P0.16-P0.19, RS = P0.20, EN = P1.25.
  Renders characters your program writes. Click it to toggle the backlight.
- **7-Segment (5-digit)** — serial shift register on DATA P0.19 / CLK P0.20 /
  STROBE P0.30.

### Input
- **4×4 Matrix Keypad** — rows P0.16-P0.19 (output), columns P1.16-P1.19 (input).
  Click keys, or use keyboard **0-9 / A-F**. The simulator handles the row-scan /
  column-read protocol automatically.
- **8 Switches** — slide switches on P0.8-P0.15. Click them, or press **1-8** on
  your keyboard. Released = HIGH (pull-up), pressed = LOW (active-low).

### Output indicators
- **8 LEDs** — on P0.0-P0.7. Glow green when their pin is driven HIGH (output).
- **LPC2148 chip** — the centerpiece. Every pin dot shows live state:
  green = output HIGH, dim = output LOW, amber ring = input HIGH, hollow = input LOW.
  Hover a pin to see its name and alternate function.

### Analog
- **ADC inputs** — drag the **LDR**, **LM35 temperature**, and **Potentiometer**
  sliders to feed analog values into ADC1 channels 2/3/4 (P0.29/P0.30/P0.31).
- **DAC output** — a live 0-3.3 V gauge fed from DACR (P0.25). Also drives
  oscilloscope CH1.

### Motors & actuators
- **DC Motor (DRV8801)** — speed from PWM6 duty, direction from P0.28. Shaft spins.
- **Stepper 1 & 2 (ULN2803)** — coil patterns on P0.16-19 / P0.20-23. Shows step
  count, angle, and direction.
- **Servo 1 & 2** — PWM4 (P0.21) / PWM5 (P0.22). Arm rotates to the commanded angle.
- **Buzzer** — plays a square-wave tone (Web Audio) when driven. Use **Mute** to
  silence it.
- **Elevator** — see §7.

### 2D / 3D toggle
Once a program is loaded, the **3D** button (top-right of the board) switches to a
Three.js 3D PCB render with orbit controls (drag to rotate, scroll to zoom). LEDs
light up in 3D too. Click **2D** to switch back.

---

## 5. The debugger (right panel)

Three tabs:

### CPU
- **Registers** — R0-R15, SP, LR, PC, and CPSR. Changed values flash amber.
  Flags N/Z/C/V/I/F/T and processor mode shown below.
- **Disassembly** — live ARM/Thumb disassembly centered on the PC (highlighted).
  **Click any line to set/clear a breakpoint** (red dot). When the PC reaches a
  breakpoint the whole screen flashes red and execution pauses.
- **Breakpoints** — list of active breakpoints (appears when you have some).
- **Memory** — hex dump. Type an address and press Enter to jump, or click
  **Flash** / **SRAM**. Colors: blue = Flash, green = SRAM, amber = peripherals.

### Periph
Expandable tree of peripheral registers (GPIO, UART0, Timer0, PWM, ADC1, DAC,
VIC) with live hex values. Click a group to expand it.

### VIC
The Vectored Interrupt Controller table — every IRQ source with its enable /
raw / pending / FIQ status. Pending interrupts highlight red.

---

## 6. The instruments (bottom panel)

| Tab | Use |
|-----|-----|
| **Serial Monitor** | UART0 terminal. Output from your program appears here. Type in the input box and press Enter (or the send button) to send data to the CPU's RX. Baud rate is shown. |
| **Oscilloscope** | 4-channel scope. CH1 = DAC, CH2 = PWM6, CH3 = P0.0, CH4 = P0.1. Adjust the timebase, toggle **CRT** phosphor mode, pause, and export a PNG. |
| **Logic Analyzer** | 8-channel digital trace of P0.0-P0.7 with history. |
| **Wiring** | Drag external components (LED, button, sensors, OLED, Bluetooth, etc.) onto the canvas to extend the board. |
| **Event Log** | Bus warnings — unmapped reads/writes (e.g. a stray pointer hitting `0xFFFFFFFF`). The badge shows the count. |

---

## 7. Running the Elevator lab (e.g. `lab1b.hex`)

The elevator interface models the standard RVCE elevator-control experiment.

**Pin mapping**
- Floor **call buttons** → P0.16-P0.19 (CPU inputs, active-low)
- Floor **indicator LEDs** → P1.16-P1.19 (CPU outputs)
- Lift **motor** → DC motor interface (PWM6 + direction P0.28)

**How to use it**
1. Load `lab1b.hex` and press **Run** (`F5`).
2. The **car position** is shown by which floor indicator LED (P1.16-P1.19) the
   program drives HIGH. The highlighted cell with `▣` is the car.
3. Click a **call button (1-4)** next to the shaft to request a floor. This pulls
   the corresponding P0.16-P0.19 input LOW, exactly like pressing the physical
   button. Hold it until the program scans it.
4. While the motor runs, an **↑ / ↓ arrow** appears and the status reads
   `GOING UP` / `GOING DOWN`.

> **Tip:** if the car doesn't move, open the **Periph → GPIO** tab and watch
> `IO0PIN` (does your button press register?) and `IO1SET`/`IO1PIN` (which floor
> LED is the program lighting?). The elevator UI mirrors exactly what those
> registers say. If the program uses different pins than the standard mapping
> above, the indicators follow PORT1 outputs.

---

## 8. Keyboard shortcuts (full list)

| Key | Action |
|-----|--------|
| `F5` | Run / Pause |
| `F10` | Step Over |
| `F11` | Step Into |
| `Shift+F11` | Step Out |
| `Ctrl+F5` | Stop |
| `Ctrl+R` | Reset & reload |
| `F9` | Toggle breakpoint at the current PC |
| `Ctrl+O` | Open a program file |
| `1`-`8` | Toggle switches 1-8 |
| `0`-`9`, `A`-`F` | Press the matching keypad key |
| `Ctrl+Shift+P` | Open the command palette (search all actions) |
| `Esc` | Close the command palette / dialogs |

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Program loads but nothing happens | Press **Run** (`F5`). Check the status reads RUNNING. |
| Status shows **ERROR** | The CPU hit an undefined instruction. Check the disassembly at the PC — the `.hex` may target an unsupported coprocessor op. |
| Status shows **HALTED** | The program reached an idle state (e.g. `B .` infinite loop) with no peripheral activity. Usually normal at end-of-program. |
| LCD shows nothing | Confirm the program uses 4-bit mode on P0.16-19 with EN on P1.25. Check the **Periph → GPIO** tab to see EN toggling. |
| Buzzer is silent | Click **Mute** to unmute; some browsers require a click on the page first before audio can start. |
| Lots of Event Log warnings | The program is accessing unmodeled addresses. Usually harmless; the simulator returns `0xDEADC0DE` for those reads. |
| Layout looks cramped | The app targets desktop ≥ 1280px wide. Maximize the window; panels and the board scroll independently. |

---

## 10. Architecture (for the curious)

- **CPU**: ARM7TDMI-S core in TypeScript — full ARM32 + Thumb instruction sets,
  barrel shifter, banked registers, exceptions, and the VIC.
- **Memory**: Flash 512 KB (`0x00000000`), SRAM 32 KB (`0x40000000`), MMIO
  peripherals (`0xE0000000+`), VIC (`0xFFFFF000`).
- **Peripherals**: GPIO, UART0/1, Timer0/1, PWM, ADC1, DAC, VIC, I2C0/1,
  SPI0/1, RTC, plus the LCD and keypad GPIO-snoop models.
- **Engine loop**: runs in `requestAnimationFrame`; the speed control scales how
  many instructions execute per frame.
- **Stack**: Next.js 14, React 18, TypeScript, Zustand, Tailwind v4, Motion,
  PixiJS (oscilloscope), Three.js (3D board), Phosphor Icons.

See `PRD.md` for the full product specification.
