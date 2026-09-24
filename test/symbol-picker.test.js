import { describe, it, expect } from 'vitest';
import {
    RECENT_STORAGE_KEY, MAX_RECENT, COMMON_SYMBOLS, DIGITS,
    extractSymbols, rememberSymbols, loadRecent, saveRecent, insertSymbol
} from '../js/ui/SymbolPicker.js';

const memoryStorage = (initial = {}) => {
    const data = { ...initial };
    return {
        getItem: key => (key in data ? data[key] : null),
        setItem: (key, value) => { data[key] = String(value); },
        data
    };
};

describe('symbol picker: fixed rows', () => {
    it('offers epsilon, empty set, Sigma, delta, subscript, and digits 0-9', () => {
        expect(COMMON_SYMBOLS.map(s => s.insert)).toEqual(['\\epsilon', '\\emptyset', '\\Sigma', '\\delta', '_{}']);
        expect(DIGITS).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    });
});

describe('symbol picker: learning recent symbols', () => {
    it('splits a label on commas and new lines, trimmed and without duplicates', () => {
        expect(extractSymbols('a, b\nc , a')).toEqual(['a', 'b', 'c']);
    });

    it('skips symbols already on the fixed rows, epsilon spellings, blanks, and long tokens', () => {
        expect(extractSymbols('\\epsilon, ε, \\lambda, 5, \\Sigma, , x, this is not a symbol')).toEqual(['x']);
    });

    it('keeps multi-digit symbols and LaTeX the user typed', () => {
        expect(extractSymbols('10, \\alpha, q_{1}')).toEqual(['10', '\\alpha', 'q_{1}']);
    });

    it('moves new symbols to the front and caps the list', () => {
        expect(rememberSymbols(['a', 'b', 'c'], 'c, d')).toEqual(['c', 'd', 'a', 'b']);
        const many = Array.from({ length: 20 }, (_, i) => `s${i}`).join(',');
        expect(rememberSymbols([], many)).toHaveLength(MAX_RECENT);
    });

    it('leaves the list alone when the label has nothing new to learn', () => {
        expect(rememberSymbols(['a'], '\\epsilon, 1')).toEqual(['a']);
    });
});

describe('symbol picker: storage', () => {
    it('round-trips through storage', () => {
        const storage = memoryStorage();
        saveRecent(storage, ['a', '\\alpha']);
        expect(storage.data[RECENT_STORAGE_KEY]).toBe('["a","\\\\alpha"]');
        expect(loadRecent(storage)).toEqual(['a', '\\alpha']);
    });

    it('ignores missing, broken, or tampered data', () => {
        expect(loadRecent(null)).toEqual([]);
        expect(loadRecent(memoryStorage({ [RECENT_STORAGE_KEY]: '{oops' }))).toEqual([]);
        expect(loadRecent(memoryStorage({ [RECENT_STORAGE_KEY]: '{"a":1}' }))).toEqual([]);
        expect(loadRecent(memoryStorage({ [RECENT_STORAGE_KEY]: '[1, "a", "a", "", "\\\\epsilon", "b"]' }))).toEqual(['a', 'b']);
    });

    it('survives storage that throws on write', () => {
        expect(() => saveRecent({ setItem: () => { throw new Error('full'); } }, ['a'])).not.toThrow();
    });
});

describe('symbol picker: inserting', () => {
    it('inserts at the cursor, replacing any selection', () => {
        expect(insertSymbol('ab', 1, 1, { insert: '\\delta' })).toEqual({ value: 'a\\deltab', cursor: 7 });
        expect(insertSymbol('a, b', 3, 4, { insert: '7' })).toEqual({ value: 'a, 7', cursor: 4 });
    });

    it('wraps the selection for subscripts, or leaves the cursor inside the braces', () => {
        const subscript = COMMON_SYMBOLS[4];
        expect(insertSymbol('q1', 1, 2, subscript)).toEqual({ value: 'q_{1}', cursor: 5 });
        expect(insertSymbol('q', 1, 1, subscript)).toEqual({ value: 'q_{}', cursor: 3 });
    });

    it('adds a comma before a recent symbol that would otherwise join the previous one', () => {
        expect(insertSymbol('a', 1, 1, { insert: 'b', asListItem: true }).value).toBe('a, b');
        expect(insertSymbol('a, ', 3, 3, { insert: 'b', asListItem: true }).value).toBe('a, b');
        expect(insertSymbol('', 0, 0, { insert: 'b', asListItem: true }).value).toBe('b');
        expect(insertSymbol('a\n', 2, 2, { insert: 'b', asListItem: true }).value).toBe('a\nb');
    });

    it('treats epsilon and the empty set as whole symbols, but not Sigma, delta, or digits', () => {
        const [epsilon, emptyset, sigma, delta] = COMMON_SYMBOLS;
        expect(insertSymbol('a', 1, 1, epsilon).value).toBe('a, \\epsilon');
        expect(insertSymbol('a', 1, 1, emptyset).value).toBe('a, \\emptyset');
        expect(insertSymbol('a', 1, 1, sigma).value).toBe('a\\Sigma');
        expect(insertSymbol('\\hat', 4, 4, delta).value).toBe('\\hat\\delta');
        expect(insertSymbol('1', 1, 1, { insert: '0' }).value).toBe('10');
    });
});
