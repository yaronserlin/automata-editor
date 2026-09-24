import { AutomatonSimulator } from '../core/AutomatonSimulator.js';

/**
 * Quick-symbol picker for the transition-label editor: a fixed row of common
 * symbols and digits, plus a "Recent" row learned from the labels the user
 * types, kept in localStorage.
 *
 * The helpers at the top are DOM-free so they can be tested in plain Node.
 */

/** localStorage key for the recently used symbols. */
export const RECENT_STORAGE_KEY = 'automata-editor:recent-symbols';

/** Most symbols kept in the Recent row. */
export const MAX_RECENT = 8;

/** Longest token (in characters) worth remembering; longer ones are probably not symbols. */
export const MAX_SYMBOL_LENGTH = 12;

/**
 * Fixed symbols. `insert` is what goes into the label; `wrap` means the text is
 * put around the selection (or around the cursor when nothing is selected);
 * `asListItem` marks a whole symbol that gets its own comma-separated entry.
 * Σ, δ, and digits are often part of a longer symbol, so they go in as typed.
 * @type {ReadonlyArray<{insert: string, label: string, title: string, wrap?: [string, string], asListItem?: boolean}>}
 */
export const COMMON_SYMBOLS = Object.freeze([
    { insert: '\\epsilon', label: '\u03b5', title: 'Insert \\epsilon (an empty-string transition)', asListItem: true },
    { insert: '\\emptyset', label: '\u2205', title: 'Insert \\emptyset (empty set)', asListItem: true },
    { insert: '\\Sigma', label: '\u03a3', title: 'Insert \\Sigma' },
    { insert: '\\delta', label: '\u03b4', title: 'Insert \\delta' },
    { insert: '_{}', label: 'x\u2081', title: 'Subscript: wraps the selection in _{ }', wrap: ['_{', '}'] }
]);

/** Digits 0-9, inserted as typed. */
export const DIGITS = Object.freeze(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

const FIXED_INSERTS = new Set([...COMMON_SYMBOLS.map(s => s.insert), ...DIGITS]);

/**
 * @param {string} token A trimmed label token.
 * @returns {boolean} Whether the token is worth adding to the Recent row.
 */
function isRememberable(token) {
    return token.length > 0
        && token.length <= MAX_SYMBOL_LENGTH
        && !FIXED_INSERTS.has(token)
        && !AutomatonSimulator.EPSILON_TOKENS.has(token);
}

/**
 * Splits a transition label into the symbols the user typed, in order, without
 * duplicates. Symbols already on the fixed row (ε, digits, ...) are skipped.
 * @param {string} label
 * @returns {string[]}
 */
export function extractSymbols(label) {
    const seen = new Set();
    return String(label ?? '')
        .split(/[,\n]/)
        .map(token => token.trim())
        .filter(token => {
            if (!isRememberable(token) || seen.has(token)) return false;
            seen.add(token);
            return true;
        });
}

/**
 * Moves the symbols from a label to the front of the recent list.
 * @param {string[]} recent Current list, most recent first.
 * @param {string} label The label the user just finished editing.
 * @returns {string[]} New list, most recent first, at most MAX_RECENT long.
 */
export function rememberSymbols(recent, label) {
    const fresh = extractSymbols(label);
    if (fresh.length === 0) return recent.slice(0, MAX_RECENT);
    const rest = recent.filter(symbol => !fresh.includes(symbol));
    return [...fresh, ...rest].slice(0, MAX_RECENT);
}

/**
 * Reads the recent list, dropping anything malformed.
 * @param {Pick<Storage, 'getItem'> | null | undefined} storage
 * @returns {string[]}
 */
export function loadRecent(storage) {
    try {
        const saved = JSON.parse(storage?.getItem(RECENT_STORAGE_KEY) || '[]');
        if (!Array.isArray(saved)) return [];
        const seen = new Set();
        return saved
            .filter(item => typeof item === 'string')
            .map(item => item.trim())
            .filter(item => {
                if (!isRememberable(item) || seen.has(item)) return false;
                seen.add(item);
                return true;
            })
            .slice(0, MAX_RECENT);
    } catch {
        return [];
    }
}

/**
 * @param {Pick<Storage, 'setItem'> | null | undefined} storage
 * @param {string[]} recent
 */
export function saveRecent(storage, recent) {
    try {
        storage?.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent));
    } catch {
        /* storage full or blocked - the Recent row just lasts for this visit */
    }
}

/**
 * Works out the new text and cursor position after inserting into a field.
 * @param {string} value Current field text.
 * @param {number} start Selection start.
 * @param {number} end Selection end.
 * @param {{insert: string, wrap?: [string, string], asListItem?: boolean}} symbol
 *   `asListItem` adds a ", " before the symbol when the cursor sits right after
 *   another symbol, so a whole symbol from the Recent row becomes its own entry.
 * @returns {{value: string, cursor: number}}
 */
export function insertSymbol(value, start, end, symbol) {
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    if (symbol.wrap) {
        const [open, close] = symbol.wrap;
        const inserted = open + selected + close;
        const cursor = selected ? start + inserted.length : start + open.length;
        return { value: before + inserted + after, cursor };
    }
    const needsSeparator = symbol.asListItem && /[^,\s][ \t]*$/.test(before);
    const text = (needsSeparator ? ', ' : '') + symbol.insert;
    return { value: before + text + after, cursor: start + text.length };
}

/**
 * Wires the picker markup in index.html: fixed buttons carry `data-symbol-index`
 * or `data-digit`, and the Recent row is filled in here.
 */
export class SymbolPicker {
    /**
     * @param {Object} elements
     * @param {HTMLElement} elements.pickerElement Container holding the fixed buttons.
     * @param {HTMLElement} elements.recentRowElement Row shown only when there are recent symbols.
     * @param {HTMLElement} elements.recentListElement Where recent buttons go.
     * @param {HTMLTextAreaElement} elements.inputElement The transition-label field.
     * @param {Storage|null} [storage] Injected for tests; defaults to localStorage.
     */
    constructor({ pickerElement, recentRowElement, recentListElement, inputElement }, storage = SymbolPicker.defaultStorage()) {
        this.pickerElement = pickerElement;
        this.recentRowElement = recentRowElement;
        this.recentListElement = recentListElement;
        this.inputElement = inputElement;
        this.storage = storage;
        this.recent = loadRecent(storage);
        this.buttonClass = pickerElement.querySelector('button')?.className ?? '';

        pickerElement.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (!button || !pickerElement.contains(button)) return;
            if (button.dataset.symbolIndex !== undefined) {
                this.insert(COMMON_SYMBOLS[Number(button.dataset.symbolIndex)]);
            } else if (button.dataset.digit !== undefined) {
                this.insert({ insert: button.dataset.digit });
            } else if (button.dataset.recent !== undefined) {
                this.insert({ insert: button.dataset.recent, asListItem: true });
            }
        });

        // Clicking a symbol button keeps the cursor in the field instead of moving focus.
        pickerElement.addEventListener('mousedown', event => {
            if (event.target.closest('button')) event.preventDefault();
        });

        // Learn when the user leaves the field, so half-typed symbols are not
        // remembered. Moving to a picker button (e.g. with Tab) is not leaving.
        inputElement.addEventListener('blur', event => {
            if (event.relatedTarget && pickerElement.contains(event.relatedTarget)) return;
            this.remember(inputElement.value);
        });

        this.renderRecent();
    }

    /** @returns {Storage|null} */
    static defaultStorage() {
        try {
            return typeof localStorage !== 'undefined' ? localStorage : null;
        } catch {
            return null;
        }
    }

    /**
     * Inserts a symbol at the cursor, as if the user had typed it.
     * @param {{insert: string, wrap?: [string, string], asListItem?: boolean}} symbol
     */
    insert(symbol) {
        const input = this.inputElement;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const result = insertSymbol(input.value, start, end, symbol);
        input.value = result.value;
        input.focus();
        input.setSelectionRange(result.cursor, result.cursor);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * Learns the symbols from a finished label.
     * @param {string} label
     */
    remember(label) {
        const next = rememberSymbols(this.recent, label);
        if (next.join('\n') === this.recent.join('\n')) return;
        this.recent = next;
        saveRecent(this.storage, next);
        this.renderRecent();
    }

    renderRecent() {
        this.recentListElement.replaceChildren(...this.recent.map(symbol => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = this.buttonClass;
            button.dataset.recent = symbol;
            button.textContent = symbol;
            button.title = `Insert ${symbol}`;
            return button;
        }));
        this.recentRowElement.classList.toggle('hidden', this.recent.length === 0);
    }
}
