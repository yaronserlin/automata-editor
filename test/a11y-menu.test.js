import { describe, it, expect } from 'vitest';
import {
    STORAGE_KEY, FONT_STEPS, DEFAULT_PREFS, loadPrefs, applyPrefs, panelPosition
} from '../js/ui/AccessibilityMenu.js';

const storageWith = (value) => ({ getItem: (key) => (key === STORAGE_KEY ? value : null) });

function fakeRoot() {
    const classes = new Set();
    return {
        style: {},
        classList: {
            toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
            contains: (name) => classes.has(name)
        }
    };
}

describe('accessibility menu preferences', () => {
    it('falls back to defaults when nothing or garbage is stored', () => {
        expect(loadPrefs(storageWith(null))).toEqual(DEFAULT_PREFS);
        expect(loadPrefs(storageWith('{not json'))).toEqual(DEFAULT_PREFS);
        expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
    });

    it('restores saved values and clamps a bad font step', () => {
        expect(loadPrefs(storageWith(JSON.stringify({ fontStep: 2, highContrast: true }))))
            .toEqual({ fontStep: 2, highContrast: true, underlineLinks: false });
        expect(loadPrefs(storageWith(JSON.stringify({ fontStep: 99 }))).fontStep).toBe(FONT_STEPS.length - 1);
        expect(loadPrefs(storageWith(JSON.stringify({ fontStep: 'x' }))).fontStep).toBe(0);
    });

    it('applies font size and classes to the root', () => {
        const root = fakeRoot();
        applyPrefs(root, { fontStep: 3, highContrast: true, underlineLinks: false });
        expect(root.style.fontSize).toBe('150%');
        expect(root.classList.contains('a11y-high-contrast')).toBe(true);
        expect(root.classList.contains('a11y-underline-links')).toBe(false);
        applyPrefs(root, DEFAULT_PREFS);
        expect(root.style.fontSize).toBe('100%');
        expect(root.classList.contains('a11y-high-contrast')).toBe(false);
    });
});

describe('accessibility panel placement', () => {
    const viewport = { width: 390, height: 844 };
    const panel = { width: 240, height: 230 };

    it('opens under the button, right-aligned to it', () => {
        expect(panelPosition({ top: 8, bottom: 40, right: 382 }, panel, viewport)).toEqual({ top: 48, left: 142 });
    });

    it('stays inside the left edge', () => {
        expect(panelPosition({ top: 8, bottom: 40, right: 100 }, panel, viewport).left).toBe(8);
    });

    it('flips above the button when there is no room below', () => {
        expect(panelPosition({ top: 780, bottom: 828, right: 382 }, panel, viewport).top).toBe(780 - 8 - 230);
    });
});
