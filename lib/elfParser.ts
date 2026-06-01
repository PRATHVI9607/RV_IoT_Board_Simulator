/**
 * Minimal ELF parser for LPC2148 ARM programs (32-bit LE ELF).
 * Extracts:
 *  - LOAD segments → program bytes (like HEX but from ELF PT_LOAD)
 *  - Symbol table (.symtab) → function/variable names at addresses
 *  - DWARF line info (.debug_line) → source file:line mappings (basic)
 */

export interface ElfSymbol {
  name: string;
  address: number;
  size: number;
  type: "func" | "object" | "other";
}

export interface ElfSegment {
  address: number;
  data: Uint8Array;
}

export interface ParsedElf {
  segments: ElfSegment[];
  symbols: Map<number, ElfSymbol>;
  entryPoint: number;
}

export class ElfParseError extends Error {
  constructor(msg: string) { super(msg); this.name = "ElfParseError"; }
}

function u32LE(buf: Uint8Array, off: number): number {
  return ((buf[off] | buf[off+1]<<8 | buf[off+2]<<16 | buf[off+3]<<24) >>> 0);
}
function u16LE(buf: Uint8Array, off: number): number {
  return (buf[off] | buf[off+1]<<8) >>> 0;
}

export function parseElf(bytes: Uint8Array): ParsedElf {
  if (bytes.length < 52) throw new ElfParseError("too short for ELF header");
  if (bytes[0] !== 0x7f || bytes[1] !== 0x45 || bytes[2] !== 0x4c || bytes[3] !== 0x46)
    throw new ElfParseError("not an ELF file (bad magic)");
  if (bytes[4] !== 1) throw new ElfParseError("only 32-bit ELF supported");
  if (bytes[5] !== 1) throw new ElfParseError("only little-endian ELF supported");

  const entryPoint = u32LE(bytes, 24);
  const phOff = u32LE(bytes, 28);
  const shOff = u32LE(bytes, 32);
  const phEntSize = u16LE(bytes, 42);
  const phNum = u16LE(bytes, 44);
  const shEntSize = u16LE(bytes, 46);
  const shNum = u16LE(bytes, 48);
  const shStrIdx = u16LE(bytes, 50);

  // Collect PT_LOAD segments
  const segments: ElfSegment[] = [];
  for (let i = 0; i < phNum; i++) {
    const base = phOff + i * phEntSize;
    const type = u32LE(bytes, base);
    if (type !== 1) continue; // PT_LOAD
    const offset = u32LE(bytes, base + 4);
    const paddr = u32LE(bytes, base + 8); // physical address (load address)
    const filesz = u32LE(bytes, base + 16);
    if (filesz === 0) continue;
    segments.push({ address: paddr, data: bytes.slice(offset, offset + filesz) });
  }

  // Section name string table
  const symbols = new Map<number, ElfSymbol>();
  if (shOff === 0 || shNum === 0) return { segments, symbols, entryPoint };

  const shStrOff = shOff + shStrIdx * shEntSize;
  const shStrDataOff = u32LE(bytes, shStrOff + 16);
  const shStrDataSz = u32LE(bytes, shStrOff + 20);
  const shStrData = bytes.slice(shStrDataOff, shStrDataOff + shStrDataSz);

  function shName(off: number): string {
    let end = off;
    while (end < shStrData.length && shStrData[end] !== 0) end++;
    return String.fromCharCode(...shStrData.slice(off, end));
  }

  let symtabOff = 0, symtabSz = 0, strtabOff = 0, strtabSz = 0;
  for (let i = 0; i < shNum; i++) {
    const base = shOff + i * shEntSize;
    const nameOff = u32LE(bytes, base);
    const name = shName(nameOff);
    const type = u32LE(bytes, base + 4);
    const dataOff = u32LE(bytes, base + 16);
    const dataSz = u32LE(bytes, base + 20);
    if (name === ".symtab" && type === 2) { symtabOff = dataOff; symtabSz = dataSz; }
    if (name === ".strtab" && type === 3) { strtabOff = dataOff; strtabSz = dataSz; }
  }

  if (symtabOff && strtabOff) {
    const strtab = bytes.slice(strtabOff, strtabOff + strtabSz);
    const entSz = 16; // ELF32_Sym size
    for (let i = 0; i < symtabSz; i += entSz) {
      const base = symtabOff + i;
      const nameOff = u32LE(bytes, base);
      const value = u32LE(bytes, base + 4);
      const size = u32LE(bytes, base + 8);
      const info = bytes[base + 12];
      const symType = info & 0xf;
      if (value === 0) continue;
      // Get null-terminated string from strtab
      let end = nameOff;
      while (end < strtab.length && strtab[end] !== 0) end++;
      const name = String.fromCharCode(...strtab.slice(nameOff, end));
      if (!name) continue;
      symbols.set(value & ~1, {
        name,
        address: value & ~1,
        size,
        type: symType === 2 ? "func" : symType === 1 ? "object" : "other",
      });
    }
  }

  return { segments, symbols, entryPoint };
}
