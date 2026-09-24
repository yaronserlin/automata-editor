// Verifies that css/tailwind.generated.css matches a fresh `npm run build:css`.
// The site is served as committed (no build step on deploy), so a stale
// stylesheet would ship straight to production. Trailing whitespace is ignored
// because the GitHub web editor may add a final newline.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const committedPath = 'css/tailwind.generated.css';
const tempDir = mkdtempSync(join(tmpdir(), 'automata-css-'));
const freshPath = join(tempDir, 'tailwind.generated.css');

try {
    execFileSync('npx', ['tailwindcss', '-i', './css/tailwind.css', '-o', freshPath, '--minify'], { stdio: 'pipe' });
    const committed = readFileSync(committedPath, 'utf8').trimEnd();
    const fresh = readFileSync(freshPath, 'utf8').trimEnd();
    if (committed !== fresh) {
        console.error(`${committedPath} is out of date. Run "npm run build:css" and commit the result.`);
        process.exit(1);
    }
    console.log(`${committedPath} is up to date.`);
} finally {
    rmSync(tempDir, { recursive: true, force: true });
       }
