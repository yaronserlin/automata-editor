import { AutomatonGraph } from '../core/AutomatonGraph.js';
import { GeometryUtils } from '../geometry/GeometryUtils.js';

/**
 * Triggers a browser download of the given content.
 * @param {string} content
 * @param {string} fileName
 * @param {string} mimeType
 */
function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
}

/**
 * Saves and loads a diagram as a structured JSON project file.
 */
export class ProjectFile {
    /**
     * @param {AutomatonGraph} graph
     * @param {{panPositionX: number, panPositionY: number, zoom: number}} camera
     */
    static save(graph, camera) {
        downloadFile(JSON.stringify(graph.toJSON(camera), null, 2), 'automata_project.json', 'application/json');
    }

    /**
     * @param {File} file
     * @returns {Promise<{graph: AutomatonGraph, panPositionX: number, panPositionY: number, zoom: number, droppedCount: number}>}
     */
    static load(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = readerEvent => {
                let parsedData;
                try {
                    parsedData = JSON.parse(readerEvent.target.result);
                } catch (error) {
                    reject(new Error('Error parsing the file. Please ensure it is valid JSON.'));
                    return;
                }
                const result = AutomatonGraph.fromRaw(parsedData);
                if (!result) {
                    reject(new Error('Invalid project file structure.'));
                    return;
                }
                resolve(result);
            };
            reader.readAsText(file);
        });
    }
}

/**
 * Exports a diagram to standalone SVG or LaTeX/TikZ source.
 */
export class DiagramExporter {
    /**
     * @param {AutomatonGraph} graph
     * @param {SVGSVGElement} svgElement
     * @returns {string} A self-contained, cropped SVG document string.
     */
    static toSvgString(graph, svgElement) {
        const svgClone = svgElement.cloneNode(true);
        svgClone.removeAttribute('id');

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        graph.nodes.forEach(node => {
            minX = Math.min(minX, node.positionX - 80);
            minY = Math.min(minY, node.positionY - 80);
            maxX = Math.max(maxX, node.positionX + 80);
            maxY = Math.max(maxY, node.positionY + 80);
        });
        if (graph.nodes.length > 0) {
            svgClone.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
            svgClone.setAttribute('width', maxX - minX);
            svgClone.setAttribute('height', maxY - minY);
        }

        const selectionBoxClone = svgClone.querySelector('#selection-box');
        if (selectionBoxClone) selectionBoxClone.remove();

        graph.nodes.forEach(node => {
            const nodeGroup = svgClone.querySelector(`.node[data-id="${node.id}"]`);
            if (!nodeGroup) return;
            const foreignObject = nodeGroup.querySelector('foreignObject');
            if (foreignObject) foreignObject.remove();

            const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElement.setAttribute('class', 'node-text');
            textElement.setAttribute('text-anchor', 'middle');
            textElement.setAttribute('dominant-baseline', 'central');
            textElement.setAttribute('font-family', 'serif');
            textElement.setAttribute('font-size', '18px');
            textElement.setAttribute('fill', '#333');
            textElement.innerHTML = GeometryUtils.convertLatexToSvgText(node.name);
            nodeGroup.appendChild(textElement);
        });

        graph.edges.forEach(edge => {
            const edgeGroup = svgClone.querySelector(`.edge[data-id="${edge.id}"]`);
            if (!edgeGroup) return;
            const foreignObject = edgeGroup.querySelector('foreignObject');
            if (foreignObject) foreignObject.remove();

            const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElement.setAttribute('text-anchor', 'middle');
            textElement.setAttribute('dominant-baseline', 'central');
            textElement.setAttribute('font-family', 'serif');
            textElement.setAttribute('font-size', '16px');
            textElement.setAttribute('fill', '#333');
            textElement.setAttribute('paint-order', 'stroke');
            textElement.setAttribute('stroke', 'white');
            textElement.setAttribute('stroke-width', '4px');
            textElement.setAttribute('stroke-linecap', 'round');
            textElement.setAttribute('stroke-linejoin', 'round');

            const labelPositionX = edgeGroup.dataset.labelX;
            const labelPositionY = edgeGroup.dataset.labelY;
            const labelLines = edge.label.split('\n');
            labelLines.forEach((lineText, index) => {
                const textSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                textSpan.setAttribute('x', labelPositionX);
                textSpan.setAttribute('y', labelPositionY);
                if (labelLines.length > 1) {
                    textSpan.setAttribute('dy', `${(index - (labelLines.length - 1) / 2) * 1.2}em`);
                }
                textSpan.innerHTML = GeometryUtils.convertLatexToSvgText(lineText);
                textElement.appendChild(textSpan);
            });
            edgeGroup.appendChild(textElement);
        });

        const stylesElement = document.createElement('style');
        stylesElement.textContent = `
            .node-circle { fill: white; stroke: #333; stroke-width: 2px; }
            .accept-circle { fill: none; stroke: #333; stroke-width: 1.5px; }
            .start-arrow { fill: none; stroke: #333; stroke-width: 2px; }
            .edge-path { fill: none; stroke: #666; stroke-width: 2px; }
        `;
        svgClone.prepend(stylesElement);

        const serializer = new XMLSerializer();
        let sourceString = serializer.serializeToString(svgClone);
        if (!sourceString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
            sourceString = sourceString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        return `<?xml version="1.0" standalone="no"?>\r\n${sourceString}`;
    }

    /**
     * @param {AutomatonGraph} graph
     * @param {SVGSVGElement} svgElement
     */
    static downloadSvg(graph, svgElement) {
        downloadFile(DiagramExporter.toSvgString(graph, svgElement), 'automata.svg', 'image/svg+xml;charset=utf-8');
    }

    /**
     * @param {AutomatonGraph} graph
     * @returns {string} A standalone LaTeX/TikZ document string.
     */
    static toTikzString(graph) {
        let latexSource = '\\documentclass{standalone}\n\\usepackage{tikz}\n\\usetikzlibrary{automata, positioning, arrows}\n\\begin{document}\n\\begin{tikzpicture}[>=stealth, shorten >=1pt, auto, node distance=2cm, initial text=]\n\n';

        graph.nodes.forEach(node => {
            const options = ['state'];
            if (node.isStart) options.push('initial', 'initial by arrow');
            if (node.isAccept) options.push('accepting');
            const mappedX = (node.positionX / 50).toFixed(2);
            const mappedY = (-node.positionY / 50).toFixed(2);
            latexSource += `  \\node[${options.join(', ')}] (${node.id}) at (${mappedX}, ${mappedY}) {$${node.name}$};\n`;
        });

        latexSource += '\n  \\path[->]\n';

        graph.edges.forEach(edge => {
            const sourceNode = graph.getNodeById(edge.sourceId);
            const targetNode = graph.getNodeById(edge.targetId);
            const formattedLabel = edge.label.split('\n').map(line => `$${line}$`).join(' \\\\ ');
            const edgeOptions = ['align=center'];

            if (edge.isSelfLoop) {
                edgeOptions.push('loop');
                const degrees = (edge.loopAngle * 180 / Math.PI + 360) % 360;
                if (degrees > 315 || degrees <= 45) edgeOptions.push('loop right');
                else if (degrees > 45 && degrees <= 135) edgeOptions.push('loop below');
                else if (degrees > 135 && degrees <= 225) edgeOptions.push('loop left');
                else edgeOptions.push('loop above');
            } else if (edge.curveOffset && Math.abs(edge.curveOffset) > 1) {
                const bendDirection = edge.curveOffset > 0 ? 'bend right' : 'bend left';
                edgeOptions.push(`${bendDirection}=${Math.min(90, Math.abs(edge.curveOffset))}`);
            }

            latexSource += `    (${sourceNode.id}) edge [${edgeOptions.join(', ')}] node {${formattedLabel}} (${targetNode.id})\n`;
        });

        latexSource += '  ;\n\\end{tikzpicture}\n\\end{document}';
        return latexSource;
    }

    /**
     * @param {AutomatonGraph} graph
     */
    static downloadTikz(graph) {
        downloadFile(DiagramExporter.toTikzString(graph), 'automata.tex', 'text/plain');
    }
}
