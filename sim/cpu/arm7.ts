import type { MemoryBus } from "../memory/memoryMap";

/*
 * ARM7TDMI-S core (LPC2148). Implements the ARM32 and Thumb instruction sets
 * to the depth needed for RVCE lab programs. References are to the ARM7TDMI-S
 * Technical Reference Manual (DDI 0234) and the ARM Architecture Reference
 * Manual (DDI 0100 — "ARMv4T").
 *
 * Pipeline: 3-stage. The architectural rule is that R15 read during execution
 * sees the instruction address + 8 (ARM) or + 4 (Thumb). We model this by
 * pre-loading regs[15] with the pipeline value before each instruction.
 */

export const Mode = {
  USR: 0x10,
  FIQ: 0x11,
  IRQ: 0x12,
  SVC: 0x13,
  ABT: 0x17,
  UND: 0x1b,
  SYS: 0x1f,
} as const;

export const MODE_NAMES: Record<number, string> = {
  0x10: "User",
  0x11: "FIQ",
  0x12: "IRQ",
  0x13: "Supervisor",
  0x17: "Abort",
  0x1b: "Undefined",
  0x1f: "System",
};

export type CpuStatus = "ok" | "halted" | "undefined";

export class ARM7 {
  /** R0–R15. regs[15] holds the pipeline (instruction+8/4) value mid-execute. */
  readonly regs = new Uint32Array(16);

  // CPSR, decomposed for speed.
  N = false;
  Z = false;
  C = false;
  V = false;
  I = true; // IRQ disabled at reset
  F = true; // FIQ disabled at reset
  T = false; // ARM state at reset
  mode: number = Mode.SVC;

  // Banked R13/R14 + SPSR (FIQ R8–R12 banking is omitted; unused by lab code).
  private bankR13: Record<number, number> = {};
  private bankR14: Record<number, number> = {};
  private spsrByMode: Record<number, number> = {};

  /** Address of the instruction currently being executed (the real PC). */
  pc = 0;
  /** Set when an instruction writes R15, signalling a pipeline flush. */
  private branched = false;
  status: CpuStatus = "ok";
  cycles = 0;

  // ALU scratch (avoids per-instruction allocation in the hot path).
  private aRes = 0;
  private aC = false;
  private aV = false;
  private shifterCarry = false;

  constructor(private bus: MemoryBus) {}

  reset(): void {
    this.regs.fill(0);
    this.N = this.Z = this.C = this.V = false;
    this.I = this.F = true;
    this.T = false;
    this.mode = Mode.SVC;
    this.bankR13 = {};
    this.bankR14 = {};
    this.spsrByMode = {};
    this.pc = 0; // reset vector
    this.regs[13] = 0x40008000; // sensible default stack top (startup overrides)
    this.branched = false;
    this.status = "ok";
    this.cycles = 0;
  }

  // ---- CPSR helpers ------------------------------------------------------

  getCPSR(): number {
    return (
      ((this.N ? 1 : 0) << 31) |
      ((this.Z ? 1 : 0) << 30) |
      ((this.C ? 1 : 0) << 29) |
      ((this.V ? 1 : 0) << 28) |
      ((this.I ? 1 : 0) << 7) |
      ((this.F ? 1 : 0) << 6) |
      ((this.T ? 1 : 0) << 5) |
      (this.mode & 0x1f)
    ) >>> 0;
  }

  /** Write CPSR. If `affectMode`, mode bits switch register banks. */
  setCPSR(v: number, affectMode: boolean): void {
    this.N = !!(v & 0x80000000);
    this.Z = !!(v & 0x40000000);
    this.C = !!(v & 0x20000000);
    this.V = !!(v & 0x10000000);
    if (affectMode) {
      this.I = !!(v & 0x80);
      this.F = !!(v & 0x40);
      this.T = !!(v & 0x20);
      this.switchMode(v & 0x1f);
    }
  }

  getSPSR(): number {
    return this.spsrByMode[this.mode] ?? this.getCPSR();
  }
  setSPSR(v: number): void {
    if (this.mode !== Mode.USR && this.mode !== Mode.SYS) {
      this.spsrByMode[this.mode] = v >>> 0;
    }
  }

  private switchMode(newMode: number): void {
    if (newMode === this.mode) return;
    // R13/R14 in User and System are shared.
    const oldKey = this.mode === Mode.SYS ? Mode.USR : this.mode;
    const newKey = newMode === Mode.SYS ? Mode.USR : newMode;
    this.bankR13[oldKey] = this.regs[13];
    this.bankR14[oldKey] = this.regs[14];
    this.regs[13] = this.bankR13[newKey] ?? this.regs[13];
    this.regs[14] = this.bankR14[newKey] ?? 0;
    this.mode = newMode;
  }

  // ---- register access (PC writes flush the pipeline) --------------------

  private wreg(n: number, v: number): void {
    this.regs[n] = v >>> 0;
    if (n === 15) this.branched = true;
  }

  // ---- exceptions --------------------------------------------------------

  private exception(vector: number, newMode: number, retAddr: number): void {
    const cpsr = this.getCPSR();
    this.switchMode(newMode);
    this.setSPSR(cpsr);
    this.regs[14] = retAddr >>> 0;
    this.I = true;
    if (newMode === Mode.FIQ) this.F = true;
    this.T = false;
    this.pc = vector;
    this.branched = true;
  }

  /** Raise an IRQ from the VIC (Phase 2). Honoured only if I is clear. */
  raiseIRQ(): boolean {
    if (this.I) return false;
    // Return address for IRQ is (next instruction + 4) per ARM convention.
    this.exception(0x18, Mode.IRQ, this.pc + 4);
    return true;
  }

  // ---- main step ---------------------------------------------------------

  step(): number {
    if (this.status !== "ok") return 0;
    const addr = this.pc >>> 0;
    this.branched = false;

    if (this.T) {
      const op = this.bus.read16(addr);
      this.regs[15] = (addr + 4) >>> 0; // Thumb pipeline
      this.execThumb(op & 0xffff);
      if (!this.branched) this.pc = (addr + 2) >>> 0;
    } else {
      const op = this.bus.read32(addr);
      this.regs[15] = (addr + 8) >>> 0; // ARM pipeline
      this.execARM(op >>> 0);
      if (!this.branched) this.pc = (addr + 4) >>> 0;
    }

    if (this.branched) {
      this.pc = (this.regs[15] & (this.T ? ~1 : ~3)) >>> 0;
    }
    this.cycles++;
    return 1;
  }

  // ---- condition codes ---------------------------------------------------

  private cond(c: number): boolean {
    switch (c) {
      case 0x0: return this.Z;                       // EQ
      case 0x1: return !this.Z;                      // NE
      case 0x2: return this.C;                       // CS/HS
      case 0x3: return !this.C;                      // CC/LO
      case 0x4: return this.N;                       // MI
      case 0x5: return !this.N;                      // PL
      case 0x6: return this.V;                       // VS
      case 0x7: return !this.V;                      // VC
      case 0x8: return this.C && !this.Z;            // HI
      case 0x9: return !this.C || this.Z;            // LS
      case 0xa: return this.N === this.V;            // GE
      case 0xb: return this.N !== this.V;            // LT
      case 0xc: return !this.Z && this.N === this.V; // GT
      case 0xd: return this.Z || this.N !== this.V;  // LE
      case 0xe: return true;                         // AL
      default: return false;                         // NV (reserved)
    }
  }

  // ---- barrel shifter ----------------------------------------------------

  /** Returns shifted value; sets this.shifterCarry. */
  private shift(type: number, value: number, amount: number, immForm: boolean): number {
    value >>>= 0;
    switch (type) {
      case 0: // LSL
        if (amount === 0) {
          this.shifterCarry = this.C;
          return value;
        }
        if (amount < 32) {
          this.shifterCarry = !!((value >>> (32 - amount)) & 1);
          return (value << amount) >>> 0;
        }
        if (amount === 32) {
          this.shifterCarry = !!(value & 1);
          return 0;
        }
        this.shifterCarry = false;
        return 0;
      case 1: // LSR
        if (amount === 0) {
          if (immForm) {
            // LSR #0 encodes LSR #32
            this.shifterCarry = !!(value & 0x80000000);
            return 0;
          }
          this.shifterCarry = this.C;
          return value;
        }
        if (amount < 32) {
          this.shifterCarry = !!((value >>> (amount - 1)) & 1);
          return value >>> amount;
        }
        if (amount === 32) {
          this.shifterCarry = !!(value & 0x80000000);
          return 0;
        }
        this.shifterCarry = false;
        return 0;
      case 2: // ASR
        if (amount === 0) {
          if (immForm) amount = 32;
          else {
            this.shifterCarry = this.C;
            return value;
          }
        }
        if (amount >= 32) {
          const sign = value & 0x80000000;
          this.shifterCarry = !!sign;
          return sign ? 0xffffffff : 0;
        }
        this.shifterCarry = !!((value >> (amount - 1)) & 1);
        return (value >> amount) >>> 0;
      case 3: // ROR / RRX
        if (amount === 0) {
          if (immForm) {
            // RRX: rotate right through carry by 1
            const cin = this.C ? 0x80000000 : 0;
            this.shifterCarry = !!(value & 1);
            return (cin | (value >>> 1)) >>> 0;
          }
          this.shifterCarry = this.C;
          return value;
        }
        amount &= 31;
        if (amount === 0) {
          // amount was a multiple of 32 (register form)
          this.shifterCarry = !!(value & 0x80000000);
          return value;
        }
        this.shifterCarry = !!((value >>> (amount - 1)) & 1);
        return ((value >>> amount) | (value << (32 - amount))) >>> 0;
      default:
        this.shifterCarry = this.C;
        return value;
    }
  }

  // ---- ALU primitive -----------------------------------------------------

  /** a + b + carryIn → this.aRes/aC/aV (unsigned 32-bit + flags). */
  private addCarry(a: number, b: number, carryIn: number): void {
    a >>>= 0;
    b >>>= 0;
    const sum = a + b + carryIn;
    this.aRes = sum >>> 0;
    this.aC = sum > 0xffffffff;
    this.aV = !!((~(a ^ b) & (a ^ this.aRes)) & 0x80000000);
  }

  // ========================================================================
  //  ARM instruction execution
  // ========================================================================

  private execARM(op: number): void {
    const c = op >>> 28;
    if (!this.cond(c)) return;

    // Branch and Branch with Link (and BX via 0x12 special form below).
    // Mask 0x0e so both B (opcode 0xA) and BL (opcode 0xB, bit24=L) match.
    if ((op & 0x0e000000) === 0x0a000000) {
      // B / BL
      let off = op & 0x00ffffff;
      if (off & 0x00800000) off |= 0xff000000; // sign extend
      off = (off << 2) >> 0;
      if (op & 0x01000000) this.regs[14] = (this.pc + 4) >>> 0; // BL: LR = next
      this.wreg(15, (this.regs[15] + off) >>> 0);
      return;
    }

    // BX / BLX(reg): 0001 0010 ... 0001 Rn  (and 0x12fff31 for BLX)
    if ((op & 0x0ffffff0) === 0x012fff10 || (op & 0x0ffffff0) === 0x012fff30) {
      const blx = (op & 0xf0) === 0x30;
      const rn = op & 0xf;
      const target = this.regs[rn] >>> 0;
      if (blx) this.regs[14] = (this.pc + 4) >>> 0;
      this.T = !!(target & 1);
      this.wreg(15, target & ~1);
      return;
    }

    // Multiply: bits 27-22 == 000000, bits 7-4 == 1001
    if ((op & 0x0fc000f0) === 0x00000090) {
      this.armMultiply(op);
      return;
    }
    // Multiply long: bits 27-23 == 00001, bits 7-4 == 1001
    if ((op & 0x0f8000f0) === 0x00800090) {
      this.armMultiplyLong(op);
      return;
    }

    // Halfword / signed byte transfer: bit25=0, bit7=1, bit4=1, and bits 6-5 != 00
    if ((op & 0x0e000090) === 0x00000090 && (op & 0x60) !== 0) {
      this.armHalfwordTransfer(op);
      return;
    }

    // PSR transfer (MRS/MSR) — must be checked before data processing because
    // it shares the DP encoding space (opcodes TST/TEQ/CMP/CMN with S=0).
    if ((op & 0x0fbf0fff) === 0x010f0000) {
      // MRS Rd, CPSR/SPSR
      const rd = (op >>> 12) & 0xf;
      const useSpsr = !!(op & 0x00400000);
      this.regs[rd] = useSpsr ? this.getSPSR() : this.getCPSR();
      return;
    }
    if ((op & 0x0db0f000) === 0x0120f000) {
      this.armMSR(op);
      return;
    }

    const cls = (op >>> 26) & 0x3;
    if (cls === 0x0) {
      this.armDataProcessing(op);
      return;
    }
    if (cls === 0x1) {
      this.armSingleDataTransfer(op);
      return;
    }
    if (cls === 0x2) {
      this.armBlockTransfer(op);
      return;
    }
    if (cls === 0x3) {
      if ((op & 0x0f000000) === 0x0f000000) {
        // SWI / SVC
        this.exception(0x08, Mode.SVC, this.pc + 4);
        return;
      }
      // Coprocessor ops (CDP/LDC/STC/MCR/MRC) — not present on LPC2148 use; ignore.
      return;
    }
  }

  private armDataProcessing(op: number): void {
    const opcode = (op >>> 21) & 0xf;
    const setFlags = !!(op & 0x00100000);
    const rn = (op >>> 16) & 0xf;
    const rd = (op >>> 12) & 0xf;
    const immediate = !!(op & 0x02000000);

    let operand2: number;
    if (immediate) {
      const imm = op & 0xff;
      const rot = ((op >>> 8) & 0xf) * 2;
      if (rot === 0) {
        operand2 = imm;
        this.shifterCarry = this.C;
      } else {
        operand2 = ((imm >>> rot) | (imm << (32 - rot))) >>> 0;
        this.shifterCarry = !!(operand2 & 0x80000000);
      }
    } else {
      const rm = op & 0xf;
      const shiftType = (op >>> 5) & 0x3;
      let amount: number;
      let rmVal = this.regs[rm] >>> 0;
      if (op & 0x10) {
        // register-specified shift: Rs bottom byte; Rm/Rn read as PC+12
        const rs = (op >>> 8) & 0xf;
        amount = this.regs[rs] & 0xff;
        if (rm === 15) rmVal = (this.regs[15] + 4) >>> 0;
        operand2 = this.shift(shiftType, rmVal, amount, false);
      } else {
        amount = (op >>> 7) & 0x1f;
        operand2 = this.shift(shiftType, rmVal, amount, true);
      }
    }

    let rnVal = this.regs[rn] >>> 0;
    // If a register shift bumped R15 read, Rn==15 also reads PC+12.
    if (rn === 15 && !immediate && op & 0x10) rnVal = (this.regs[15] + 4) >>> 0;

    let result = 0;
    let writeResult = true;
    let logical = false;

    switch (opcode) {
      case 0x0: result = rnVal & operand2; logical = true; break; // AND
      case 0x1: result = (rnVal ^ operand2) >>> 0; logical = true; break; // EOR
      case 0x2: this.addCarry(rnVal, ~operand2 >>> 0, 1); result = this.aRes; break; // SUB
      case 0x3: this.addCarry(~rnVal >>> 0, operand2, 1); result = this.aRes; break; // RSB
      case 0x4: this.addCarry(rnVal, operand2, 0); result = this.aRes; break; // ADD
      case 0x5: this.addCarry(rnVal, operand2, this.C ? 1 : 0); result = this.aRes; break; // ADC
      case 0x6: this.addCarry(rnVal, ~operand2 >>> 0, this.C ? 1 : 0); result = this.aRes; break; // SBC
      case 0x7: this.addCarry(~rnVal >>> 0, operand2, this.C ? 1 : 0); result = this.aRes; break; // RSC
      case 0x8: result = rnVal & operand2; logical = true; writeResult = false; break; // TST
      case 0x9: result = (rnVal ^ operand2) >>> 0; logical = true; writeResult = false; break; // TEQ
      case 0xa: this.addCarry(rnVal, ~operand2 >>> 0, 1); result = this.aRes; writeResult = false; break; // CMP
      case 0xb: this.addCarry(rnVal, operand2, 0); result = this.aRes; writeResult = false; break; // CMN
      case 0xc: result = (rnVal | operand2) >>> 0; logical = true; break; // ORR
      case 0xd: result = operand2; logical = true; break; // MOV
      case 0xe: result = (rnVal & ~operand2) >>> 0; logical = true; break; // BIC
      case 0xf: result = (~operand2) >>> 0; logical = true; break; // MVN
    }

    if (writeResult) this.wreg(rd, result);

    if (setFlags) {
      if (rd === 15 && writeResult) {
        // e.g. MOVS PC, LR — return from exception: CPSR ← SPSR
        this.setCPSR(this.getSPSR(), true);
      } else {
        this.N = !!(result & 0x80000000);
        this.Z = (result >>> 0) === 0;
        if (logical) {
          this.C = this.shifterCarry;
        } else {
          this.C = this.aC;
          this.V = this.aV;
        }
      }
    }
  }

  private armMSR(op: number): void {
    const useSpsr = !!(op & 0x00400000);
    const fieldMask = (op >>> 16) & 0xf;
    let value: number;
    if (op & 0x02000000) {
      const imm = op & 0xff;
      const rot = ((op >>> 8) & 0xf) * 2;
      value = rot === 0 ? imm : (((imm >>> rot) | (imm << (32 - rot))) >>> 0);
    } else {
      value = this.regs[op & 0xf] >>> 0;
    }
    const cur = useSpsr ? this.getSPSR() : this.getCPSR();
    let mask = 0;
    if (fieldMask & 0x1) mask |= 0x000000ff; // control (mode, I, F, T)
    if (fieldMask & 0x2) mask |= 0x0000ff00;
    if (fieldMask & 0x4) mask |= 0x00ff0000;
    if (fieldMask & 0x8) mask |= 0xff000000; // flags
    // In User mode only the flags field is writable.
    if (this.mode === Mode.USR) mask &= 0xff000000;
    const next = ((cur & ~mask) | (value & mask)) >>> 0;
    if (useSpsr) this.setSPSR(next);
    else this.setCPSR(next, (mask & 0xff) !== 0);
  }

  private armMultiply(op: number): void {
    const rd = (op >>> 16) & 0xf;
    const rn = (op >>> 12) & 0xf;
    const rs = (op >>> 8) & 0xf;
    const rm = op & 0xf;
    const accumulate = !!(op & 0x00200000);
    let result = Math.imul(this.regs[rm] | 0, this.regs[rs] | 0) >>> 0;
    if (accumulate) result = (result + this.regs[rn]) >>> 0;
    this.regs[rd] = result;
    if (op & 0x00100000) {
      this.N = !!(result & 0x80000000);
      this.Z = result === 0;
    }
  }

  private armMultiplyLong(op: number): void {
    const rdHi = (op >>> 16) & 0xf;
    const rdLo = (op >>> 12) & 0xf;
    const rs = (op >>> 8) & 0xf;
    const rm = op & 0xf;
    const signed = !!(op & 0x00400000);
    const accumulate = !!(op & 0x00200000);
    const a = BigInt(this.regs[rm] >>> 0);
    const b = BigInt(this.regs[rs] >>> 0);
    let product: bigint;
    if (signed) {
      product = BigInt(this.regs[rm] | 0) * BigInt(this.regs[rs] | 0);
    } else {
      product = a * b;
    }
    if (accumulate) {
      const acc = (BigInt(this.regs[rdHi] >>> 0) << 32n) | BigInt(this.regs[rdLo] >>> 0);
      product += acc;
    }
    const mask = (1n << 64n) - 1n;
    product &= mask;
    this.regs[rdLo] = Number(product & 0xffffffffn) >>> 0;
    this.regs[rdHi] = Number((product >> 32n) & 0xffffffffn) >>> 0;
    if (op & 0x00100000) {
      this.N = !!(this.regs[rdHi] & 0x80000000);
      this.Z = this.regs[rdHi] === 0 && this.regs[rdLo] === 0;
    }
  }

  private armSingleDataTransfer(op: number): void {
    const immediateOffset = !(op & 0x02000000); // I bit: 0 = immediate
    const pre = !!(op & 0x01000000);
    const up = !!(op & 0x00800000);
    const byte = !!(op & 0x00400000);
    const writeback = !!(op & 0x00200000);
    const load = !!(op & 0x00100000);
    const rn = (op >>> 16) & 0xf;
    const rd = (op >>> 12) & 0xf;

    let offset: number;
    if (immediateOffset) {
      offset = op & 0xfff;
    } else {
      const rm = op & 0xf;
      const shiftType = (op >>> 5) & 0x3;
      const amount = (op >>> 7) & 0x1f;
      offset = this.shift(shiftType, this.regs[rm] >>> 0, amount, true);
    }

    let base = this.regs[rn] >>> 0;
    const offsetAddr = (up ? base + offset : base - offset) >>> 0;
    const addr = pre ? offsetAddr : base;

    if (load) {
      let value: number;
      if (byte) {
        value = this.bus.read8(addr);
      } else {
        const w = this.bus.read32(addr & ~3);
        const rot = (addr & 3) * 8;
        value = rot === 0 ? w : ((w >>> rot) | (w << (32 - rot))) >>> 0;
      }
      // writeback (post-index always writes back; pre-index when W set)
      if (!pre || writeback) this.regs[rn] = offsetAddr;
      this.wreg(rd, value);
    } else {
      let value = this.regs[rd] >>> 0;
      if (rd === 15) value = (this.pc + 8) >>> 0; // stored PC is +12 on ARM7
      if (byte) this.bus.write8(addr, value & 0xff);
      else this.bus.write32(addr & ~3, value);
      if (!pre || writeback) this.regs[rn] = offsetAddr;
    }
  }

  private armHalfwordTransfer(op: number): void {
    const pre = !!(op & 0x01000000);
    const up = !!(op & 0x00800000);
    const immediate = !!(op & 0x00400000);
    const writeback = !!(op & 0x00200000);
    const load = !!(op & 0x00100000);
    const rn = (op >>> 16) & 0xf;
    const rd = (op >>> 12) & 0xf;
    const sh = (op >>> 5) & 0x3;

    const offset = immediate
      ? ((op >>> 4) & 0xf0) | (op & 0xf)
      : this.regs[op & 0xf] >>> 0;

    const base = this.regs[rn] >>> 0;
    const offsetAddr = (up ? base + offset : base - offset) >>> 0;
    const addr = pre ? offsetAddr : base;

    if (load) {
      let value: number;
      switch (sh) {
        case 1: // LDRH
          value = this.bus.read16(addr & ~1);
          break;
        case 2: // LDRSB
          value = this.bus.read8(addr);
          if (value & 0x80) value |= 0xffffff00;
          break;
        case 3: // LDRSH
          value = this.bus.read16(addr & ~1);
          if (value & 0x8000) value |= 0xffff0000;
          break;
        default:
          value = 0;
      }
      if (!pre || writeback) this.regs[rn] = offsetAddr;
      this.wreg(rd, value >>> 0);
    } else {
      // STRH (signed stores are not defined for ARM7)
      this.bus.write16(addr & ~1, this.regs[rd] & 0xffff);
      if (!pre || writeback) this.regs[rn] = offsetAddr;
    }
  }

  private armBlockTransfer(op: number): void {
    const pre = !!(op & 0x01000000);
    const up = !!(op & 0x00800000);
    const sBit = !!(op & 0x00400000);
    const writeback = !!(op & 0x00200000);
    const load = !!(op & 0x00100000);
    const rn = (op >>> 16) & 0xf;
    const list = op & 0xffff;

    const count = popcount(list);
    let base = this.regs[rn] >>> 0;
    // Lowest register always occupies the lowest address. Compute the start.
    let addr: number;
    if (up) addr = pre ? base + 4 : base;
    else addr = pre ? base - count * 4 : base - count * 4 + 4;
    const finalBase = up ? base + count * 4 : base - count * 4;

    const transferUser = sBit && !(load && list & 0x8000);
    const savedMode = this.mode;
    if (transferUser && this.mode !== Mode.USR && this.mode !== Mode.SYS) {
      // S-bit block transfer uses the User-mode bank for R13/R14.
      this.switchMode(Mode.USR);
    }

    if (load) {
      for (let i = 0; i < 16; i++) {
        if (list & (1 << i)) {
          const v = this.bus.read32(addr & ~3);
          if (i === 15) {
            this.T = !!(v & 1);
            this.wreg(15, v & ~1);
            if (sBit) this.setCPSR(this.getSPSR(), true); // exception return
          } else {
            this.regs[i] = v;
          }
          addr = (addr + 4) >>> 0;
        }
      }
    } else {
      let first = true;
      for (let i = 0; i < 16; i++) {
        if (list & (1 << i)) {
          let v = this.regs[i] >>> 0;
          if (i === 15) v = (this.pc + 8) >>> 0;
          // Storing the base register: if it's the first in the list, the
          // original value is stored; otherwise the written-back value.
          if (i === rn && !first && writeback) v = finalBase;
          this.bus.write32(addr & ~3, v);
          addr = (addr + 4) >>> 0;
          first = false;
        }
      }
    }

    if (transferUser && savedMode !== this.mode) this.switchMode(savedMode);
    if (writeback) this.regs[rn] = finalBase >>> 0;
  }

  // ========================================================================
  //  Thumb instruction execution (ARMv4T)
  // ========================================================================

  private execThumb(op: number): void {
    if ((op & 0xf800) === 0x1800) {
      this.thumbAddSub(op); // Format 2
      return;
    }
    if ((op & 0xe000) === 0x0000) {
      this.thumbMoveShifted(op); // Format 1
      return;
    }
    if ((op & 0xe000) === 0x2000) {
      this.thumbImmediate(op); // Format 3
      return;
    }
    if ((op & 0xfc00) === 0x4000) {
      this.thumbALU(op); // Format 4
      return;
    }
    if ((op & 0xfc00) === 0x4400) {
      this.thumbHiReg(op); // Format 5
      return;
    }
    if ((op & 0xf800) === 0x4800) {
      this.thumbPcLoad(op); // Format 6
      return;
    }
    if ((op & 0xf200) === 0x5000) {
      this.thumbLoadStoreReg(op); // Format 7
      return;
    }
    if ((op & 0xf200) === 0x5200) {
      this.thumbLoadStoreSignExt(op); // Format 8
      return;
    }
    if ((op & 0xe000) === 0x6000) {
      this.thumbLoadStoreImm(op); // Format 9
      return;
    }
    if ((op & 0xf000) === 0x8000) {
      this.thumbLoadStoreHalf(op); // Format 10
      return;
    }
    if ((op & 0xf000) === 0x9000) {
      this.thumbSpLoadStore(op); // Format 11
      return;
    }
    if ((op & 0xf000) === 0xa000) {
      this.thumbLoadAddress(op); // Format 12
      return;
    }
    if ((op & 0xff00) === 0xb000) {
      this.thumbAddSp(op); // Format 13
      return;
    }
    if ((op & 0xf600) === 0xb400) {
      this.thumbPushPop(op); // Format 14
      return;
    }
    if ((op & 0xf000) === 0xc000) {
      this.thumbBlockTransfer(op); // Format 15
      return;
    }
    if ((op & 0xff00) === 0xdf00) {
      this.exception(0x08, Mode.SVC, this.pc + 2); // SWI (Format 17)
      return;
    }
    if ((op & 0xf000) === 0xd000) {
      this.thumbCondBranch(op); // Format 16
      return;
    }
    if ((op & 0xf800) === 0xe000) {
      this.thumbBranch(op); // Format 18
      return;
    }
    if ((op & 0xf000) === 0xf000) {
      this.thumbLongBranch(op); // Format 19
      return;
    }
    this.status = "undefined";
  }

  private setNZ(result: number): void {
    this.N = !!(result & 0x80000000);
    this.Z = (result >>> 0) === 0;
  }

  private thumbMoveShifted(op: number): void {
    const type = (op >>> 11) & 0x3; // 0 LSL, 1 LSR, 2 ASR
    const amount = (op >>> 6) & 0x1f;
    const rs = (op >>> 3) & 0x7;
    const rd = op & 0x7;
    const result = this.shift(type, this.regs[rs] >>> 0, amount, true);
    this.regs[rd] = result;
    this.setNZ(result);
    this.C = this.shifterCarry;
  }

  private thumbAddSub(op: number): void {
    const immFlag = !!(op & 0x0400);
    const sub = !!(op & 0x0200);
    const rnImm = (op >>> 6) & 0x7;
    const rs = (op >>> 3) & 0x7;
    const rd = op & 0x7;
    const a = this.regs[rs] >>> 0;
    const b = immFlag ? rnImm : this.regs[rnImm] >>> 0;
    if (sub) this.addCarry(a, ~b >>> 0, 1);
    else this.addCarry(a, b, 0);
    this.regs[rd] = this.aRes;
    this.setNZ(this.aRes);
    this.C = this.aC;
    this.V = this.aV;
  }

  private thumbImmediate(op: number): void {
    const sub = (op >>> 11) & 0x3; // 0 MOV, 1 CMP, 2 ADD, 3 SUB
    const rd = (op >>> 8) & 0x7;
    const imm = op & 0xff;
    const rdVal = this.regs[rd] >>> 0;
    switch (sub) {
      case 0:
        this.regs[rd] = imm;
        this.setNZ(imm);
        break;
      case 1:
        this.addCarry(rdVal, ~imm >>> 0, 1);
        this.setNZ(this.aRes);
        this.C = this.aC;
        this.V = this.aV;
        break;
      case 2:
        this.addCarry(rdVal, imm, 0);
        this.regs[rd] = this.aRes;
        this.setNZ(this.aRes);
        this.C = this.aC;
        this.V = this.aV;
        break;
      case 3:
        this.addCarry(rdVal, ~imm >>> 0, 1);
        this.regs[rd] = this.aRes;
        this.setNZ(this.aRes);
        this.C = this.aC;
        this.V = this.aV;
        break;
    }
  }

  private thumbALU(op: number): void {
    const code = (op >>> 6) & 0xf;
    const rs = (op >>> 3) & 0x7;
    const rd = op & 0x7;
    const a = this.regs[rd] >>> 0;
    const b = this.regs[rs] >>> 0;
    let result: number;
    switch (code) {
      case 0x0: result = a & b; this.regs[rd] = result; this.setNZ(result); break; // AND
      case 0x1: result = (a ^ b) >>> 0; this.regs[rd] = result; this.setNZ(result); break; // EOR
      case 0x2: result = this.shift(0, a, b & 0xff, false); this.regs[rd] = result; this.setNZ(result); this.C = this.shifterCarry; break; // LSL
      case 0x3: result = this.shift(1, a, b & 0xff, false); this.regs[rd] = result; this.setNZ(result); this.C = this.shifterCarry; break; // LSR
      case 0x4: result = this.shift(2, a, b & 0xff, false); this.regs[rd] = result; this.setNZ(result); this.C = this.shifterCarry; break; // ASR
      case 0x5: this.addCarry(a, b, this.C ? 1 : 0); result = this.aRes; this.regs[rd] = result; this.setNZ(result); this.C = this.aC; this.V = this.aV; break; // ADC
      case 0x6: this.addCarry(a, ~b >>> 0, this.C ? 1 : 0); result = this.aRes; this.regs[rd] = result; this.setNZ(result); this.C = this.aC; this.V = this.aV; break; // SBC
      case 0x7: result = this.shift(3, a, b & 0xff, false); this.regs[rd] = result; this.setNZ(result); this.C = this.shifterCarry; break; // ROR
      case 0x8: result = a & b; this.setNZ(result); break; // TST
      case 0x9: this.addCarry(0, ~b >>> 0, 1); result = this.aRes; this.regs[rd] = result; this.setNZ(result); this.C = this.aC; this.V = this.aV; break; // NEG
      case 0xa: this.addCarry(a, ~b >>> 0, 1); this.setNZ(this.aRes); this.C = this.aC; this.V = this.aV; break; // CMP
      case 0xb: this.addCarry(a, b, 0); this.setNZ(this.aRes); this.C = this.aC; this.V = this.aV; break; // CMN
      case 0xc: result = (a | b) >>> 0; this.regs[rd] = result; this.setNZ(result); break; // ORR
      case 0xd: result = Math.imul(a | 0, b | 0) >>> 0; this.regs[rd] = result; this.setNZ(result); break; // MUL
      case 0xe: result = (a & ~b) >>> 0; this.regs[rd] = result; this.setNZ(result); break; // BIC
      case 0xf: result = (~b) >>> 0; this.regs[rd] = result; this.setNZ(result); break; // MVN
    }
  }

  private thumbHiReg(op: number): void {
    const code = (op >>> 8) & 0x3;
    const h1 = (op >>> 7) & 1;
    const h2 = (op >>> 6) & 1;
    const rs = ((op >>> 3) & 0x7) | (h2 << 3);
    const rd = (op & 0x7) | (h1 << 3);
    const rsVal = rs === 15 ? (this.regs[15] >>> 0) : this.regs[rs] >>> 0;
    switch (code) {
      case 0: // ADD (no flags)
        this.wreg(rd, (this.regs[rd] + rsVal) >>> 0);
        break;
      case 1: { // CMP (flags)
        this.addCarry(this.regs[rd] >>> 0, ~rsVal >>> 0, 1);
        this.setNZ(this.aRes);
        this.C = this.aC;
        this.V = this.aV;
        break;
      }
      case 2: // MOV (no flags)
        this.wreg(rd, rsVal);
        break;
      case 3: { // BX / BLX
        if (h1) this.regs[14] = (this.pc + 2) | 1; // BLX (ARMv5; harmless here)
        this.T = !!(rsVal & 1);
        this.wreg(15, rsVal & ~1);
        break;
      }
    }
  }

  private thumbPcLoad(op: number): void {
    const rd = (op >>> 8) & 0x7;
    const imm = (op & 0xff) << 2;
    const base = (this.regs[15] & ~3) >>> 0; // PC is word-aligned for this
    this.regs[rd] = this.bus.read32((base + imm) >>> 0);
  }

  private thumbLoadStoreReg(op: number): void {
    const load = !!(op & 0x0800);
    const byte = !!(op & 0x0400);
    const ro = (op >>> 6) & 0x7;
    const rb = (op >>> 3) & 0x7;
    const rd = op & 0x7;
    const addr = (this.regs[rb] + this.regs[ro]) >>> 0;
    if (load) {
      this.regs[rd] = byte ? this.bus.read8(addr) : this.bus.read32(addr & ~3);
    } else {
      if (byte) this.bus.write8(addr, this.regs[rd] & 0xff);
      else this.bus.write32(addr & ~3, this.regs[rd] >>> 0);
    }
  }

  private thumbLoadStoreSignExt(op: number): void {
    const hFlag = !!(op & 0x0800);
    const signExt = !!(op & 0x0400);
    const ro = (op >>> 6) & 0x7;
    const rb = (op >>> 3) & 0x7;
    const rd = op & 0x7;
    const addr = (this.regs[rb] + this.regs[ro]) >>> 0;
    if (!signExt && !hFlag) {
      this.bus.write16(addr & ~1, this.regs[rd] & 0xffff); // STRH
    } else if (!signExt && hFlag) {
      this.regs[rd] = this.bus.read16(addr & ~1); // LDRH
    } else if (signExt && !hFlag) {
      let v = this.bus.read8(addr); // LDRSB
      if (v & 0x80) v |= 0xffffff00;
      this.regs[rd] = v >>> 0;
    } else {
      let v = this.bus.read16(addr & ~1); // LDRSH
      if (v & 0x8000) v |= 0xffff0000;
      this.regs[rd] = v >>> 0;
    }
  }

  private thumbLoadStoreImm(op: number): void {
    const byte = !!(op & 0x1000);
    const load = !!(op & 0x0800);
    let offset = (op >>> 6) & 0x1f;
    const rb = (op >>> 3) & 0x7;
    const rd = op & 0x7;
    if (!byte) offset <<= 2;
    const addr = (this.regs[rb] + offset) >>> 0;
    if (load) {
      this.regs[rd] = byte ? this.bus.read8(addr) : this.bus.read32(addr & ~3);
    } else {
      if (byte) this.bus.write8(addr, this.regs[rd] & 0xff);
      else this.bus.write32(addr & ~3, this.regs[rd] >>> 0);
    }
  }

  private thumbLoadStoreHalf(op: number): void {
    const load = !!(op & 0x0800);
    const offset = ((op >>> 6) & 0x1f) << 1;
    const rb = (op >>> 3) & 0x7;
    const rd = op & 0x7;
    const addr = (this.regs[rb] + offset) >>> 0;
    if (load) this.regs[rd] = this.bus.read16(addr & ~1);
    else this.bus.write16(addr & ~1, this.regs[rd] & 0xffff);
  }

  private thumbSpLoadStore(op: number): void {
    const load = !!(op & 0x0800);
    const rd = (op >>> 8) & 0x7;
    const offset = (op & 0xff) << 2;
    const addr = (this.regs[13] + offset) >>> 0;
    if (load) this.regs[rd] = this.bus.read32(addr & ~3);
    else this.bus.write32(addr & ~3, this.regs[rd] >>> 0);
  }

  private thumbLoadAddress(op: number): void {
    const sp = !!(op & 0x0800);
    const rd = (op >>> 8) & 0x7;
    const offset = (op & 0xff) << 2;
    const base = sp ? this.regs[13] >>> 0 : (this.regs[15] & ~3) >>> 0;
    this.regs[rd] = (base + offset) >>> 0;
  }

  private thumbAddSp(op: number): void {
    const offset = (op & 0x7f) << 2;
    if (op & 0x0080) this.regs[13] = (this.regs[13] - offset) >>> 0;
    else this.regs[13] = (this.regs[13] + offset) >>> 0;
  }

  private thumbPushPop(op: number): void {
    const load = !!(op & 0x0800); // POP
    const pcLr = !!(op & 0x0100);
    const list = op & 0xff;
    let sp = this.regs[13] >>> 0;
    if (load) {
      for (let i = 0; i < 8; i++) {
        if (list & (1 << i)) {
          this.regs[i] = this.bus.read32(sp & ~3);
          sp = (sp + 4) >>> 0;
        }
      }
      if (pcLr) {
        const v = this.bus.read32(sp & ~3);
        sp = (sp + 4) >>> 0;
        this.T = !!(v & 1);
        this.wreg(15, v & ~1);
      }
      this.regs[13] = sp;
    } else {
      // PUSH: count first to pre-decrement
      let count = popcount(list) + (pcLr ? 1 : 0);
      sp = (sp - count * 4) >>> 0;
      let addr = sp;
      for (let i = 0; i < 8; i++) {
        if (list & (1 << i)) {
          this.bus.write32(addr & ~3, this.regs[i] >>> 0);
          addr = (addr + 4) >>> 0;
        }
      }
      if (pcLr) this.bus.write32(addr & ~3, this.regs[14] >>> 0);
      this.regs[13] = sp;
    }
  }

  private thumbBlockTransfer(op: number): void {
    const load = !!(op & 0x0800);
    const rb = (op >>> 8) & 0x7;
    const list = op & 0xff;
    let addr = this.regs[rb] >>> 0;
    if (list === 0) {
      // Empty list: ARM7 transfers PC and increments base by 0x40 (edge case).
      if (load) this.wreg(15, this.bus.read32(addr & ~3));
      else this.bus.write32(addr & ~3, (this.pc + 4) >>> 0);
      this.regs[rb] = (addr + 0x40) >>> 0;
      return;
    }
    for (let i = 0; i < 8; i++) {
      if (list & (1 << i)) {
        if (load) this.regs[i] = this.bus.read32(addr & ~3);
        else this.bus.write32(addr & ~3, this.regs[i] >>> 0);
        addr = (addr + 4) >>> 0;
      }
    }
    this.regs[rb] = addr >>> 0;
  }

  private thumbCondBranch(op: number): void {
    const c = (op >>> 8) & 0xf;
    if (!this.cond(c)) return;
    let off = op & 0xff;
    if (off & 0x80) off |= 0xffffff00;
    off = (off << 1) >> 0;
    this.wreg(15, (this.regs[15] + off) >>> 0);
  }

  private thumbBranch(op: number): void {
    let off = op & 0x7ff;
    if (off & 0x400) off |= 0xfffff800;
    off = (off << 1) >> 0;
    this.wreg(15, (this.regs[15] + off) >>> 0);
  }

  /** Format 19: 32-bit BL split across two 16-bit halves. */
  private thumbLongBranch(op: number): void {
    const high = !!(op & 0x0800);
    if (!high) {
      // First half: LR = PC + (signed offset_high << 12)
      let off = op & 0x7ff;
      if (off & 0x400) off |= 0xfffff800;
      this.regs[14] = (this.regs[15] + (off << 12)) >>> 0;
    } else {
      // Second half: target = LR + (offset_low << 1); LR = return | 1
      const next = (this.pc + 2) >>> 0;
      const target = (this.regs[14] + ((op & 0x7ff) << 1)) >>> 0;
      this.regs[14] = next | 1;
      this.wreg(15, target);
    }
  }
}

function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (Math.imul(x, 0x01010101) >>> 24) & 0xff;
}
