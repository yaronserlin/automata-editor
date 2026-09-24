import { describe, it, expect } from 'vitest';
import { GeometryUtils } from '../js/geometry/GeometryUtils.js';

describe('GeometryUtils.escapeHtml', () => {
    it('escapes all five HTML-special characters', () => {
        expect(GeometryUtils.escapeHtml(`<img src=x onerror=alert(1)> & "quoted" 'single'`)).toBe(
            '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quoted&quot; &#39;single&#39;'
        );
    });

    it('leaves plain text untouched', () => {
        expect(GeometryUtils.escapeHtml('q_{0}')).toBe('q_{0}');
    });

    it('coerces non-string input', () => {
        expect(GeometryUtils.escapeHtml(42)).toBe('42');
    });
});

describe('GeometryUtils.convertLatexToSvgText', () => {
    it('escapes HTML special characters instead of injecting them raw (XSS regression guard)', () => {
        const malicious = '<image href=x onerror=alert(document.domain)>';
        const result = GeometryUtils.convertLatexToSvgText(malicious);
        expect(result).not.toContain('<image');
        expect(result).toContain('&lt;image');
    });

    it('substitutes known LaTeX macros to their unicode symbol', () => {
        expect(GeometryUtils.convertLatexToSvgText('\\epsilon')).toBe('ε');
        expect(GeometryUtils.convertLatexToSvgText('a \\rightarrow b')).toBe('a → b');
    });

    it('wraps subscripts in a safe, self-generated tspan', () => {
        expect(GeometryUtils.convertLatexToSvgText('q_{0}')).toBe('q<tspan baseline-shift="sub" font-size="0.75em">0</tspan>');
        expect(GeometryUtils.convertLatexToSvgText('q_1')).toBe('q<tspan baseline-shift="sub" font-size="0.75em">1</tspan>');
    });

    it('wraps superscripts in a safe, self-generated tspan', () => {
        expect(GeometryUtils.convertLatexToSvgText('x^{2}')).toBe('x<tspan baseline-shift="super" font-size="0.75em">2</tspan>');
    });
});

describe('GeometryUtils.computeAxisSnap', () => {
    it('snaps to another node exactly on the axis when within the snap distance', () => {
        const otherNodes = [{ positionX: 100, positionY: 50 }];
        expect(GeometryUtils.computeAxisSnap(otherNodes, 105, 'positionX')).toEqual({ value: 100, snapped: true });
    });

    it('does not snap when outside the snap distance', () => {
        const otherNodes = [{ positionX: 100, positionY: 50 }];
        expect(GeometryUtils.computeAxisSnap(otherNodes, 150, 'positionX')).toEqual({ value: 150, snapped: false });
    });

    it('snaps to an equal-spacing position between two other nodes', () => {
        const otherNodes = [{ positionX: 0, positionY: 0 }, { positionX: 100, positionY: 0 }];
        expect(GeometryUtils.computeAxisSnap(otherNodes, 205, 'positionX')).toEqual({ value: 200, snapped: true });
    });

    it('ignores candidate pairs closer together than the minimum spacing', () => {
        const otherNodes = [{ positionX: 0, positionY: 0 }, { positionX: 10, positionY: 0 }];
        expect(GeometryUtils.computeAxisSnap(otherNodes, 1000, 'positionX')).toEqual({ value: 1000, snapped: false });
    });

    it('works identically on the Y axis', () => {
        const otherNodes = [{ positionX: 0, positionY: 300 }];
        expect(GeometryUtils.computeAxisSnap(otherNodes, 296, 'positionY')).toEqual({ value: 300, snapped: true });
    });
});

describe('GeometryUtils.computeEdgePathAndLabelPosition', () => {
    const NODE_RADIUS = 30;

    it('draws a straight line between two distinct nodes with no curve offset', () => {
        const edge = { label: 'a', curveOffset: 0, isSelfLoop: false };
        const sourceNode = { positionX: 0, positionY: 0 };
        const targetNode = { positionX: 100, positionY: 0 };

        const { pathData, labelPositionX, labelPositionY } = GeometryUtils.computeEdgePathAndLabelPosition(edge, sourceNode, targetNode, NODE_RADIUS);

        expect(pathData).toBe('M 30,0 L 70,0');
        expect(labelPositionX).toBeCloseTo(50, 5);
        expect(labelPositionY).not.toBe(0);
    });

    it('curves through a quadratic control point when curveOffset is set', () => {
        const edge = { label: 'a', curveOffset: 40, isSelfLoop: false };
        const sourceNode = { positionX: 0, positionY: 0 };
        const targetNode = { positionX: 100, positionY: 0 };

        const { pathData } = GeometryUtils.computeEdgePathAndLabelPosition(edge, sourceNode, targetNode, NODE_RADIUS);
        expect(pathData).toContain(' Q ');
    });

    it('draws a self-loop arc using the loop angle', () => {
        const node = { positionX: 200, positionY: 200 };
        const edge = { label: 'a', loopAngle: -Math.PI / 2, isSelfLoop: true };

        const { pathData, labelPositionX, labelPositionY } = GeometryUtils.computeEdgePathAndLabelPosition(edge, node, node, NODE_RADIUS);

        expect(pathData).toMatch(/^M .* A .* 0 1 1 .*/);
        expect(labelPositionY).toBeLessThan(node.positionY);
        expect(labelPositionX).toBeCloseTo(node.positionX, 5);
    });
});

describe('GeometryUtils.getLatexError', () => {
    /** Installs a fake global katex that throws the given KaTeX-style message. */
    function withFakeKatex(errorMessage, callback) {
        const previous = globalThis.katex;
        globalThis.katex = {
            renderToString(text) {
                if (errorMessage && text.includes('BAD')) throw new Error(errorMessage);
                return '<span></span>';
            }
        };
        try {
            callback();
        } finally {
            if (previous === undefined) delete globalThis.katex;
            else globalThis.katex = previous;
        }
    }

    it('returns null when KaTeX is not loaded', () => {
        expect(GeometryUtils.getLatexError('\\frac{')).toBeNull();
    });

    it('returns null for valid or empty labels', () => {
        withFakeKatex('KaTeX parse error: whatever', () => {
            expect(GeometryUtils.getLatexError('q_{0}')).toBeNull();
            expect(GeometryUtils.getLatexError('')).toBeNull();
        });
    });

    it('explains an unclosed brace in plain words', () => {
        withFakeKatex("KaTeX parse error: Expected '}', got 'EOF' at end of input: BAD", () => {
            expect(GeometryUtils.getLatexError('BAD')).toBe('Invalid LaTeX: a { is never closed. Add the missing }.');
        });
    });

    it('names an unknown command', () => {
        withFakeKatex('KaTeX parse error: Undefined control sequence: \\foo at position 1: BAD', () => {
            expect(GeometryUtils.getLatexError('BAD')).toMatch(/unknown command \\foo/);
        });
    });

    it('checks every line of a multi-line label', () => {
        withFakeKatex("KaTeX parse error: Expected 'EOF', got '}' at position 2: BAD", () => {
            expect(GeometryUtils.getLatexError('a, b\nBAD')).toMatch(/extra \}/);
        });
    });
});
