import { describe, it, expect } from 'vitest';
import { KatexLayout } from '../js/rendering/KatexLayout.js';

/** Minimal stand-in for a DOM element: just the parts KatexLayout touches. */
function fakeElement(style = {}, children = []) {
    return { style: { position: 'relative', ...style }, children };
}

function fakeRoot({ bases = [], vlists = [] }) {
    return {
        querySelectorAll(selector) {
            if (selector === '.katex .base') return bases;
            if (selector === '.katex .vlist') return vlists;
            return [];
        }
    };
}

describe('KatexLayout.parseEm', () => {
    it('reads em lengths, treats empty as 0, and rejects other units', () => {
        expect(KatexLayout.parseEm('-2.55em')).toBe(-2.55);
        expect(KatexLayout.parseEm('.5em')).toBe(0.5);
        expect(KatexLayout.parseEm('')).toBe(0);
        expect(KatexLayout.parseEm(undefined)).toBe(0);
        expect(KatexLayout.parseEm('4px')).toBeNull();
    });
});

describe('KatexLayout.flattenForForeignObject', () => {
    it('turns positioned vlist rows into margins that land each row at the same place', () => {
        const rowA = fakeElement({ top: '-2.55em' });
        const rowB = fakeElement({ top: '-3.063em' });
        const rowC = fakeElement({ top: '' });
        const vlist = fakeElement({ height: '0.3em' }, [rowA, rowB, rowC]);
        const base = fakeElement();

        KatexLayout.flattenForForeignObject(fakeRoot({ bases: [base], vlists: [vlist] }));

        expect(base.style.position).toBe('static');
        expect(vlist.style.position).toBe('static');
        [rowA, rowB, rowC].forEach(row => {
            expect(row.style.position).toBe('static');
            expect(row.style.top).toBe('');
        });
        expect(rowA.style.marginTop).toBe('-2.55em');
        expect(rowB.style.marginTop).toBe('-0.513em');
        expect(rowC.style.marginTop).toBe('3.063em');
        // Zero-height rows stack, so the running sum of margins equals each original top.
        const running = [rowA, rowB, rowC].map(r => parseFloat(r.style.marginTop))
            .reduce((acc, m) => [...acc, +((acc.at(-1) ?? 0) + m).toFixed(4)], []);
        expect(running).toEqual([-2.55, -3.063, 0]);
    });

    it('leaves a vlist alone when a row is not shifted in em', () => {
        const row = fakeElement({ top: '4px' });
        const vlist = fakeElement({}, [row]);
        KatexLayout.flattenForForeignObject(fakeRoot({ vlists: [vlist] }));
        expect(vlist.style.position).toBe('relative');
        expect(row.style.top).toBe('4px');
    });

    it('ignores a missing root', () => {
        expect(() => KatexLayout.flattenForForeignObject(null)).not.toThrow();
    });
});
