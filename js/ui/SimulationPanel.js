import { AutomatonSimulator } from '../core/AutomatonSimulator.js';
import { GeometryUtils } from '../geometry/GeometryUtils.js';

/**
 * The "Test input" bar: runs a string through the automaton and replays the run
 * step by step, highlighting the active states and the transitions just taken.
 *
 * The canvas reads the current highlight through getHighlight(); any edit to
 * the diagram calls invalidate(), because an old run no longer matches it.
 */
export class SimulationPanel {
    static PLAY_INTERVAL_MS = 700;

    /**
     * @param {Object} elements
     * @param {HTMLInputElement} elements.inputElement
     * @param {HTMLButtonElement} elements.runButton
     * @param {HTMLButtonElement} elements.stepBackButton
     * @param {HTMLButtonElement} elements.playButton
     * @param {HTMLButtonElement} elements.stepForwardButton
     * @param {HTMLButtonElement} elements.resetButton
     * @param {HTMLElement} elements.tapeElement
     * @param {HTMLElement} elements.statusElement
     * @param {HTMLElement} elements.typeBadgeElement
     * @param {import('../core/AutomatonGraph.js').AutomatonGraph} graph
     * @param {() => void} requestRender
     * @param {(message: string) => void} announce
     * @param {() => void} [onRun] Called after every successful run (used by onboarding).
     */
    constructor(elements, graph, requestRender, announce, onRun = () => {}) {
        Object.assign(this, elements);
        this.graph = graph;
        this.requestRender = requestRender;
        this.announce = announce;
        this.onRun = onRun;

        /** @type {ReturnType<AutomatonSimulator['run']>|null} */
        this.result = null;
        this.stepIndex = 0;
        this.playTimerId = null;

        this.bindEvents();
        this.updateControls();
    }

    bindEvents() {
        this.runButton.addEventListener('click', () => this.runToEnd());
        this.stepForwardButton.addEventListener('click', () => this.stepForward());
        this.stepBackButton.addEventListener('click', () => this.stepBack());
        this.playButton.addEventListener('click', () => this.togglePlay());
        this.resetButton.addEventListener('click', () => this.reset());
        this.inputElement.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.runToEnd();
            } else if (event.key === 'Escape') {
                this.reset();
            }
        });
        this.inputElement.addEventListener('input', () => {
            if (this.result) this.reset();
        });
    }

    /**
     * Computes a fresh run for the current input. Shows an error and returns false
     * when the automaton cannot be simulated yet.
     * @returns {boolean}
     */
    startRun() {
        this.stopPlaying();
        const result = new AutomatonSimulator(this.graph).run(this.inputElement.value);
        if (!result.ok) {
            this.result = null;
            this.renderError(result.error);
            this.requestRender();
            return false;
        }
        this.result = result;
        this.stepIndex = 0;
        this.onRun();
        return true;
    }

    runToEnd() {
        if (!this.startRun()) return;
        this.goToStep(this.result.steps.length - 1);
    }

    stepForward() {
        if (!this.result) {
            if (!this.startRun()) return;
            this.goToStep(0);
            return;
        }
        if (this.stepIndex < this.result.steps.length - 1) this.goToStep(this.stepIndex + 1);
    }

    stepBack() {
        if (this.result && this.stepIndex > 0) this.goToStep(this.stepIndex - 1);
    }

    togglePlay() {
        if (this.playTimerId !== null) {
            this.stopPlaying();
            this.updateControls();
            return;
        }
        if (!this.result || this.isAtEnd) {
            if (!this.startRun()) return;
            this.goToStep(0);
        }
        this.playTimerId = window.setInterval(() => {
            if (this.isAtEnd) {
                this.stopPlaying();
                this.updateControls();
                return;
            }
            this.goToStep(this.stepIndex + 1);
        }, SimulationPanel.PLAY_INTERVAL_MS);
        this.updateControls();
    }

    stopPlaying() {
        if (this.playTimerId !== null) {
            window.clearInterval(this.playTimerId);
            this.playTimerId = null;
        }
    }

    /**
     * Clears the current run and its highlighting, keeping the typed input.
     */
    reset() {
        this.stopPlaying();
        const hadResult = this.result !== null;
        this.result = null;
        this.stepIndex = 0;
        this.tapeElement.innerHTML = '';
        this.statusElement.textContent = '';
        this.statusElement.className = 'sim-status';
        this.updateControls();
        if (hadResult) this.requestRender();
    }

    /**
     * Called whenever the diagram changes: an old run no longer describes it.
     */
    invalidate() {
        if (this.result) this.reset();
        this.updateTypeBadge();
    }

    /** @returns {boolean} */
    get isAtEnd() {
        return !this.result || this.stepIndex >= this.result.steps.length - 1;
    }

    /**
     * @returns {{stateIds: Set<string>, edgeIds: Set<string>, outcome: 'accepted'|'rejected'|null}|null}
     *   What the canvas should highlight right now, or null when no run is shown.
     */
    getHighlight() {
        if (!this.result) return null;
        const step = this.result.steps[this.stepIndex];
        return {
            stateIds: step.stateIds,
            edgeIds: step.edgeIds,
            outcome: this.isAtEnd ? (this.result.accepted ? 'accepted' : 'rejected') : null
        };
    }

    /**
     * @param {number} index
     */
    goToStep(index) {
        this.stepIndex = index;
        this.renderTape();
        this.renderStatus();
        this.updateControls();
        this.requestRender();
    }

    renderTape() {
        this.tapeElement.innerHTML = '';
        const { symbols, steps } = this.result;
        const consumed = steps[this.stepIndex].consumed;

        if (symbols.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'sim-symbol sim-symbol-empty';
            empty.textContent = 'ε (empty string)';
            this.tapeElement.appendChild(empty);
            return;
        }

        symbols.forEach((symbol, index) => {
            const cell = document.createElement('span');
            cell.className = 'sim-symbol';
            if (index < consumed - 1) cell.classList.add('sim-symbol-read');
            if (index === consumed - 1) cell.classList.add('sim-symbol-current');
            if (this.result.stuckAt === index) cell.classList.add('sim-symbol-stuck');
            cell.textContent = symbol;
            this.tapeElement.appendChild(cell);
        });
    }

    renderStatus() {
        const { steps, symbols, accepted, stuckAt, unknownSymbols } = this.result;
        const step = steps[this.stepIndex];
        const stateNames = this.describeStates(step.stateIds);
        const totalSteps = steps.length - 1;

        this.statusElement.className = 'sim-status';
        let html;
        let spoken;

        if (this.isAtEnd) {
            if (accepted) {
                this.statusElement.classList.add('sim-status-accepted');
                const acceptIds = new Set(this.graph.nodes.filter(node => node.isAccept && step.stateIds.has(node.id)).map(node => node.id));
                html = `<strong>✓ Accepted.</strong> Reached accept state ${this.describeStates(acceptIds)}.`;
                spoken = 'Accepted.';
            } else if (stuckAt !== null) {
                this.statusElement.classList.add('sim-status-rejected');
                const symbol = GeometryUtils.escapeHtml(symbols[stuckAt]);
                const previousStates = this.describeStates(steps[stuckAt].stateIds);
                const unknownNote = unknownSymbols.includes(symbols[stuckAt])
                    ? ` (no transition in the diagram uses "${symbol}")`
                    : '';
                html = `<strong>✗ Rejected.</strong> No transition on "${symbol}" from ${previousStates}${unknownNote}.`;
                spoken = `Rejected. No transition on ${symbols[stuckAt]}.`;
            } else {
                this.statusElement.classList.add('sim-status-rejected');
                html = `<strong>✗ Rejected.</strong> Ended in ${stateNames}, which ${step.stateIds.size === 1 ? 'is not an accept state' : 'are not accept states'}.`;
                spoken = 'Rejected. Ended in a non-accept state.';
            }
        } else if (this.stepIndex === 0) {
            html = `Start: ${stateNames}. Step 0 of ${totalSteps}.`;
            spoken = `Start. Step 0 of ${totalSteps}.`;
        } else {
            const symbol = GeometryUtils.escapeHtml(step.symbol);
            html = `Read "${symbol}" → ${stateNames}. Step ${this.stepIndex} of ${totalSteps}.`;
            spoken = `Read ${step.symbol}. Step ${this.stepIndex} of ${totalSteps}.`;
        }

        this.statusElement.innerHTML = html;
        this.announce(spoken);
    }

    /**
     * @param {string} message
     */
    renderError(message) {
        this.tapeElement.innerHTML = '';
        this.statusElement.className = 'sim-status sim-status-error';
        this.statusElement.textContent = message;
        this.updateControls();
        this.announce(message);
    }

    /**
     * @param {Set<string>} stateIds
     * @returns {string} Safe HTML listing the states' KaTeX-rendered names, e.g. {q0, q1}.
     */
    describeStates(stateIds) {
        if (stateIds.size === 0) return 'no state';
        const names = this.graph.nodes
            .filter(node => stateIds.has(node.id))
            .map(node => `<span class="sim-state-name">${GeometryUtils.renderKatex(node.name) || GeometryUtils.escapeHtml(node.id)}</span>`);
        return names.length === 1 ? names[0] : `{${names.join(', ')}}`;
    }

    updateTypeBadge() {
        if (!this.typeBadgeElement) return;
        if (this.graph.nodes.length === 0) {
            this.typeBadgeElement.textContent = '';
            this.typeBadgeElement.title = '';
            return;
        }
        const isDfa = new AutomatonSimulator(this.graph).isDeterministic();
        this.typeBadgeElement.textContent = isDfa ? 'DFA' : 'NFA';
        this.typeBadgeElement.title = isDfa
            ? 'Deterministic: one start state, no ε-transitions, at most one transition per symbol from each state.'
            : 'Non-deterministic: several start states, ε-transitions, or several transitions on the same symbol. All paths are tried at once.';
    }

    updateControls() {
        const hasRun = this.result !== null;
        this.stepBackButton.disabled = !hasRun || this.stepIndex === 0;
        this.stepForwardButton.disabled = hasRun && this.isAtEnd;
        this.resetButton.disabled = !hasRun;
        const isPlaying = this.playTimerId !== null;
        this.playButton.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play step by step');
        this.playButton.title = isPlaying ? 'Pause' : 'Play step by step';
        this.playButton.querySelector('[data-icon="play"]')?.classList.toggle('hidden', isPlaying);
        this.playButton.querySelector('[data-icon="pause"]')?.classList.toggle('hidden', !isPlaying);
    }
}
