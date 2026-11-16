// Emberwarden — the entrypoint for make.fun's best-game-01 bounty.
//
// The game itself is plain static files under game/ (index.html plus its
// ES modules; no build step, no network). This program hands it in: it
// copies game/ and screenshots/ from beside this file into the output
// directory and writes dossier.json there, the summary the judge reads,
// using the vendored make.fun library. Node 22+, standard library only.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Running it twice writes identical bytes: the dossier is built purely
// from the files on disk, with no timestamps or random ids anywhere.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The directory this file lives in — game/ and screenshots/ sit beside it.
const root = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, so a bad entry fails loudly here instead of
// silently at the gate: at most 4 screenshots of 256 KiB each, at most
// 993 files and 48 MiB under game/, paths under 1000 bytes, and the
// judge's text capped at 160 KiB.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(from, to) {
  cpSync(from, to, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });

// Start from a clean slate so a stale file from an earlier run can never
// linger in the output and change the dossier between runs.
rmSync(join(outputDir, 'game'), { recursive: true, force: true });
rmSync(join(outputDir, 'screenshots'), { recursive: true, force: true });

copyTree(join(root, 'game'), join(outputDir, 'game'));
if (existsSync(join(root, 'screenshots'))) {
  copyTree(join(root, 'screenshots'), join(outputDir, 'screenshots'));
} else {
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, DOSSIER_CAPS));
