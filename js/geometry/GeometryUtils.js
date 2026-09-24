import { AutomatonNode } from '../core/AutomatonNode.js';

/**
 * Stateless geometry, text-escaping, and coordinate-space helpers shared by
 * the renderer, the interaction controllers, and the diagram exporters.
 */
export class GeometryUtils {
    /** @type {Object<string, string>} LaTeX macro to unicode-symbol substitutions. */
    static LATEX_SYMBOLS = {
        '\\epsilon': 'ε', '\\Sigma': 'Σ', '\\rightarrow': '→', '\\leftarrow': '←',
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\pi': 'π',
        '\\tau': 'τ', '\\emptyset': '∅', '\\infty': '∞', '\\ge': '≥', '\\le': '≤', '\\neq': '≠',
        '\\sqcup': '⊔', '\\sqcap': '⊓', '\\cup': '∪', '\\cap': '∩', '\\vee': '∨', '\\wedge': '∧',
        '\\times': '×', '\\cdot': '·', '\\oplus': '⊕', '\\otimes': '⊗', '\\equiv': '≡',
        '\\approx': '≈', '\\subset': '⊂', '\\subseteq': '⊆', '\\supset': '⊃', '\\supseteq': '⊇',
        '\\in': '∈', '\\notin': '∉', '\\to': '→', '\\gets': '←', '\\leftrightarrow': '↔'
    };

    /**
     * Escapes HTML special characters so untrusted text is safe to insert via innerHTML.
     * @param {string} text
     * @returns {string}
     */
    static escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Renders mathematical text using KaTeX, falling back to escaped plain text on failure.
     * @param {string} text
     * @returns {string}
     */
    static renderKatex(text) {
        if (!text) return '';
        try {
            return katex.renderToString(text, { throwOnError: false, trust: false });
        } catch (error) {
            return GeometryUtils.escapeHtml(text);
        }
    }

    /**
     * Checks whether a label is valid LaTeX. KaTeX renders invalid input as red raw
     * text, which is easy to miss and hard to understand; this lets the UI explain it.
     * Multi-line labels are checked line by line, the same way they are rendered.
     * @param {string} text
     * @returns {string|null} A short, human-readable error, or null when the label is
     *   valid (or when KaTeX is not loaded, so nothing can be checked).
     */
    static getLatexError(text) {
        if (!text || typeof katex === 'undefined') return null;
        for (const line of String(text).split('\n')) {
            if (!line.trim()) continue;
            try {
                katex.renderToString(line, { throwOnError: true, trust: false });
            } catch (error) {
                return `Invalid LaTeX: ${GeometryUtils.describeLatexError(error)}`;
            }
        }
        return null;
    }

    /**
     * Turns a KaTeX parse error into a short explanation a non-LaTeX user can act on.
     * @param {*} error
     * @returns {string}
     */
    static describeLatexError(error) {
        const rawMessage = String(error && error.message ? error.message : error).replace(/^KaTeX parse error:\s*/i, '');
        const unknownCommand = rawMessage.match(/Undefined control sequence:\s*(\\[A-Za-z]+)/);
        if (unknownCommand) return `unknown command ${unknownCommand[1]}. Check the spelling (e.g. \\epsilon).`;
        const endsEarly = /end of input|got 'EOF'/i.test(rawMessage);
        if (endsEarly && /expected '}'/i.test(rawMessage)) return 'a { is never closed. Add the missing }.';
        if (endsEarly) return 'the label ends before a command is finished (for example a missing } or \\right).';
        if (/Expected 'EOF', got '}'/i.test(rawMessage)) return 'there is an extra } with no matching {.';
        if (/Double subscript|Double superscript/i.test(rawMessage)) return 'two subscripts or superscripts in a row. Group them with { }, e.g. q_{10}.';
        const shortMessage = rawMessage.replace(/\s+at position \d+:.*$/s, '').replace(/\.$/, '').trim();
        return `${shortMessage || 'this label cannot be rendered'}.`;
    }

    /**
     * Converts a LaTeX-like label into safe, self-contained SVG markup: unicode
     * symbols plus generated tspan elements for sub/superscripts.
     * @param {string} latexText
     * @returns {string}
     */
    static convertLatexToSvgText(latexText) {
        let result = GeometryUtils.escapeHtml(latexText);
        for (const [macro, symbol] of Object.entries(GeometryUtils.LATEX_SYMBOLS)) {
            result = result.split(macro).join(symbol);
        }
        result = result.replace(/_\{([^}]+)\}/g, '<tspan baseline-shift="sub" font-size="0.75em">$1</tspan>');
        result = result.replace(/_([a-zA-Z0-9])/g, '<tspan baseline-shift="sub" font-size="0.75em">$1</tspan>');
        result = result.replace(/\^\{([^}]+)\}/g, '<tspan baseline-shift="super" font-size="0.75em">$1</tspan>');
        result = result.replace(/\^([a-zA-Z0-9])/g, '<tspan baseline-shift="super" font-size="0.75em">$1</tspan>');
        return result;
    }

    /**
     * @param {SVGSVGElement} svgElement
     * @param {MouseEvent|TouchEvent} event
     * @returns {{positionX: number, positionY: number}} The event's position in SVG coordinates.
     */
    static getMousePosition(svgElement, event) {
        const svgPoint = svgElement.createSVGPoint();
        let clientX = event.clientX;
        let clientY = event.clientY;

        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else if (event.changedTouches && event.changedTouches.length > 0) {
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
        }

        svgPoint.x = clientX;
        svgPoint.y = clientY;

        const matrix = svgElement.getScreenCTM();
        if (matrix) {
            const transformed = svgPoint.matrixTransform(matrix.inverse());
            return { positionX: transformed.x, positionY: transformed.y };
        }
        return { positionX: clientX, positionY: clientY };
    }

    /**
     * Computes the SVG path data and label anchor point for an edge, for both
     * self-loops and source-to-target edges (straight or curved).
     * @param {import('../core/AutomatonEdge.js').AutomatonEdge} edge
     * @param {AutomatonNode} sourceNode
     * @param {AutomatonNode} targetNode
     * @param {number} [nodeRadius]
     * @returns {{pathData: string, labelPositionX: number, labelPositionY: number}}
     */
    static computeEdgePathAndLabelPosition(edge, sourceNode, targetNode, nodeRadius = AutomatonNode.RADIUS) {
        const labelLines = edge.label.split('\n');
        const numLines = labelLines.length;
        const maxLineLength = labelLines.reduce((max, line) => Math.max(max, line.length), 1);
        const estimatedWidth = 16 + maxLineLength * 7.5;
        const estimatedHeight = numLines * 22;

        if (edge.isSelfLoop) {
            const radius = nodeRadius;
            const angle = edge.loopAngle;
            const spread = Math.PI / 6;
            const startAngle = angle - spread;
            const endAngle = angle + spread;

            const startX = sourceNode.positionX + radius * Math.cos(startAngle);
            const startY = sourceNode.positionY + radius * Math.sin(startAngle);
            const endX = sourceNode.positionX + radius * Math.cos(endAngle);
            const endY = sourceNode.positionY + radius * Math.sin(endAngle);
            const loopRadius = radius * 0.85;
            const labelDistance = radius + loopRadius * 2 + numLines * 10;

            return {
                pathData: `M ${startX},${startY} A ${loopRadius} ${loopRadius} 0 1 1 ${endX},${endY}`,
                labelPositionX: sourceNode.positionX + labelDistance * Math.cos(angle),
                labelPositionY: sourceNode.positionY + labelDistance * Math.sin(angle)
            };
        }

        const curveOffset = edge.curveOffset || 0;
        const deltaX = targetNode.positionX - sourceNode.positionX;
        const deltaY = targetNode.positionY - sourceNode.positionY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const midpointX = (sourceNode.positionX + targetNode.positionX) / 2;
        const midpointY = (sourceNode.positionY + targetNode.positionY) / 2;
        const normalX = -deltaY / distance;
        const normalY = deltaX / distance;
        const boxRadius = Math.abs(normalX) * (estimatedWidth / 2) + Math.abs(normalY) * (estimatedHeight / 2);
        const dynamicOffset = boxRadius + 8;

        if (Math.abs(curveOffset) < 1 || distance === 0) {
            const angle = Math.atan2(deltaY, deltaX);
            const startX = sourceNode.positionX + nodeRadius * Math.cos(angle);
            const startY = sourceNode.positionY + nodeRadius * Math.sin(angle);
            const endX = targetNode.positionX - nodeRadius * Math.cos(angle);
            const endY = targetNode.positionY - nodeRadius * Math.sin(angle);
            return {
                pathData: `M ${startX},${startY} L ${endX},${endY}`,
                labelPositionX: midpointX + normalX * dynamicOffset,
                labelPositionY: midpointY + normalY * dynamicOffset
            };
        }

        const controlPointX = midpointX + normalX * curveOffset;
        const controlPointY = midpointY + normalY * curveOffset;
        const startAngle = Math.atan2(controlPointY - sourceNode.positionY, controlPointX - sourceNode.positionX);
        const startX = sourceNode.positionX + nodeRadius * Math.cos(startAngle);
        const startY = sourceNode.positionY + nodeRadius * Math.sin(startAngle);
        const endAngle = Math.atan2(targetNode.positionY - controlPointY, targetNode.positionX - controlPointX);
        const endX = targetNode.positionX - nodeRadius * Math.cos(endAngle);
        const endY = targetNode.positionY - nodeRadius * Math.sin(endAngle);
        const offsetDirection = curveOffset > 0 ? 1 : -1;
        const finalOffset = Math.abs(curveOffset) * 0.5 + dynamicOffset;

        return {
            pathData: `M ${startX},${startY} Q ${controlPointX},${controlPointY} ${endX},${endY}`,
            labelPositionX: midpointX + normalX * offsetDirection * finalOffset,
            labelPositionY: midpointY + normalY * offsetDirection * finalOffset
        };
    }

    /**
     * Finds the best axis-aligned snap target for a proposed coordinate: first an exact
     * match against another node's position on that axis, then an equal-spacing match
     * between two other nodes.
     * @param {AutomatonNode[]} otherNodes
     * @param {number} proposedValue
     * @param {'positionX'|'positionY'} axis
     * @returns {{value: number, snapped: boolean}}
     */
    static computeAxisSnap(otherNodes, proposedValue, axis) {
        const SNAP_DISTANCE = 12;
        const MIN_PAIR_SPACING = 20;

        for (const node of otherNodes) {
            if (Math.abs(proposedValue - node[axis]) < SNAP_DISTANCE) {
                return { value: node[axis], snapped: true };
            }
        }

        for (let i = 0; i < otherNodes.length; i++) {
            for (let j = i + 1; j < otherNodes.length; j++) {
                const distance = Math.abs(otherNodes[i][axis] - otherNodes[j][axis]);
                if (distance < MIN_PAIR_SPACING) continue;
                const candidates = [
                    otherNodes[i][axis] - distance, otherNodes[i][axis] + distance,
                    otherNodes[j][axis] - distance, otherNodes[j][axis] + distance
                ];
                for (const candidate of candidates) {
                    if (Math.abs(proposedValue - candidate) < SNAP_DISTANCE) {
                        return { value: candidate, snapped: true };
                    }
                }
            }
        }
        return { value: proposedValue, snapped: false };
    }
}
