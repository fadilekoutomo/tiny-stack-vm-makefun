// Tiny stack VM: implements make.fun's tiny stack ISA v1 (see kit ISA.md / vm.mjs).
// Reads /input/<id>/program.bin + input.bin, writes /output/<id>/stdout.bin + exit.txt.
// Node 22 type-stripping: plain JS syntax only, no dependencies, no I/O besides /input /output.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Opcode tables, indexed by opcode byte (0x00..0x53). V: '1' = valid opcode.
// P: values popped, W: values pushed (from ISA.md / vm.mjs OPS table).
const V = '111111110000000011111111111111101110000000000000111110000000000011000000000000001111';
const P = '000112230000000022222221222122202220000000000000011000000000000012000000000000001101';
const W = '011022330000000011111111111111101110000000000000000000000000000010000000000000000010';

function run(p, inp) {
  const n = p.length;
  const D = new Int32Array(256);
  let sp = 0;
  const C = new Int32Array(64);
  let cp = 0;
  const M = new Int32Array(256);
  const out = Buffer.alloc(65536);
  let ol = 0, ip = 0, pc = 0, st = 0, ex = 0;
  for (;;) {
    if (st === 1000000) { ex = 10; break; }
    if (pc < 0 || pc >= n) { ex = 9; break; }
    const op = p[pc];
    if (V.charCodeAt(op) !== 49) { ex = 5; break; }
    const imm = op === 1 ? 1 : op === 2 ? 4 : op >= 48 && op <= 51 ? 2 : 0;
    if (pc + imm >= n) { ex = 9; break; }
    st++;
    const nx = pc + 1 + imm;
    const po = P.charCodeAt(op) - 48, pu = W.charCodeAt(op) - 48;
    if (sp < po) { ex = 2; break; }
    if (sp - po + pu > 256) { ex = 3; break; }
    pc = nx;
    if (op === 0) break; // HALT: exit 0
    else if (op === 1) D[sp++] = (p[pc - 1] << 24) >> 24; // PUSH8 sign-extended
    else if (op === 2) D[sp++] = p[pc - 4] | (p[pc - 3] << 8) | (p[pc - 2] << 16) | (p[pc - 1] << 24); // PUSH32
    else if (op === 3) sp--; // POP
    else if (op === 4) { D[sp] = D[sp - 1]; sp++; } // DUP
    else if (op === 5) { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; } // SWAP
    else if (op === 6) { D[sp] = D[sp - 2]; sp++; } // OVER
    else if (op === 7) { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; } // ROT
    else if (op >= 16 && op <= 34) {
      if (op === 23) D[sp - 1] = -D[sp - 1] | 0; // NEG
      else if (op === 27) D[sp - 1] = ~D[sp - 1]; // NOT
      else {
        const b = D[sp - 1], a = D[sp - 2];
        let r;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { if (b === 0) { ex = 4; break; } r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 20) { if (b === 0) { ex = 4; break; } r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 21) { if (b === 0) { ex = 4; break; } r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 22) { if (b === 0) { ex = 4; break; } r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0; // LTU
        sp -= 2;
        D[sp++] = r;
      }
    } else if (op >= 48 && op <= 50) { // JMP / JZ / JNZ
      const rel = ((p[pc - 2] | (p[pc - 1] << 8)) << 16) >> 16;
      let take = true;
      if (op !== 48) { const v = D[--sp]; take = op === 49 ? v === 0 : v !== 0; }
      if (take) pc = nx + rel;
    } else if (op === 51) { // CALL
      if (cp === 64) { ex = 7; break; }
      C[cp++] = nx;
      pc = p[pc - 2] | (p[pc - 1] << 8);
    } else if (op === 52) { // RET
      if (cp === 0) { ex = 8; break; }
      pc = C[--cp];
    } else if (op === 64) { // LOAD
      const a = D[sp - 1];
      if (a < 0 || a >= 256) { ex = 6; break; }
      D[sp - 1] = M[a];
    } else if (op === 65) { // STORE
      const a = D[sp - 1], v = D[sp - 2];
      if (a < 0 || a >= 256) { ex = 6; break; }
      sp -= 2;
      M[a] = v;
    } else if (op === 80) { // PRINT
      const s = String(D[sp - 1]);
      if (ol + s.length > 65536) { ex = 11; break; }
      sp--;
      for (let i = 0; i < s.length; i++) out[ol++] = s.charCodeAt(i);
    } else if (op === 81) { // PUTC
      if (ol + 1 > 65536) { ex = 11; break; }
      out[ol++] = D[--sp] & 255;
    } else if (op === 82) { // IN
      D[sp++] = ip < inp.length ? inp[ip++] : -1;
    } else { // EXIT
      ex = D[--sp] & 255;
      break;
    }
  }
  return { out: out.subarray(0, ol), ex };
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const d of readdirSync(I, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  const p = readFileSync(join(I, d, 'program.bin'));
  let inp = Buffer.alloc(0);
  try { inp = readFileSync(join(I, d, 'input.bin')); } catch {}
  const r = run(p, inp);
  mkdirSync(join(O, d), { recursive: true });
  writeFileSync(join(O, d, 'stdout.bin'), r.out);
  writeFileSync(join(O, d, 'exit.txt'), String(r.ex) + '\n');
}
