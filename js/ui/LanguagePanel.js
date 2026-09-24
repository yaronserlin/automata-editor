import { LanguageAnalyzer } from '../core/LanguageAnalyzer.js';
import { GeometryUtils } from '../geometry/GeometryUtils.js';

/**
 * The "Language" row under the test-input bar: shows L(M), the language the
 * current automaton accepts, in set-builder notation or as a regular
 * expression. It is collapsed by default; while open it updates after every
 * change to the diagram. The open/closed choice is remembered in the browser.
 */
export class LanguagePanel {
    static STORAGE_KEY = 'automata-editor:language-open:v1';
    static COPY_FEEDBACK_MS = 1500;

    /**
     * @param {Object} elements
     * @param {HTMLButtonElement} elements.toggleButton
     * @param {HTMLElement} elements.outputElement
     * @param {HTMLElement} elements.expressionElement
     * @param {HTMLElement} elements.metaElement
     * @param {HTMLButtonElement} elements.copyButton
     * @param {import('../core/AutomatonGraph.js').AutomatonGraph} graph
     * @param {(message: string) => void} announce
     * @param {Storage|null} [storage]
     */
    constructor(elements, graph, announce, storage = LanguagePanel.defaultStorage()) {
        Object.assign(this, elements);
        this.graph = graph;
        this.announce = announce;
        this.storage = storage;
        this.latex = '';
        this.copyTimerId = null;

        this.isOpen = this.storage?.getItem(LanguagePanel.STORAGE_KEY) === '1';
        this.toggleButton.addEventListener('click', () => this.setOpen(!this.isOpen, true));
        this.copyButton.addEventListener('click', () => this.copyLatex());
        this.applyOpenState();
    }

    static defaultStorage() {
        try {
            return typeof localStorage !== 'undefined' ? localStorage : null;
        } catch {
            return null;
        }
    }

    /**
     * @param {boolean} open
     * @param {boolean} [announceResult]
     */
    setOpen(open, announceResult = false) {
        this.isOpen = open;
        try {
            this.storage?.setItem(LanguagePanel.STORAGE_KEY, open ? '1' : '0');
        } catch {
            // Storage can be full or blocked; the panel still works for this visit.
        }
        this.applyOpenState();
        if (open && announceResult && this.lastText) this.announce(this.lastText);
    }

    applyOpenState() {
        this.toggleButton.setAttribute('aria-expanded', String(this.isOpen));
        this.outputElement.classList.toggle('hidden', !this.isOpen);
        if (this.isOpen) this.refresh();
    }

    /**
     * Called whenever the diagram changes.
     */
    invalidate() {
        if (this.isOpen) this.refresh();
    }

    refresh() {
        let result;
        try {
            result = new LanguageAnalyzer(this.graph).analyze();
        } catch (error) {
            console.error(error);
            result = { ok: false, error: 'Could not work out the language of this diagram.' };
        }

        this.outputElement.classList.toggle('lang-output-error', !result.ok);
        if (!result.ok) {
            this.latex = '';
            this.lastText = result.error;
            this.expressionElement.textContent = result.error;
            this.metaElement.textContent = '';
            this.copyButton.classList.add('hidden');
            return;
        }

        this.latex = result.latex;
        this.lastText = result.text;
        if (typeof katex === 'undefined') this.expressionElement.textContent = result.text;
        else this.expressionElement.innerHTML = GeometryUtils.renderKatex(result.latex);
        this.expressionElement.setAttribute('aria-label', result.text);
        this.expressionElement.title = result.text;
        this.copyButton.classList.remove('hidden');

        const parts = [];
        if (result.alphabet.length > 0) parts.push(`Σ = {${result.alphabet.join(', ')}}`);
        if (result.kind === 'pattern') parts.push('set-builder form');
        if (result.kind === 'regex') parts.push('regular expression');
        if (result.note) parts.push(result.note);
        this.metaElement.textContent = parts.join(' · ');
    }

    async copyLatex() {
        if (!this.latex) return;
        try {
            await navigator.clipboard.writeText(this.latex);
            this.copyButton.textContent = 'Copied';
            this.announce('LaTeX copied');
        } catch {
            this.copyButton.textContent = 'Copy failed';
        }
        window.clearTimeout(this.copyTimerId);
        this.copyTimerId = window.setTimeout(() => {
            this.copyButton.textContent = 'Copy LaTeX';
        }, LanguagePanel.COPY_FEEDBACK_MS);
    }
}
