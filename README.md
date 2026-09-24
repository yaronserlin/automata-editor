<div align="center">
  <h1>Automata Editor</h1>
  <p>
    Design, label, and export finite-state automata (DFA/NFA) diagrams — right in your browser, no install required.
  </p>
  <p>
    <a href="https://yaronserlin.github.io/automata-editor/"><strong>▶ Try the live demo</strong></a>
  </p>
  <p>
    <a href="https://github.com/yaronserlin/automata-editor/actions/workflows/ci.yml"><img src="https://github.com/yaronserlin/automata-editor/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  </p>
</div>

---

## What it does

Automata Editor turns the tedious part of drawing state diagrams — for a homework assignment, a paper, a slide deck, or just to think through a design — into a few clicks. Draw states, connect them with labeled transitions, type math with LaTeX-style shortcuts (`q_0`, `\epsilon`, `\rightarrow`), and export a clean diagram when you're done.

Everything runs locally in your browser. Nothing you draw is uploaded anywhere.

## Features

- **Click-to-build canvas** — double-click to add a state, drag to connect or reposition, drag empty space to multi-select.
- **Math-aware labels** — state names and transition labels render live with KaTeX, so `q_0` and `\epsilon` look the way they would in a textbook.
- **Automatic layout smarts** — overlapping transitions curve apart automatically, dragged states snap into alignment with their neighbors.
- **Test your automaton** — type an input string and see whether it is accepted, or step through it symbol by symbol while the active states light up. Works for DFAs and NFAs, including ε-transitions.
- **See the language it accepts** — open **Language L(M)** under the test bar to see L(M) worked out for you. Block-shaped languages are written in set-builder notation, e.g. `L = { a^n b^m | 1 ≤ n ≤ 4, m = 2n }`; any other automaton gets a regular expression. It updates as you edit and copies as LaTeX.
- **Never lose work** — the diagram is autosaved in your browser, with undo/redo (`Ctrl`/`Cmd` + `Z`) for every change.
- **Full keyboard support** — every action (create, select, connect, reshape, delete) has a keyboard shortcut, for accessibility or just speed. See [Keyboard shortcuts](#keyboard-shortcuts) below.
- **Save and reload your work** — your diagram is kept in the browser automatically, and you can export it to a JSON file and load it back in later.
- **Export to SVG** — a clean, cropped image ready to drop into a document or slide.
- **Export to LaTeX/TikZ** — ready-to-compile source using the standard `tikz` and `automata` packages, for papers written in LaTeX.
- **Works on phones and tablets**: double-tap to add states, pinch to zoom, and a layout that stacks the panels on narrow screens.
- **Built-in help**: the **Help** button lists every mouse, touch, and keyboard action.
- **Accessibility menu**: the **Accessibility** button in the toolbar lets you enlarge text (up to 150%), turn on high contrast, and underline links. Your choice is remembered in the browser.

## Demo

**Desktop:** add a state, connect it, label the transition, then step through and run a test input.

<img src="https://github.com/user-attachments/assets/76880fde-b690-4c48-919b-13feb69301f8" alt="Automata Editor on desktop: a new state q2 is added and marked accepting, a transition from q1 to q2 is drawn and labeled b, and the input ab is stepped through and accepted." width="800"/>

**Mobile:** double-tap to add a state, tap it to make it accepting, and test an input.

<p>
  <img src="https://github.com/user-attachments/assets/69217285-3fe9-44dc-a1f4-4b6af6671781" alt="Automata Editor on a phone: double-tapping the canvas adds state q2, which is marked accepting, and the input a is accepted." width="280"/>
  &nbsp;
  <img src="https://github.com/user-attachments/assets/ea0424e4-fa34-4fa3-be37-6179e88700c4" alt="Automata Editor on a phone screen, with the test input bar, the onboarding hint above the canvas, and the diagram below." width="280"/>
</p>

<img src="https://github.com/user-attachments/assets/539556e3-f1a2-4b22-b5b3-b6f5a622c4fd" alt="Automata Editor on desktop, showing the toolbar, the test input bar with an accepted run, and a three-state diagram with states q0, q1, and q2." width="800"/>

All demo media, including a video version and the original screen recording, are on the [Demo media release](https://github.com/yaronserlin/automata-editor/releases/tag/demo-media), so they don't add weight to the repository.

## How to use it

1. **Add a state** — double-click anywhere on the canvas.
2. **Connect two states** — hold `Shift` and drag from one state to another, or double-click a state and then drag to (or click) its target.
3. **Edit a state or transition** — click it; a panel opens where you can rename it, mark it as a start/accept state, or edit its label.
4. **Reshape a transition** — drag its label to bend the curve, or drag a self-loop to rotate it.
5. **Move things around** — drag a state to reposition it; drag an empty area to box-select several states at once.
6. **Pan and zoom** — `Alt` + drag (or the middle mouse button) to pan; `Ctrl`/`Cmd` + scroll, or the on-canvas buttons, to zoom.
7. **Delete something** — select it and press `Delete` or `Backspace`.
8. **Test an input** — type a string in **Test input** and press `Enter` (or **Run**); use the step and play buttons to watch the run one symbol at a time.
9. **Undo mistakes** — `Ctrl`/`Cmd` + `Z` to undo, `Ctrl`/`Cmd` + `Shift` + `Z` (or `Ctrl` + `Y`) to redo.
10. **Save your work** — click **Save** to download a project file; click **Load** to bring it back later.
11. **Export a finished diagram** — **Download SVG** for an image, or **Download LaTeX** for TikZ source.
12. **Stuck?** Click **Help** for the full list of actions.

### On a phone or tablet

- **Add a state:** double-tap the canvas.
- **Connect two states:** double-tap a state, keep your finger down, and drag to the target; or lift and tap the target.
- **Edit or move:** tap a state or transition to edit it; drag a state to move it.
- **Pan and zoom:** pinch to zoom, move two fingers together to pan.

### Keyboard shortcuts

Every editing action is also reachable without a mouse:

| Key | Action |
|---|---|
| `N` | Create a new state at the center of the view |
| `[` / `]` | Select the previous / next state or transition |
| Arrow keys | Move the selected state(s) (hold `Shift` to nudge by 1px) |
| `Enter` | Start drawing a transition from the selected state; press again on another state to connect it (or the same state, for a self-loop) |
| `+` / `-` | Bend the selected transition's curve (or rotate a self-loop) |
| `0` | Reset the selected transition's shape |
| `Escape` | Cancel a transition in progress, or clear the selection |
| `Delete` / `Backspace` | Delete the current selection |
| `Ctrl`/`Cmd` + `Z` | Undo |
| `Ctrl`/`Cmd` + `Shift` + `Z`, `Ctrl` + `Y` | Redo |

## Credit / Attribution

Automata Editor is open source under the [MIT License](LICENSE), which already requires keeping the copyright notice in any copy or substantial portion of the code. Beyond that legal baseline, if you use, adapt, or build on this project, please credit **Yaron Serlin** and link back to this repository, for example:

> Built with [Automata Editor](https://github.com/yaronserlin/automata-editor) by Yaron Serlin.

## License

Distributed under the MIT License, copyright (c) 2026 Yaron Serlin. See `LICENSE` for more information, and [Credit / Attribution](#credit--attribution) for how to credit the project when you use it.

---

<details>
<summary><strong>For developers: running this project locally</strong></summary>

<br/>

The app is plain JavaScript (ES modules, no framework, no bundler) with Tailwind CSS compiled ahead of time. Its source is organized by responsibility: `js/core` (the automaton data model), `js/geometry` (pure math/text helpers), `js/interaction` (camera, selection, mouse/touch, and keyboard controllers), `js/rendering` (SVG drawing), `js/ui` (the properties panel), and `js/io` (save/load and SVG/TikZ export), composed together in `js/AutomataEditorApp.js`.

**Setup** (Node.js 22.13+ or 24+):
```bash
git clone https://github.com/yaronserlin/automata-editor.git
cd automata-editor
npm ci
npm run build:css   # regenerate css/tailwind.generated.css after editing index.html's classes
```

**Run it:**
```bash
npx serve .
# or: python3 -m http.server 8000
```
Then open the printed `localhost` URL in your browser.

**Check it:**
```bash
npm run lint        # ESLint
npm run check:css   # fails if css/tailwind.generated.css is out of date
npm test            # Vitest: 110 tests
```
The Vitest suite (110 tests) covers the automaton model and project-file validation, the input simulator, the language analyzer, undo/redo history, autosave, state placement, camera zoom limits, KaTeX layout, edge-drawing safety, and the geometry and text-escaping helpers. [GitHub Actions](https://github.com/yaronserlin/automata-editor/actions/workflows/ci.yml) runs all three checks on every push and pull request.

**Contributing:** fork the project, create a feature branch, and open a pull request. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for the full scripts reference, testing guide, and PR checklist, and [docs/RUNBOOK.md](docs/RUNBOOK.md) for deployment, rollback, and troubleshooting.

</details>
