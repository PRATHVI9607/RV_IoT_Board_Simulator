/**
 * Lightweight ARM7TDMI disassembler for the debugger's disassembly view.
 * Covers the instruction groups LOKI-SIM executes; anything unrecognised is
 * shown as a DCD/DCW data word so the listing never lies about an address.
 */

const COND = [
  "EQ", "NE", "CS", "CC", "MI", "PL", "VS", "VC",
  "HI", "LS", "GE", "LT", "GT", "LE", "", "NV",
];
const DP_OPS = [
  "AND", "EOR", "SUB", "RSB", "ADD", "ADC", "SBC", "RSC",
  "TST", "TEQ", "CMP", "CMN", "ORR", "MOV", "BIC", "MVN",
];
const SHIFT = ["LSL", "LSR", "ASR", "ROR"];
const REG = (n: number) => (n === 13 ? "SP" : n === 14 ? "LR" : n === 15 ? "PC" : `R${n}`);

function hx(v: number): string {
  return "0x" + (v >>> 0).toString(16).toUpperCase();
}

function regList(list: number): string {
  const parts: string[] = [];
  let i = 0;
  while (i < 16) {
    if (list & (1 << i)) {
      let j = i;
      while (j + 1 < 16 && list & (1 << (j + 1))) j++;
      parts.push(j > i ? `${REG(i)}-${REG(j)}` : REG(i));
      i = j + 1;
    } else i++;
  }
  return "{" + parts.join(", ") + "}";
}

export function disassembleARM(op: number, addr: number): string {
  op >>>= 0;
  const c = COND[op >>> 28];

  if ((op & 0x0ffffff0) === 0x012fff10) return `BX${c}    ${REG(op & 0xf)}`;

  if ((op & 0x0e000000) === 0x0a000000) {
    let off = op & 0x00ffffff;
    if (off & 0x00800000) off |= 0xff000000;
    const target = (addr + 8 + (off << 2)) >>> 0;
    return `${op & 0x01000000 ? "BL" : "B"}${c}    ${hx(target)}`;
  }

  if ((op & 0x0fc000f0) === 0x00000090) {
    const rd = (op >>> 16) & 0xf, rs = (op >>> 8) & 0xf, rm = op & 0xf, rn = (op >>> 12) & 0xf;
    return op & 0x00200000
      ? `MLA${c}   ${REG(rd)}, ${REG(rm)}, ${REG(rs)}, ${REG(rn)}`
      : `MUL${c}   ${REG(rd)}, ${REG(rm)}, ${REG(rs)}`;
  }

  if ((op & 0x0fbf0fff) === 0x010f0000) {
    const rd = (op >>> 12) & 0xf;
    return `MRS${c}   ${REG(rd)}, ${op & 0x00400000 ? "SPSR" : "CPSR"}`;
  }
  if ((op & 0x0db0f000) === 0x0120f000) {
    return `MSR${c}   ${op & 0x00400000 ? "SPSR" : "CPSR"}, ...`;
  }

  if ((op & 0x0f000000) === 0x0f000000) return `SWI${c}   ${hx(op & 0x00ffffff)}`;

  // Single data transfer
  if ((op & 0x0c000000) === 0x04000000) {
    const load = op & 0x00100000 ? "LDR" : "STR";
    const b = op & 0x00400000 ? "B" : "";
    const rd = (op >>> 12) & 0xf, rn = (op >>> 16) & 0xf;
    const up = op & 0x00800000 ? "" : "-";
    if (!(op & 0x02000000)) {
      const imm = op & 0xfff;
      const addr2 = op & 0x01000000
        ? `[${REG(rn)}, #${up}${imm}]${op & 0x00200000 ? "!" : ""}`
        : `[${REG(rn)}], #${up}${imm}`;
      return `${load}${c}${b}  ${REG(rd)}, ${addr2}`;
    }
    return `${load}${c}${b}  ${REG(rd)}, [${REG(rn)}, ${REG(op & 0xf)}]`;
  }

  // Block data transfer
  if ((op & 0x0e000000) === 0x08000000) {
    const load = op & 0x00100000;
    const rn = (op >>> 16) & 0xf;
    const wb = op & 0x00200000 ? "!" : "";
    if (rn === 13) {
      return `${load ? "POP" : "PUSH"}${c}  ${regList(op & 0xffff)}`;
    }
    const mode = (op & 0x01000000 ? "I" : "D") + (op & 0x00800000 ? "B" : "A"); // approx
    return `${load ? "LDM" : "STM"}${c}${mode} ${REG(rn)}${wb}, ${regList(op & 0xffff)}`;
  }

  // Data processing
  if ((op & 0x0c000000) === 0x00000000) {
    const opcode = (op >>> 21) & 0xf;
    const s = op & 0x00100000 ? "S" : "";
    const rn = (op >>> 16) & 0xf, rd = (op >>> 12) & 0xf;
    let operand: string;
    if (op & 0x02000000) {
      const imm = op & 0xff;
      const rot = ((op >>> 8) & 0xf) * 2;
      operand = `#${rot ? ((imm >>> rot) | (imm << (32 - rot))) >>> 0 : imm}`;
    } else {
      const rm = op & 0xf;
      const type = (op >>> 5) & 0x3;
      if (op & 0x10) operand = `${REG(rm)}, ${SHIFT[type]} ${REG((op >>> 8) & 0xf)}`;
      else {
        const amt = (op >>> 7) & 0x1f;
        operand = amt || type ? `${REG(rm)}, ${SHIFT[type]} #${amt}` : REG(rm);
      }
    }
    const name = DP_OPS[opcode] + s + c;
    if (opcode >= 0x8 && opcode <= 0xb) return `${pad(DP_OPS[opcode] + c)} ${REG(rn)}, ${operand}`;
    if (opcode === 0xd || opcode === 0xf) return `${pad(name)} ${REG(rd)}, ${operand}`;
    return `${pad(name)} ${REG(rd)}, ${REG(rn)}, ${operand}`;
  }

  return `DCD   ${hx(op)}`;
}

export function disassembleThumb(op: number, addr: number): string {
  op &= 0xffff;

  if ((op & 0xf800) === 0x1800) {
    const sub = op & 0x0200 ? "SUB" : "ADD";
    const imm = op & 0x0400;
    const val = (op >>> 6) & 0x7;
    return `${sub}   ${REG(op & 7)}, ${REG((op >>> 3) & 7)}, ${imm ? "#" + val : REG(val)}`;
  }
  if ((op & 0xe000) === 0x0000) {
    const t = (op >>> 11) & 0x3;
    return `${SHIFT[t]}   ${REG(op & 7)}, ${REG((op >>> 3) & 7)}, #${(op >>> 6) & 0x1f}`;
  }
  if ((op & 0xe000) === 0x2000) {
    const ops = ["MOV", "CMP", "ADD", "SUB"];
    return `${ops[(op >>> 11) & 3]}   ${REG((op >>> 8) & 7)}, #${op & 0xff}`;
  }
  if ((op & 0xfc00) === 0x4000) {
    const alu = ["AND", "EOR", "LSL", "LSR", "ASR", "ADC", "SBC", "ROR",
      "TST", "NEG", "CMP", "CMN", "ORR", "MUL", "BIC", "MVN"];
    return `${pad(alu[(op >>> 6) & 0xf])} ${REG(op & 7)}, ${REG((op >>> 3) & 7)}`;
  }
  if ((op & 0xfc00) === 0x4400) {
    const code = (op >>> 8) & 0x3;
    const rd = (op & 7) | ((op >>> 4) & 0x8);
    const rs = ((op >>> 3) & 7) | ((op >>> 3) & 0x8);
    if (code === 3) return `BX    ${REG(rs)}`;
    return `${["ADD", "CMP", "MOV"][code]}   ${REG(rd)}, ${REG(rs)}`;
  }
  if ((op & 0xf800) === 0x4800) {
    return `LDR   ${REG((op >>> 8) & 7)}, [PC, #${(op & 0xff) << 2}]`;
  }
  if ((op & 0xf000) === 0x6000) {
    const load = op & 0x0800 ? "LDR" : "STR";
    const b = op & 0x1000 ? "B" : "";
    const off = ((op >>> 6) & 0x1f) << (op & 0x1000 ? 0 : 2);
    return `${load}${b}  ${REG(op & 7)}, [${REG((op >>> 3) & 7)}, #${off}]`;
  }
  if ((op & 0xf000) === 0x9000) {
    const load = op & 0x0800 ? "LDR" : "STR";
    return `${load}   ${REG((op >>> 8) & 7)}, [SP, #${(op & 0xff) << 2}]`;
  }
  if ((op & 0xf600) === 0xb400) {
    const load = op & 0x0800;
    let list = op & 0xff;
    if (op & 0x0100) list |= load ? 0x8000 : 0x4000; // PC for POP, LR for PUSH
    return `${load ? "POP" : "PUSH"}  ${regList(list)}`;
  }
  if ((op & 0xff00) === 0xdf00) return `SWI   ${hx(op & 0xff)}`;
  if ((op & 0xf000) === 0xd000) {
    let off = op & 0xff;
    if (off & 0x80) off |= 0xffffff00;
    const target = (addr + 4 + (off << 1)) >>> 0;
    return `B${COND[(op >>> 8) & 0xf]}    ${hx(target)}`;
  }
  if ((op & 0xf800) === 0xe000) {
    let off = op & 0x7ff;
    if (off & 0x400) off |= 0xfffff800;
    return `B     ${hx((addr + 4 + (off << 1)) >>> 0)}`;
  }
  if ((op & 0xf800) === 0xf000) return `BL    (hi)`;
  if ((op & 0xf800) === 0xf800) return `BL    (lo)`;

  return `DCW   ${hx(op)}`;
}

function pad(s: string): string {
  return s.length >= 6 ? s : s + " ".repeat(6 - s.length);
}
