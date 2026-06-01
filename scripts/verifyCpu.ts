import { Engine } from "../sim/engine";

function words(...w: number[]): Uint8Array {
  const b = new Uint8Array(w.length * 4);
  w.forEach((v, i) => {
    b[i * 4] = v & 0xff;
    b[i * 4 + 1] = (v >>> 8) & 0xff;
    b[i * 4 + 2] = (v >>> 16) & 0xff;
    b[i * 4 + 3] = (v >>> 24) & 0xff;
  });
  return b;
}

let failures = 0;
function assert(name: string, cond: boolean, extra = "") {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

// ---- Test 1: ARM — LDR literal, MOV imm, STR, branch, GPIO ----
{
  const e = new Engine();
  const prog = words(
    0xe59f0010, // 0x00 LDR R0,[PC,#16]  -> IO0DIR
    0xe59f1010, // 0x04 LDR R1,[PC,#16]  -> IO0SET
    0xe3a020ff, // 0x08 MOV R2,#0xFF
    0xe5802000, // 0x0C STR R2,[R0]
    0xe5812000, // 0x10 STR R2,[R1]
    0xeafffffe, // 0x14 B .
    0xe0028008, // 0x18 IO0DIR
    0xe0028004, // 0x1C IO0SET
  );
  e.loadBinary(prog, "arm.bin");
  e.run(50);
  console.log("Test 1: ARM GPIO");
  assert("IO0DIR = 0xFF", (e.gpio.dir[0] & 0xff) === 0xff, `got ${e.gpio.dir[0].toString(16)}`);
  assert("IO0 out = 0xFF", (e.gpio.out[0] & 0xff) === 0xff, `got ${e.gpio.out[0].toString(16)}`);
  assert("R2 = 0xFF", e.cpu.regs[2] === 0xff);
  assert("PC parked at 0x14", e.cpu.pc === 0x14, `pc=${e.cpu.pc.toString(16)}`);
}

// ---- Test 2: Thumb — BX switch, MOV/ADD/LSL ----
{
  const e = new Engine();
  const prog = words(
    0xe59f0008, // 0x00 LDR R0,[PC,#8]  -> 0x09
    0xe12fff10, // 0x04 BX R0           -> enter Thumb at 0x08
    0x31032105, // 0x08 MOVS R1,#5 ; ADDS R1,#3
    0xe7fe0049, // 0x0C LSLS R1,R1,#1 ; B .
    0x00000009, // 0x10 thumb target (0x08 | 1)
  );
  e.loadBinary(prog, "thumb.bin");
  e.run(50);
  console.log("Test 2: Thumb arithmetic");
  assert("in Thumb state", e.cpu.T === true);
  assert("R1 = 16", e.cpu.regs[1] === 16, `got ${e.cpu.regs[1]}`);
  assert("PC parked at 0x0E", e.cpu.pc === 0x0e, `pc=${e.cpu.pc.toString(16)}`);
}

// ---- Test 3: PUSH/POP + BL round trip ----
{
  const e = new Engine();
  const prog = words(
    0xe3a0d902, // 0x00 MOV SP,#0x8000  (0x02 ror 18 = 0x8000) -> set stack
    0xe28dd901, //      (placeholder, see note)
    0xe3a00005, // 0x08 MOV R0,#5
    0xeb000002, // 0x0C BL 0x1C
    0xe3a00007, // 0x10 MOV R0,#7   (return lands here)
    0xeafffffe, // 0x14 B .
    0xe1a0f00e, // 0x18 (pad)
    0xe12fff1e, // 0x1C BX LR  (function body: just return)
  );
  // Fix SP setup: MOV SP,#0x40008000 isn't directly encodable; use 0x8000 then
  // it doesn't matter for this test (BL/BX use LR, not the stack).
  e.loadBinary(prog, "bl.bin");
  e.run(50);
  console.log("Test 3: BL / BX LR");
  assert("R0 = 7 after return", e.cpu.regs[0] === 7, `got ${e.cpu.regs[0]}`);
  assert("PC parked at 0x14", e.cpu.pc === 0x14, `pc=${e.cpu.pc.toString(16)}`);
}

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
