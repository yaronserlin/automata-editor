# Visual Automaton Editor

A web-based, interactive tool for designing and exporting finite state automata (DFA/NFA).

## Features

- **Interactive Canvas**: Add, move, and connect states with an intuitive drag-and-drop interface.
- **Mathematical Rendering**: Supports LaTeX syntax for state names and transition labels, rendered beautifully using KaTeX.
- **Smart Routing**: Transition edges automatically determine their routing. Supports self-loops and customizable curve offsets.
- **Save & Load**: Export your workspace to a structured JSON format and restore it later without losing work.
- **Export to SVG**: Generate clean, cropped SVG files of your automaton, ready to be embedded in documents, presentations, or web pages.
- **Export to TikZ (LaTeX)**: Generate ready-to-compile LaTeX code using the standard `tikz` and `automata` libraries.
- **Camera Controls**: Infinite panning and precise zooming to handle complex automata graphs.
- **Multi-Selection**: Box-select and drag multiple nodes and edges simultaneously. Align states easily with smart snapping guides.

## Technologies Used

- **HTML5 & Vanilla JavaScript**: Core logic, DOM handling, and SVG interactions.
- **Tailwind CSS**: Rapid UI styling and layout.
- **KaTeX**: Fast math typesetting for the web.

## Quick Start / Usage

1. Open `index.html` in any modern web browser.
2. **Double-click** the canvas to add a new state (node).
3. **Shift + Drag** from one state to another to create a transition (edge).
4. Select a node to edit its name, or mark it as a 'Start' or 'Accept' state using the properties panel.
5. Select an edge to add transition symbols (e.g., `a, b`, or `\epsilon`).
6. Click and drag nodes to rearrange them. Use the edge drag handle to curve transitions.
7. Use the "Save Project" button to download a `.json` backup of your work.
8. Use "Export SVG" or "Export TikZ" when your diagram is complete.

## Advanced Controls

- **Pan Camera**: `Alt` + Drag OR Middle Mouse Button + Drag on the canvas.
- **Zoom**: `Ctrl` + Scroll OR `Cmd` + Scroll.
- **Multi-Select**: Click and drag on an empty area of the canvas.
- **Delete Elements**: Select nodes or edges and press `Delete` or `Backspace`.
