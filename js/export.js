/**
 * Export and local save/load operations for the automaton visualizer.
 */

/**
 * Utility to trigger a file download from browser memory.
 * @param {string} content - The file content.
 * @param {string} fileName - The desired name for the downloaded file.
 * @param {string} mimeType - The MIME type of the content.
 */
function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchorElement = document.createElement('a');
    anchorElement.href = objectUrl;
    anchorElement.download = fileName;
    document.body.appendChild(anchorElement);
    anchorElement.click();
    document.body.removeChild(anchorElement);
    URL.revokeObjectURL(objectUrl);
}

/**
 * Saves the current workspace state to a JSON file.
 */
function saveProject() {
    const projectData = {
        nodes: nodes,
        edges: edges,
        nodeIdCounter: nodeIdCounter,
        edgeIdCounter: edgeIdCounter,
        panPositionX: panPositionX,
        panPositionY: panPositionY,
        currentZoom: currentZoom
    };
    const jsonString = JSON.stringify(projectData, null, 2);
    downloadFile(jsonString, 'automaton_project.json', 'application/json');
}

/**
 * Load and restore a project state from an uploaded JSON file.
 * @param {Event} event - The file input change event.
 */
function loadProject(event) {
    const fileTarget = event.target.files[0];
    if (!fileTarget) return;

    const fileReader = new FileReader();
    fileReader.onload = function (readerEvent) {
        try {
            const parsedData = JSON.parse(readerEvent.target.result);
            if (parsedData.nodes && Array.isArray(parsedData.nodes) && parsedData.edges && Array.isArray(parsedData.edges)) {
                nodes = parsedData.nodes;
                edges = parsedData.edges;
                nodeIdCounter = parsedData.nodeIdCounter || nodes.length;
                edgeIdCounter = parsedData.edgeIdCounter || edges.length;
                panPositionX = parsedData.panPositionX || parsedData.panX || 0;
                panPositionY = parsedData.panPositionY || parsedData.panY || 0;
                currentZoom = parsedData.currentZoom || 1.0;

                selectedElement = null;
                selectedNodes.clear();

                zoomDisplay.textContent = Math.round(currentZoom * 100) + '%';
                updateViewBox();
                renderAll();
            } else {
                alert("Invalid project file structure.");
            }
        } catch (error) {
            alert("Error parsing the file. Please ensure it is valid JSON.");
        }
        event.target.value = ''; // Reset input to allow loading the same file again
    };
    fileReader.readAsText(fileTarget);
}

/**
 * Generates and downloads an SVG file representing the user's automaton.
 * The SVG is cropped directly around the bounds of the drawn components.
 */
function exportSVG() {
    const svgClone = svgCanvas.cloneNode(true);
    svgClone.removeAttribute('id');

    // Calculate Bounding Box to crop the image exactly around the automaton
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(node => {
        minX = Math.min(minX, node.positionX - 80);
        minY = Math.min(minY, node.positionY - 80);
        maxX = Math.max(maxX, node.positionX + 80);
        maxY = Math.max(maxY, node.positionY + 80);
    });
    if (nodes.length > 0) {
        svgClone.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
        svgClone.setAttribute('width', maxX - minX);
        svgClone.setAttribute('height', maxY - minY);
    }

    // Remove the selection box if it exists in the export
    const selectionBoxClone = svgClone.querySelector('#selection-box');
    if (selectionBoxClone) selectionBoxClone.remove();

    nodes.forEach(node => {
        const svgNodeGroup = svgClone.querySelector(`.node[data-id="${node.id}"]`);
        if (svgNodeGroup) {
            const foreignObjectElement = svgNodeGroup.querySelector('foreignObject');
            if (foreignObjectElement) foreignObjectElement.remove();

            const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
            textElement.setAttribute("class", "node-text");
            textElement.setAttribute("text-anchor", "middle");
            textElement.setAttribute("dominant-baseline", "central");
            textElement.setAttribute("font-family", "serif");
            textElement.setAttribute("font-size", "18px");
            textElement.setAttribute("fill", "#333");

            textElement.innerHTML = convertLatexToSvgText(node.name);
            svgNodeGroup.appendChild(textElement);
        }
    });

    edges.forEach(edge => {
        const edgeSVGGroup = svgClone.querySelector(`.edge[data-id="${edge.id}"]`);
        if (edgeSVGGroup) {
            const foreignObjectElement = edgeSVGGroup.querySelector('foreignObject');
            if (foreignObjectElement) foreignObjectElement.remove();

            const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
            textElement.setAttribute("text-anchor", "middle");
            textElement.setAttribute("dominant-baseline", "central");
            textElement.setAttribute("font-family", "serif");
            textElement.setAttribute("font-size", "16px");
            textElement.setAttribute("fill", "#333");
            textElement.setAttribute("paint-order", "stroke");
            textElement.setAttribute("stroke", "white");
            textElement.setAttribute("stroke-width", "4px");
            textElement.setAttribute("stroke-linecap", "round");
            textElement.setAttribute("stroke-linejoin", "round");

            const labelPositionX = edgeSVGGroup.dataset.labelX;
            const labelPositionY = edgeSVGGroup.dataset.labelY;

            const labelLines = edge.label.split('\n');
            labelLines.forEach((lineText, index) => {
                const textSpan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
                textSpan.setAttribute("x", labelPositionX);
                textSpan.setAttribute("y", labelPositionY);
                if (labelLines.length > 1) {
                    textSpan.setAttribute("dy", `${(index - (labelLines.length - 1) / 2) * 1.2}em`);
                }

                textSpan.innerHTML = convertLatexToSvgText(lineText);
                textElement.appendChild(textSpan);
            });
            edgeSVGGroup.appendChild(textElement);
        }
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
    if (!sourceString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        sourceString = sourceString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    sourceString = '<?xml version="1.0" standalone="no"?>\r\n' + sourceString;
    downloadFile(sourceString, 'automaton.svg', 'image/svg+xml;charset=utf-8');
}

/**
 * Builds and downloads a LaTeX document using the TikZ library for the automaton.
 */
function exportTikZ() {
    let latexSource = `\\documentclass{standalone}\n\\usepackage{tikz}\n\\usetikzlibrary{automata, positioning, arrows}\n\\begin{document}\n\\begin{tikzpicture}[>=stealth, shorten >=1pt, auto, node distance=2cm, initial text=]\n\n`;

    nodes.forEach(node => {
        let options = ['state'];
        if (node.isStart) options.push('initial', 'initial by arrow');
        if (node.isAccept) options.push('accepting');
        let mappedX = (node.positionX / 50).toFixed(2);
        let mappedY = (-node.positionY / 50).toFixed(2);
        latexSource += `  \\node[${options.join(', ')}] (${node.id}) at (${mappedX}, ${mappedY}) {$${node.name}$};\n`;
    });

    latexSource += `\n  \\path[->]\n`;

    edges.forEach((edge) => {
        let sourceNode = getNodeById(edge.sourceId);
        let targetNode = getNodeById(edge.targetId);
        let formattedLabel = edge.label.split('\n').map(lineText => `$${lineText}$`).join(' \\\\ ');
        let edgeOptions = ['align=center'];

        if (sourceNode.id === targetNode.id) {
            edgeOptions.push('loop');
            let degrees = (edge.loopAngle * 180 / Math.PI + 360) % 360;
            if (degrees > 315 || degrees <= 45) edgeOptions.push('loop right');
            else if (degrees > 45 && degrees <= 135) edgeOptions.push('loop below');
            else if (degrees > 135 && degrees <= 225) edgeOptions.push('loop left');
            else edgeOptions.push('loop above');
        } else {
            if (edge.curveOffset && Math.abs(edge.curveOffset) > 1) {
                let bendDirection = edge.curveOffset > 0 ? 'bend right' : 'bend left';
                edgeOptions.push(`${bendDirection}=${Math.min(90, Math.abs(edge.curveOffset))}`);
            }
        }
        latexSource += `    (${sourceNode.id}) edge [${edgeOptions.join(', ')}] node {${formattedLabel}} (${targetNode.id})\n`;
    });

    latexSource += `  ;\n\\end{tikzpicture}\n\\end{document}`;
    downloadFile(latexSource, 'automaton.tex', 'text/plain');
}
