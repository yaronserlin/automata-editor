# Contributing to Automata Editor

Automata Editor is a static web app: plain JavaScript ES modules, no framework, no bundler, with Tailwind CSS compiled ahead of time. There is no server and there are no environment variables.

## Prerequisites

<!-- AUTO-GENERATED: prerequisites (source: package.json devDependencies + node_modules/*/package.json "engines") -->
| Tool | Version | Why |
|------|---------|-----|
| Node.js | `^22.13.0 \|\| ^24.0.0 \|\| >=26.0.0` | The overlap of `vitest` 5 (`^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0`) and `eslint` 10 (`^20.19.0 \|\| ^22.13.0 \|\| >=24`); also declared in `package.json` `engines`. CI uses Node 22 |
| npm | bundled with Node | Installs from `package-lock.json` |
<!-- /AUTO-GENERATED -->

You also need:

- **A static HTTP server.** Browsers refuse to load ES module scripts from `file://`, so opening `index.html` directly renders the toolbar but the editor never starts.
- **Network access at runtime.** KaTeX 0.16.8 is loaded from the jsDelivr CDN in `index.html`.

## Setup

```bash
git clone https://github.com/yaronserlin/automata-editor.git
cd automata-editor
npm ci
```

## Running locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. `npx serve .` also works, but downloads `serve` on first use since it is not a project dependency.

There is no hot reload — refresh the browser after editing. If you are changing Tailwind classes, keep `npm run watch:css` running in a second terminal.

## Scripts

<!-- AUTO-GENERATED: scripts (source: package.json "scripts") -->
| Command | Runs | Description |
|---------|------|-------------|
| `npm run build:css` | `tailwindcss -i ./css/tailwind.css -o ./css/tailwind.generated.css --minify` | Compile Tailwind into the minified stylesheet the page loads |
| `npm run watch:css` | `tailwindcss -i ./css/tailwind.css -o ./css/tailwind.generated.css --watch` | Recompile on every change (unminified) |
| `npm run check:css` | `node scripts/check-css.js` | Rebuild the stylesheet into a temp file and fail if the committed `css/tailwind.generated.css` differs (ignores a trailing newline) |
| `npm run lint` | `eslint .` | Lint all JavaScript with the flat config in `eslint.config.js` |
| `npm test` | `vitest run` | Run the full test suite once |
| `npm run test:watch` | `vitest` | Re-run tests as files change |
<!-- /AUTO-GENERATED -->

`watch:css` writes unminified output to the same file. Run `npm run build:css` before committing so the committed stylesheet stays minified; `npm run check:css` confirms it.

## Continuous integration

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push and pull request, on Ubuntu with Node 22:

1. `npm ci`
2. `npm run lint`
3. `npm run check:css`
4. `npm test`

A red check on a pull request means one of these failed; run the same command locally to see why. CI does not deploy anything. GitHub Pages deploys `main` on its own (see [RUNBOOK.md](RUNBOOK.md)).

## Project layout

| Path | Contents |
|------|----------|
| `index.html` | Page markup: toolbar, SVG canvas layers, properties panel, help panel |
| `js/main.js` | Entry point; instantiates `AutomataEditorApp` |
| `js/AutomataEditorApp.js` | Composition root: wires models, controllers, and views; canvas sizing; seed diagram |
| `js/core/` | Automaton data model (`AutomatonNode`, `AutomatonEdge`, `AutomatonGraph`), validation of loaded project data (`fromRaw`), the input simulator (`AutomatonSimulator`), and undo history (`HistoryManager`) |
| `js/geometry/GeometryUtils.js` | Pure helpers: HTML escaping, KaTeX and LaTeX-to-SVG text, snapping, edge path math |
| `js/interaction/` | `CameraController` (pan/zoom), `SelectionModel` + `EdgeDraftState`, `PointerController` (mouse/touch), `KeyboardController` |
| `js/rendering/CanvasRenderer.js` | Draws nodes, edges, and alignment guides into the SVG |
| `js/rendering/KatexLayout.js` | Rewrites KaTeX's positioned layers as normal-flow margins so labels render inside `foreignObject` in Safari; shrinks long node labels |
| `js/ui/PropertiesPanel.js` | State/transition property editor, with LaTeX preview and error messages |
| `js/ui/SimulationPanel.js` | Test-input bar: runs, steps through, and explains a simulation |
| `js/ui/ToastManager.js`, `js/ui/OnboardingHint.js` | Toast notifications and the first-visit hint |
| `js/io/AutosaveStore.js` | Autosave to `localStorage` |
| `js/geometry/NodePlacement.js` | Finds free space for new states |
| `js/io/ProjectIO.js` | `ProjectFile` (JSON save/load) and `DiagramExporter` (SVG, TikZ) |
| `css/tailwind.css` → `css/tailwind.generated.css` | Tailwind input and its compiled output (committed) |
| `css/style.css` | Hand-written, non-Tailwind styles |
| `test/` | Vitest suites |
| `scripts/check-css.js` | The `check:css` script used locally and in CI |
| `eslint.config.js` | ESLint flat config: recommended rules, browser globals (plus `katex`) for `js/`, Node globals for tests and scripts |
| `.github/workflows/ci.yml` | GitHub Actions: install, lint, CSS check, tests |
| `favicon.ico`, `android-chrome-512x512.png` | Browser tab icon (16/32px) and the large icon used as `apple-touch-icon` |
| `media/demo.png` | README screenshot, also the social preview image (`og:image`). The demo video is not in the repo; it lives in the [Demo media release](https://github.com/yaronserlin/automata-editor/releases/tag/demo-media) |

## Testing

Tests use [Vitest](https://vitest.dev) and live in `test/*.test.js`: 96 tests across 11 files. There is no Vitest config and no DOM library (jsdom/happy-dom) installed, so tests run in plain Node — they can only import modules that don't touch `document`, `window`, or the global `katex`.

| File | Covers |
|------|--------|
| `test/graph.test.js` | `AutomatonGraph`: adding/deleting states and transitions, naming, parallel-edge curving, `replaceWith` |
| `test/export.test.js` | `fromRaw` validation of project-file data for nodes, edges, and graphs |
| `test/render.test.js` | `AutomatonEdge` curve editing and `SelectionModel.cycle` |
| `test/utils.test.js` | `GeometryUtils`: HTML escaping, LaTeX-to-SVG text (XSS regression guard), LaTeX error messages, axis snapping, edge paths |
| `test/simulator.test.js` | `AutomatonSimulator`: label parsing, input tokenizing, DFA/NFA/ε runs, step records, error cases |
| `test/history.test.js` | `HistoryManager` undo/redo and `AutomatonGraph` snapshots |
| `test/autosave.test.js` | `AutosaveStore` save/restore with in-memory and failing storage |
| `test/placement.test.js` | `NodePlacement`: finding free space for new states |
| `test/camera.test.js` | `CameraController.restore`: clamping a restored zoom to the supported range |
| `test/edge-draft-safety.test.js` | Edge-draft cancellation on delete and `PointerController` guards for deleted nodes/edges (uses minimal DOM stubs) |
| `test/katex-layout.test.js` | `KatexLayout`: rewriting KaTeX's relative offsets so labels render inside SVG `foreignObject` in Safari |

The file names predate the current module layout (`export.test.js` covers loading, not exporting). The renderer, properties panel, and file I/O are not covered; `DiagramExporter.toTikzString` is DOM-free and a good candidate for a first new test.

To add a test, create `test/<topic>.test.js` and import from `vitest` and from `../js/...` with the `.js` extension (the package is `"type": "module"`):

```js
import { describe, it, expect } from 'vitest';
import { AutomatonGraph } from '../js/core/AutomatonGraph.js';

describe('AutomatonGraph', () => {
    it('adds a node', () => {
        const graph = new AutomatonGraph();
        graph.addNode(0, 0);
        expect(graph.nodes).toHaveLength(1);
    });
});
```

## Code style

ESLint (`npm run lint`) runs `@eslint/js` recommended rules, with unused function arguments allowed when prefixed with `_`. There is no formatter or pre-commit hook, so match the existing code:

- ES module classes with JSDoc on classes and public methods; tunable constants as `static UPPER_SNAKE_CASE` fields.
- 4-space indentation, single quotes, semicolons.
- Descriptive names (`positionX`, `selectionModel`) over abbreviations.
- Collaborators are passed in through constructors and wired together in `AutomataEditorApp` — don't add globals.
- **Never put user text into `innerHTML` raw.** Go through `GeometryUtils.escapeHtml`, `GeometryUtils.renderKatex` (KaTeX with `trust: false`), or `GeometryUtils.convertLatexToSvgText`.
- **Tailwind only scans `index.html`** (`content` in `tailwind.config.js`). Utility classes added from JavaScript are purged unless you add that file to `content`. After changing classes, run `npm run build:css` and commit `css/tailwind.generated.css` — the site is served as committed, with no build step.
- **Keyboard shortcuts are listed in three places:** the README's shortcut table, the `#instructions` section of the Help dialog, and the canvas `aria-label` in `index.html`. Keep them in sync with `KeyboardController`, and call `announce()` so new actions give screen-reader feedback.

## Pull requests

Fork the repository, branch from `main`, and open a pull request against `main`. Merging to `main` deploys to GitHub Pages immediately — see [RUNBOOK.md](RUNBOOK.md).

- [ ] `npm run lint`, `npm run check:css`, and `npm test` pass (CI runs the same three)
- [ ] Changed classes in `index.html` → ran `npm run build:css` and committed `css/tailwind.generated.css`
- [ ] Tested in a browser over HTTP: create, connect, edit, and delete states and transitions; Save → Load round trip; Download SVG and Download LaTeX
- [ ] Touched layout → also checked a narrow portrait viewport (below 640px the properties panel moves beneath the canvas)
- [ ] Any new user-provided text rendered via `innerHTML` is escaped
- [ ] Changed shortcuts → updated the README table, help panel, and canvas `aria-label`
