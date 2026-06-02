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

// ---- Test 3: BL must actually branch (and set LR), not fall through ----
// The function writes R1=0x55 so a fall-through (BL not taken) is detected:
// if BL is mis-decoded, the function body is skipped and R1 stays 0.
{
  const e = new Engine();
  const prog = words(
    0xe3a00005, // 0x00 MOV R0,#5
    0xeb000002, // 0x04 BL 0x14        -> must jump to the function
    0xe3a00007, // 0x08 MOV R0,#7       (return lands here)
    0xeafffffe, // 0x0C B .             (park)
    0xe1a0f00e, // 0x10 (pad word)
    0xe3a01055, // 0x14 MOV R1,#0x55    (function body — proves we branched)
    0xe12fff1e, // 0x18 BX LR           (return)
  );
  e.loadBinary(prog, "bl.bin");
  e.run(50);
  console.log("Test 3: BL branches + returns");
  assert("R1 = 0x55 (function body ran)", e.cpu.regs[1] === 0x55, `got ${e.cpu.regs[1].toString(16)}`);
  assert("R0 = 7 after return", e.cpu.regs[0] === 7, `got ${e.cpu.regs[0]}`);
  assert("PC parked at 0x0C", e.cpu.pc === 0x0c, `pc=${e.cpu.pc.toString(16)}`);
}

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
