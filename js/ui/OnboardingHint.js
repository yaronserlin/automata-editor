/**
 * A short, dismissible on-canvas guide for first-time visitors. It walks
 * through the three core actions - add a state, connect two states, test an
 * input - advancing as the user does each one, and never shows again once
 * finished or dismissed.
 */
export class OnboardingHint {
    static STORAGE_KEY = 'automata-editor:onboarding-done:v1';

    /**
     * @param {Object} elements
     * @param {HTMLElement} elements.hintElement
     * @param {HTMLElement} elements.textElement
     * @param {HTMLButtonElement} elements.dismissButton
     * @param {HTMLButtonElement} elements.helpButton
     * @param {() => void} openHelp
     */
    constructor({ hintElement, textElement, dismissButton, helpButton }, openHelp) {
        this.hintElement = hintElement;
        this.textElement = textElement;
        this.isTouch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
        this.stage = null;
        this.suppressed = false;
        this.baseline = { nodes: 0, edges: 0 };

        // On small screens the hint leaves its overlay spot on the canvas and
        // sits above the canvas in the layout flow, so it never covers the
        // diagram. Re-check whenever the viewport crosses the breakpoint.
        this.canvasContainer = hintElement.parentElement;
        this.smallScreenQuery = typeof window.matchMedia === 'function'
            ? window.matchMedia('(max-width: 639px)')
            : null;
        if (this.smallScreenQuery) {
            const onBreakpointChange = () => this.updatePlacement();
            if (typeof this.smallScreenQuery.addEventListener === 'function') {
                this.smallScreenQuery.addEventListener('change', onBreakpointChange);
            } else if (typeof this.smallScreenQuery.addListener === 'function') {
                this.smallScreenQuery.addListener(onBreakpointChange);
            }
        }
        this.updatePlacement();

        dismissButton.addEventListener('click', () => this.finish());
        helpButton.addEventListener('click', () => openHelp());
    }

    /**
     * Shows the hint if this browser has not completed or dismissed it before.
     * @param {{nodes: number, edges: number}} counts - The diagram's current size.
     */
    start(counts) {
        if (this.readDone()) return;
        this.baseline = { ...counts };
        this.setStage('add-state');
    }

    /**
     * Advances the hint when the user has done the current step.
     * @param {{nodes: number, edges: number}} counts
     */
    observeDiagram(counts) {
        if (this.stage === 'add-state' && counts.nodes > this.baseline.nodes) {
            this.baseline = { ...counts };
            this.setStage('add-edge');
        } else if (this.stage === 'add-edge' && counts.edges > this.baseline.edges) {
            this.setStage('simulate');
        }
    }

    observeSimulationRun() {
        if (this.stage === 'simulate') this.finish();
    }

    /**
     * Temporarily hides the hint (e.g. while the "drawing a transition" banner uses the same spot).
     * @param {boolean} suppressed
     */
    setSuppressed(suppressed) {
        this.suppressed = suppressed;
        this.updateVisibility();
    }

    /**
     * @param {'add-state'|'add-edge'|'simulate'} stage
     */
    setStage(stage) {
        this.stage = stage;
        const texts = this.isTouch
            ? {
                'add-state': 'Double-tap the canvas to add a state.',
                'add-edge': 'Connect two states: double-tap a state, keep your finger down, and drag to the target.',
                'simulate': 'Now test it: type a string in "Test input" above and tap Run.'
            }
            : {
                'add-state': 'Double-click the canvas to add a state (or press N).',
                'add-edge': 'Connect two states: hold Shift and drag from one state to another.',
                'simulate': 'Now test it: type a string in "Test input" above and press Enter.'
            };
        this.textElement.textContent = texts[stage];
        this.updateVisibility();
    }

    finish() {
        this.stage = null;
        this.updateVisibility();
        try {
            localStorage.setItem(OnboardingHint.STORAGE_KEY, '1');
        } catch (error) {
            // Storage blocked: the hint will simply show again next visit.
        }
    }

    /**
     * Keeps the hint off the canvas on small screens: below the 640px
     * breakpoint it moves out of the canvas container and becomes a full-width
     * bar above the canvas instead of an overlay covering it. On larger
     * screens it returns to its original on-canvas spot.
     */
    updatePlacement() {
        const container = this.canvasContainer;
        if (!container || !container.parentElement) return;
        const inline = Boolean(this.smallScreenQuery && this.smallScreenQuery.matches);
        if (inline && this.hintElement.parentElement === container) {
            // Insert as a sibling above <main>, not inside it: main justifies
            // its children to the center, so an in-flow child there would push
            // the fixed-height canvas past both edges and get clipped by
            // main's own overflow. As a body-level flex item above main, the
            // hint takes space from the flex column and main (flex-1 min-h-0)
            // shrinks around it, which also retriggers the canvas resize observer.
            const main = container.parentElement;
            main.parentElement.insertBefore(this.hintElement, main);
            this.hintElement.classList.add('onboarding-hint--inline');
        } else if (!inline && this.hintElement.parentElement !== container) {
            container.insertBefore(this.hintElement, container.firstChild);
            this.hintElement.classList.remove('onboarding-hint--inline');
        }
    }

    updateVisibility() {
        this.hintElement.classList.toggle('hidden', this.stage === null || this.suppressed);
    }

    /** @returns {boolean} */
    readDone() {
        try {
            return localStorage.getItem(OnboardingHint.STORAGE_KEY) === '1';
        } catch (error) {
            return false;
        }
    }
}
