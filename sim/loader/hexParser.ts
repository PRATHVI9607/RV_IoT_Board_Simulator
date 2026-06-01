/**
 * Intel HEX parser — the format Keil uVision emits for the LPC2148.
 *
 * Record layout (one per line, ASCII):
 *   :LLAAAATT[DD...]CC
 *   LL = byte count, AAAA = 16-bit address, TT = record type,
 *   DD = data bytes, CC = two's-complement checksum of all prior bytes.
 *
 * Record types we handle:
 *   00 Data
 *   01 End Of File
 *   02 Extended Segment Address (base = value << 4)
 *   03 Start Segment Address (CS:IP — ignored on ARM)
 *   04 Extended Linear Address (upper 16 bits of 32-bit address)
 *   05 Start Linear Address (32-bit entry point)
 */

export interface HexSegment {
  address: number;
  data: Uint8Array;
}

export interface ParsedHex {
  segments: HexSegment[];
  entryPoint: number;
  /** total number of data bytes across all segments */
  byteCount: number;
  /** lowest / highest address touched (inclusive-exclusive) */
  minAddress: number;
  maxAddress: number;
}

export class HexParseError extends Error {
  constructor(message: string, public line?: number) {
    super(line != null ? `Line ${line}: ${message}` : message);
    this.name = "HexParseError";
  }
}

function byteAt(s: string, i: number, line: number): number {
  if (i + 2 > s.length) {
    throw new HexParseError(`record ends mid-byte at column ${i}`, line);
  }
  const v = parseInt(s.substring(i, i + 2), 16);
  if (Number.isNaN(v)) {
    throw new HexParseError(`invalid hex byte at column ${i}`, line);
  }
  return v;
}

export function parseIntelHex(text: string): ParsedHex {
  const lines = text.split(/\r?\n/);
  const segments: HexSegment[] = [];
  let upperBase = 0; // from type 04 (linear) or 02 (segment)
  let entryPoint = 0;
  let sawEof = false;
  let byteCount = 0;
  let minAddress = 0xffffffff;
  let maxAddress = 0;

  for (let ln = 0; ln < lines.length; ln++) {
    const raw = lines[ln].trim();
    if (raw.length === 0) continue;
    if (raw[0] !== ":") {
      throw new HexParseError("record must start with ':'", ln + 1);
    }
    if (raw.length < 11) {
      throw new HexParseError("record too short", ln + 1);
    }

    const len = byteAt(raw, 1, ln + 1);
    const addr = (byteAt(raw, 3, ln + 1) << 8) | byteAt(raw, 5, ln + 1);
    const type = byteAt(raw, 7, ln + 1);
    const expectedChars = 11 + len * 2;
    if (raw.length < expectedChars) {
      throw new HexParseError(
        `record length mismatch (need ${len} data bytes)`,
        ln + 1,
      );
    }

    // Checksum: sum of every byte (count, addr, type, data, checksum) == 0 mod 256.
    let sum = 0;
    for (let i = 1; i < expectedChars; i += 2) sum += byteAt(raw, i, ln + 1);
    if ((sum & 0xff) !== 0) {
      throw new HexParseError("checksum error", ln + 1);
    }

    switch (type) {
      case 0x00: {
        const data = new Uint8Array(len);
        for (let i = 0; i < len; i++) data[i] = byteAt(raw, 9 + i * 2, ln + 1);
        const absolute = (upperBase + addr) >>> 0;
        segments.push({ address: absolute, data });
        byteCount += len;
        if (absolute < minAddress) minAddress = absolute;
        if (absolute + len > maxAddress) maxAddress = absolute + len;
        break;
      }
      case 0x01:
        sawEof = true;
        break;
      case 0x02:
        upperBase = (((byteAt(raw, 9, ln + 1) << 8) | byteAt(raw, 11, ln + 1)) << 4) >>> 0;
        break;
      case 0x03:
        // Start Segment Address (x86 CS:IP) — irrelevant on ARM, ignore.
        break;
      case 0x04:
        upperBase =
          (((byteAt(raw, 9, ln + 1) << 8) | byteAt(raw, 11, ln + 1)) << 16) >>> 0;
        break;
      case 0x05:
        entryPoint =
          ((byteAt(raw, 9, ln + 1) << 24) |
            (byteAt(raw, 11, ln + 1) << 16) |
            (byteAt(raw, 13, ln + 1) << 8) |
            byteAt(raw, 15, ln + 1)) >>>
          0;
        break;
      default:
        throw new HexParseError(`unknown record type 0x${type.toString(16)}`, ln + 1);
    }

    if (sawEof) break;
  }

  if (segments.length === 0) {
    throw new HexParseError("no data records found");
  }
  if (minAddress === 0xffffffff) minAddress = 0;

  return { segments, entryPoint, byteCount, minAddress, maxAddress };
}

/** Parse a raw .bin as a single segment loaded at address 0. */
export function parseBinary(bytes: Uint8Array): ParsedHex {
  return {
    segments: [{ address: 0, data: bytes }],
    entryPoint: 0,
    byteCount: bytes.length,
    minAddress: 0,
    maxAddress: bytes.length,
  };
}
