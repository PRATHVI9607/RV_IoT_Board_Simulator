"use client";

import { create } from "zustand";
import { Engine, type Snapshot, type SimStatus } from "@/sim/engine";
import { parseIntelHex, type ParsedHex } from "@/sim/loader/hexParser";
import { SWITCH_PINS, keypadCellToMatrix } from "@/lib/boardConfig";

let engine: Engine | null = null;
export function getEngine(): Engine {
  if (!engine) engine = new Engine();
  return engine;
}

export type SimSpeed = 0.25 | 0.5 | 1 | 2 | 10 | "max";

const BASE_BUDGET = 40_000;

interface LoadSummary {
  name: string;
  byteCount: number;
  entryPoint: number;
  minAddress: number;
  maxAddress: number;
}

interface StepperState {
  steps: number;
  angle: number;
  cw: boolean;
  coils: number;
  prevCoils: number;
}

// Full-step CW sequences for detecting direction
const CW_SEQ = [0b1000, 0b0100, 0b0010, 0b0001];

interface SimState {
  snap: Snapshot;
  status: SimStatus;
  speed: SimSpeed;
  hexLoaded: boolean;
  load: LoadSummary | null;
  error: string | null;
  serial: string;
  breakpoints: number[];
  switches: boolean[];
  bpFlash: number;
  selectedMemAddr: number;
  // Phase 2 state
  adcInputs: number[];
  sevenSegBuffer: number[];
  stepperState: StepperState[];
  elevatorFloor: number;
  buzzerMuted: boolean;
  logicHistory: number[];  // ring buffer of P0[7:0] snapshots (max 1024)
  show3D: boolean;
  /** Which board peripherals are "wired" to the MCU pins (user-selectable). */
  connected: Record<PeriphKey, boolean>;

  // Actions
  loadHexText: (text: string, name: string) => void;
  loadBytes: (bytes: Uint8Array, name: string) => void;
  loadElf: (bytes: Uint8Array, name: string) => void;
  run: () => void;
  pause: () => void;
  stop: () => void;
  reset: () => void;
  stepInto: () => void;
  stepOver: () => void;
  stepOut: () => void;
  setSpeed: (s: SimSpeed) => void;
  toggleBreakpoint: (addr: number) => void;
  pressKey: (uiRow: number, uiCol: number, down: boolean) => void;
  toggleSwitch: (index: number) => void;
  sendSerial: (text: string) => void;
  clearSerial: () => void;
  setMemAddr: (addr: number) => void;
  setADCInput: (ch: number, value: number) => void;
  pressElevatorFloor: (floor: number, down: boolean) => void;
  toggleBuzzerMute: () => void;
  toggle3D: () => void;
  togglePeripheral: (key: PeriphKey) => void;
  /** Manually drive an input pin's external level (board pin manipulation). */
  setPin: (port: 0 | 1, pin: number, high: boolean) => void;
  refresh: () => void;
}

/** Selectable board peripherals (those that interpret shared MCU pins). */
export type PeriphKey =
  | "lcd" | "sevenSeg" | "keypad" | "leds" | "switches"
  | "dcMotor" | "stepper1" | "stepper2" | "servo1" | "servo2"
  | "buzzer" | "elevator" | "adc" | "dac";

/**
 * Default wiring. The peripherals that aggressively react to the heavily
 * multiplexed P0.16–P0.23 / PWM lines (7-seg, steppers, motors, servos,
 * buzzer, elevator) start DISCONNECTED so a given lab program only drives the
 * peripherals it actually uses. The user connects others as needed.
 */
const DEFAULT_CONNECTED: Record<PeriphKey, boolean> = {
  // LEDs + switches are always shown (P0.0-15, dedicated). Everything else
  // starts disconnected so the board only shows what a program actually uses;
  // connect the peripherals you need from the tray.
  leds: true, switches: true,
  lcd: false, keypad: false, adc: false, dac: false,
  sevenSeg: false, dcMotor: false, stepper1: false, stepper2: false,
  servo1: false, servo2: false, buzzer: false, elevator: false,
};

let rafId = 0;
const LOGIC_MAX = 1024;

function decodeTx(bytes: number[]): string {
  return bytes.map(b => (b === 0x0a || b === 0x0d || b === 0x09 || (b >= 0x20 && b < 0x7f))
    ? String.fromCharCode(b) : "·").join("");
}

/** Detect stepper motor step from coil pattern change. */
function updateStepper(state: StepperState, newCoils: number): StepperState {
  if (newCoils === state.prevCoils) return state;
  const cwIdx = CW_SEQ.indexOf(newCoils);
  const ccwPrev = CW_SEQ.indexOf(state.prevCoils);
  const isCW = cwIdx >= 0 && ((ccwPrev + 1) % 4) === cwIdx;
  const isCCW = cwIdx >= 0 && ((ccwPrev - 1 + 4) % 4) === cwIdx;
  const stepped = isCW || isCCW;
  return {
    steps: state.steps + (stepped ? 1 : 0),
    angle: state.angle + (isCW ? 1.8 : isCCW ? -1.8 : 0),
    cw: isCW || (!isCCW && state.cw),
    coils: newCoils,
    prevCoils: newCoils,
  };
}

export const useSim = create<SimState>((set, get) => {
  const eng = getEngine();
  // Ensure engine peripheral flags match the default wiring at startup.
  eng.lcd.setEnabled(DEFAULT_CONNECTED.lcd);
  eng.keypad.setEnabled(DEFAULT_CONNECTED.keypad);
  eng.sevenSeg.setEnabled(DEFAULT_CONNECTED.sevenSeg);

  function pumpSerial() {
    const tx = eng.uart0.drainTx();
    if (tx.length) {
      const chunk = decodeTx(tx);
      set(st => ({ serial: (st.serial + chunk).slice(-20000) }));
    }
  }

  function pumpPeripherals() {
    const g = eng.gpio;
    const { connected, stepperState: prev } = get();

    // Steppers only advance when connected (they share P0.16–23 with the LCD).
    const coils1 = (g.out[0] >>> 16) & 0xf; // P0.16-19
    const coils2 = (g.out[0] >>> 20) & 0xf; // P0.20-23
    const s0 = connected.stepper1 ? updateStepper(prev[0], coils1) : prev[0];
    const s1 = connected.stepper2 ? updateStepper(prev[1], coils2) : prev[1];

    // Logic analyzer history (always tracked — it is a passive probe)
    const byte = g.pinRegister(0) & 0xff;
    const prevHistory = get().logicHistory;
    const newHistory = [...prevHistory, byte].slice(-LOGIC_MAX);

    const sevenSeg = eng.sevenSeg.getDigits();

    set({ stepperState: [s0, s1], logicHistory: newHistory, sevenSegBuffer: sevenSeg });

    // Sync ADC inputs to engine
    const inputs = get().adcInputs;
    inputs.forEach((v, ch) => eng.adc1.setInput(ch, v));
  }

  function loop() {
    const simStatus = () => eng.status as SimStatus;
    if (simStatus() !== "running") return;
    const { speed } = get();
    if (speed === "max") {
      const start = performance.now();
      while (simStatus() === "running" && performance.now() - start < 8) {
        eng.run(BASE_BUDGET * 6);
      }
    } else {
      eng.run(Math.max(1, Math.round(BASE_BUDGET * speed)));
    }
    pumpSerial();
    pumpPeripherals();
    const snap = eng.snapshot();
    const afterStatus = simStatus();
    set({ snap, status: afterStatus });
    if (afterStatus === "breakpoint" || afterStatus === "halted" || afterStatus === "error") {
      if (afterStatus === "breakpoint") set(s => ({ bpFlash: s.bpFlash + 1 }));
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function settleAfterStep() {
    pumpSerial();
    pumpPeripherals();
    set({ snap: eng.snapshot(), status: eng.status });
  }

  function applySwitches(switches: boolean[]) {
    SWITCH_PINS.forEach((p, i) => eng.gpio.setExternalPin(p.port, p.pin, !switches[i]));
  }

  function handleLoad(parsed: ParsedHex, name: string) {
    applySwitches(get().switches);
    set({
      hexLoaded: true,
      error: null,
      status: eng.status,
      snap: eng.snapshot(),
      serial: "",
      breakpoints: Array.from(eng.breakpoints).sort((a, b) => a - b),
      load: {
        name,
        byteCount: parsed.byteCount,
        entryPoint: parsed.entryPoint,
        minAddress: parsed.minAddress,
        maxAddress: parsed.maxAddress,
      },
      selectedMemAddr: parsed.minAddress < 0x40000000 ? 0 : 0x40000000,
    });
  }

  return {
    snap: eng.snapshot(),
    status: "idle",
    speed: 1,
    hexLoaded: false,
    load: null,
    error: null,
    serial: "",
    breakpoints: [],
    switches: new Array(8).fill(false),
    bpFlash: 0,
    selectedMemAddr: 0x40000000,
    adcInputs: new Array(8).fill(512),
    sevenSegBuffer: new Array(5).fill(0xff), // 0xFF = blank (common-anode)
    stepperState: [
      { steps: 0, angle: 0, cw: true, coils: 0, prevCoils: 0 },
      { steps: 0, angle: 0, cw: true, coils: 0, prevCoils: 0 },
    ],
    elevatorFloor: 0,
    buzzerMuted: false,
    logicHistory: [],
    show3D: false,
    connected: { ...DEFAULT_CONNECTED },

    loadHexText(text, name) {
      try {
        const parsed = eng.loadHexText(text, name);
        handleLoad(parsed, name);
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e), hexLoaded: false });
      }
    },
    loadBytes(bytes, name) {
      try {
        const parsed = eng.loadBinary(bytes, name);
        handleLoad(parsed, name);
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e), hexLoaded: false });
      }
    },
    loadElf(bytes, name) {
      try {
        const parsed = eng.loadElf(bytes, name);
        handleLoad(parsed, name);
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e), hexLoaded: false });
      }
    },
    run() {
      if (!get().hexLoaded) return;
      cancelAnimationFrame(rafId);
      eng.status = "running";
      set({ status: "running" });
      rafId = requestAnimationFrame(loop);
    },
    pause() {
      cancelAnimationFrame(rafId);
      eng.status = "paused";
      set({ status: "paused", snap: eng.snapshot() });
    },
    stop() {
      cancelAnimationFrame(rafId);
      eng.reset();
      applySwitches(get().switches);
      set({ status: eng.hexInfo ? "paused" : "idle", snap: eng.snapshot(), serial: "" });
    },
    reset() {
      cancelAnimationFrame(rafId);
      eng.reset();
      applySwitches(get().switches);
      set({
        status: eng.hexInfo ? "paused" : "idle",
        snap: eng.snapshot(), serial: "",
        stepperState: [
          { steps: 0, angle: 0, cw: true, coils: 0, prevCoils: 0 },
          { steps: 0, angle: 0, cw: true, coils: 0, prevCoils: 0 },
        ],
        logicHistory: [],
      });
    },
    stepInto() {
      cancelAnimationFrame(rafId);
      eng.status = "paused";
      eng.stepInto();
      settleAfterStep();
    },
    stepOver() {
      cancelAnimationFrame(rafId);
      eng.status = "paused";
      eng.stepOver();
      settleAfterStep();
    },
    stepOut() {
      cancelAnimationFrame(rafId);
      eng.status = "paused";
      eng.stepOut();
      settleAfterStep();
    },
    setSpeed(s) { set({ speed: s }); },
    toggleBreakpoint(addr) {
      eng.toggleBreakpoint(addr);
      set({ breakpoints: Array.from(eng.breakpoints).sort((a, b) => a - b) });
    },
    pressKey(uiRow, uiCol, down) {
      const { row, col } = keypadCellToMatrix(uiRow, uiCol);
      eng.keypad.setPressed(row, col, down);
      if (eng.status !== "running") set({ snap: eng.snapshot() });
    },
    toggleSwitch(index) {
      set(st => {
        const switches = st.switches.slice();
        switches[index] = !switches[index];
        applySwitches(switches);
        return { switches, snap: eng.snapshot() };
      });
    },
    sendSerial(text) {
      eng.uart0.feedRx(Array.from(text, c => c.charCodeAt(0) & 0xff));
      set(st => ({ serial: st.serial + text }));
    },
    clearSerial() { set({ serial: "" }); },
    setMemAddr(addr) { set({ selectedMemAddr: addr >>> 0 }); },
    setADCInput(ch, value) {
      eng.adc1.setInput(ch, value);
      set(st => {
        const adcInputs = [...st.adcInputs];
        adcInputs[ch] = value;
        return { adcInputs };
      });
    },
    pressElevatorFloor(floor, down) {
      // Active-low call button on P0.16+floor: pressed = LOW.
      eng.gpio.setExternalPin(0, 16 + floor, !down);
      if (!down) set({ elevatorFloor: floor });
      // Reflect the input change immediately when paused.
      if (eng.status !== "running") set({ snap: eng.snapshot() });
    },
    toggleBuzzerMute() { set(st => ({ buzzerMuted: !st.buzzerMuted })); },
    toggle3D() { set(st => ({ show3D: !st.show3D })); },
    setPin(port, pin, high) {
      eng.gpio.setExternalPin(port, pin, high);
      if (eng.status !== "running") set({ snap: eng.snapshot() });
    },
    togglePeripheral(key) {
      set(st => {
        const connected = { ...st.connected, [key]: !st.connected[key] };
        applyConnections(connected);
        return { connected, snap: eng.snapshot() };
      });
    },
    refresh() { set({ snap: eng.snapshot(), status: eng.status }); },
  };

  /** Push connection flags into the engine peripherals that snoop the bus. */
  function applyConnections(c: Record<PeriphKey, boolean>) {
    eng.lcd.setEnabled(c.lcd);
    eng.keypad.setEnabled(c.keypad);
    eng.sevenSeg.setEnabled(c.sevenSeg);
  }
});
