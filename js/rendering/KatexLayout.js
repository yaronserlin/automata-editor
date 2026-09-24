/**
 * Makes KaTeX output safe to place inside an SVG <foreignObject> in Safari.
 *
 * WebKit (every Safari, desktop and iOS) paints HTML elements that get their
 * own render layer - anything with `position: relative`, `opacity`, or a
 * `transform` - in the wrong place when they sit inside a foreignObject: they
 * ignore the SVG's viewBox scale and the parent <g> transforms, so they end up
 * off to the side or piled in the canvas's top-left corner.
 * See https://bugs.webkit.org/show_bug.cgi?id=23113 and
 * https://bugs.webkit.org/show_bug.cgi?id=291732.
 *
 * KaTeX puts `position: relative` on every `.base` and on its vertical lists
 * (`.vlist` and their rows, used for subscripts, superscripts and accents),
 * so on Safari every canvas label disappears from where it belongs.
 *
 * This rewrites those elements to use normal flow instead, giving the same
 * layout without creating layers:
 * - `.base` and `.vlist` have no offset of their own, so they just become static.
 * - Each row of a `.vlist` is a zero-height block shifted with `top: <n>em`.
 *   Because the rows have zero height, they stack at one point, so the same
 *   shift can be expressed as a top margin equal to the difference from the
 *   previous row's shift.
 * Rows whose shift is not in `em` are left untouched (KaTeX always uses em).
 */
export class KatexLayout {
    /**
     * @param {string} value - An inline CSS length such as "-2.55em" or "".
     * @returns {number|null} The length in em (0 for empty), or null if not an em length.
     */
    static parseEm(value) {
        if (value === undefined || value === null || value === '') return 0;
        const match = /^(-?\d*\.?\d+)em$/.exec(String(value).trim());
        return match ? parseFloat(match[1]) : null;
    }

    /**
     * Converts the positioned rows of one KaTeX vertical list to margins.
     * @param {HTMLElement} vlist - A `.vlist` element.
     * @returns {boolean} Whether the list was converted.
     */
    static flattenVlist(vlist) {
        const rows = Array.from(vlist.children);
        const shifts = rows.map(row => KatexLayout.parseEm(row.style.top));
        if (shifts.some(shift => shift === null)) return false;

        let previousShift = 0;
        rows.forEach((row, index) => {
            const shift = shifts[index];
            row.style.position = 'static';
            row.style.top = '';
            row.style.marginTop = `${+(shift - previousShift).toFixed(4)}em`;
            previousShift = shift;
        });
        vlist.style.position = 'static';
        return true;
    }

    /**
     * Rewrites all KaTeX output under a root element so none of it creates a
     * render layer from `position: relative`. Safe to call more than once.
     * @param {HTMLElement} root
     */
    static flattenForForeignObject(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return;
        root.querySelectorAll('.katex .base').forEach(base => {
            base.style.position = 'static';
        });
        root.querySelectorAll('.katex .vlist').forEach(vlist => {
            if (vlist.style.position === 'static') return;
            KatexLayout.flattenVlist(vlist);
        });
    }
}
