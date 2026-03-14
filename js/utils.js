/**
 * Renders mathematical text using KaTeX.
 * @param {string} text - The input text or LaTeX equation.
 * @returns {string} The HTML string representing the rendered math, or original text if it fails.
 */
function renderKatex(text) {
    if (!text) return "";
    try { return katex.renderToString(text, { throwOnError: false }); }
    catch (error) { return text; }
}

/**
 * Gets the actual, accurate mouse position relative to SVG coordinates - regardless of zoom level or canvas location.
 * @param {MouseEvent} event - The mouse event triggered on the canvas.
 * @returns {{positionX: number, positionY: number}} The precise coordinates within the SVG space.
 */
function getMousePosition(event) {
    const svgPoint = svgCanvas.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;

    const currentTransformationMatrix = svgCanvas.getScreenCTM();
    if (currentTransformationMatrix) {
        const transformedPoint = svgPoint.matrixTransform(currentTransformationMatrix.inverse());
        return { positionX: transformedPoint.x, positionY: transformedPoint.y };
    }

    return { positionX: event.clientX, positionY: event.clientY };
}

/**
 * Helper function for smart conversion of mathematical text into SVG Tspan elements.
 * @param {string} latexStr - The LaTeX formatting string to convert.
 * @returns {string} The generated SVG compatible representation.
 */
function convertLatexToSvgText(latexStr) {
    const latexMap = {
        '\\epsilon': 'ε', '\\Sigma': 'Σ', '\\rightarrow': '→', '\\leftarrow': '←',
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\pi': 'π',
        '\\tau': 'τ', '\\emptyset': '∅', '\\infty': '∞', '\\ge': '≥', '\\le': '≤', '\\neq': '≠',
        '\\sqcup': '⊔', '\\sqcap': '⊓', '\\cup': '∪', '\\cap': '∩', '\\vee': '∨', '\\wedge': '∧',
        '\\times': '×', '\\cdot': '·', '\\oplus': '⊕', '\\otimes': '⊗', '\\equiv': '≡',
        '\\approx': '≈', '\\subset': '⊂', '\\subseteq': '⊆', '\\supset': '⊃', '\\supseteq': '⊇',
        '\\in': '∈', '\\notin': '∉', '\\to': '→', '\\gets': '←', '\\leftrightarrow': '↔'
    };
    let latexString = latexStr;
    for (const [key, value] of Object.entries(latexMap)) {
        latexString = latexString.split(key).join(value);
    }
    // Convert subscript and superscript to native SVG baseline alignments
    latexString = latexString.replace(/_\{([^}]+)\}/g, '<tspan baseline-shift="sub" font-size="0.75em">$1</tspan>');
    latexString = latexString.replace(/_([a-zA-Z0-9])/g, '<tspan baseline-shift="sub" font-size="0.75em">$1</tspan>');
    latexString = latexString.replace(/\^\{([^}]+)\}/g, '<tspan baseline-shift="super" font-size="0.75em">$1</tspan>');
    latexString = latexString.replace(/\^([a-zA-Z0-9])/g, '<tspan baseline-shift="super" font-size="0.75em">$1</tspan>');
    return latexString;
}
