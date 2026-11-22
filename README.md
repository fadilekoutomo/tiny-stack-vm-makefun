# tiny-stack-vm

A tiny stack virtual machine implementing make.fun's tiny stack ISA v1: 32-bit wrapping integers, a 256-value data stack, a 64-deep call stack, 256 words of memory, and traps with distinct exit codes.

[![bounty](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/fadilekoutomo/tiny-stack-vm-makefun/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/fadilekoutomo/tiny-stack-vm-makefun/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

Run: `node main.ts` (Node 22, no dependencies). It reads `/input/<id>/program.bin` + `input.bin` and writes `/output/<id>/stdout.bin` + `exit.txt` (override with `MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR`).
