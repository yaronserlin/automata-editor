/**
 * Re-renders all layers and modules on the canvas (nodes, edges, guides, properties).
 */
function renderAll() {
    renderNodes();
    renderEdges();
    renderGuides();
    updatePropertiesPanel();
}

/**
 * Renders the alignment guides onto the guides SVG layer.
 */
function renderGuides() {
    guidesLayer.innerHTML = '';
    activeGuides.forEach(guide => {
        const guideLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        guideLine.setAttribute("stroke", "#f59e0b"); // Amber-500
        guideLine.setAttribute("stroke-width", "1");
        guideLine.setAttribute("stroke-dasharray", "5,5");

        // The guides must span large distances across the infinite canvas
        if (guide.type === 'v') {
            guideLine.setAttribute("x1", guide.x); guideLine.setAttribute("x2", guide.x);
            guideLine.setAttribute("y1", -10000); guideLine.setAttribute("y2", 10000);
        } else if (guide.type === 'h') {
            guideLine.setAttribute("y1", guide.y); guideLine.setAttribute("y2", guide.y);
            guideLine.setAttribute("x1", -10000); guideLine.setAttribute("x2", 10000);
        }
        guidesLayer.appendChild(guideLine);
    });
}

/**
 * Renders all nodes onto the nodes SVG layer.
 */
function renderNodes() {
    nodesLayer.innerHTML = '';
    nodes.forEach(node => {
        const isSelected = selectedNodes.has(node.id);

        const svgGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        svgGroup.setAttribute("class", `node ${isSelected ? 'selected' : ''}`);
        svgGroup.setAttribute("transform", `translate(${node.positionX}, ${node.positionY})`);
        svgGroup.dataset.id = node.id;

        if (node.isStart) {
            const angle = node.startAngle !== undefined ? node.startAngle : Math.PI;
            const tipX = NODE_RADIUS * Math.cos(angle);
            const tipY = NODE_RADIUS * Math.sin(angle);
            const tailX = (NODE_RADIUS + 40) * Math.cos(angle);
            const tailY = (NODE_RADIUS + 40) * Math.sin(angle);

            const startArrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
            startArrow.setAttribute("class", "start-arrow");
            startArrow.setAttribute("d", `M ${tailX},${tailY} L ${tipX},${tipY}`);
            svgGroup.appendChild(startArrow);

            const arrowHitbox = document.createElementNS("http://www.w3.org/2000/svg", "path");
            arrowHitbox.setAttribute("d", `M ${tailX},${tailY} L ${tipX},${tipY}`);
            arrowHitbox.setAttribute("stroke", "transparent");
            arrowHitbox.setAttribute("stroke-width", "25");
            arrowHitbox.setAttribute("fill", "none");
            arrowHitbox.style.cursor = "pointer";
            arrowHitbox.addEventListener('mousedown', (event) => {
                event.stopPropagation();
                event.preventDefault();
                isDraggingStartArrow = true;
                draggedStartArrowNodeId = node.id;
                selectedNodes.clear();
                selectedNodes.add(node.id);
                selectElement({ type: 'node', id: node.id });
                renderAll();
            });
            svgGroup.appendChild(arrowHitbox);
        }

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("class", "node-circle");
        circle.setAttribute("r", NODE_RADIUS);
        svgGroup.appendChild(circle);

        if (node.isAccept) {
            const innerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            innerCircle.setAttribute("class", "accept-circle");
            innerCircle.setAttribute("r", NODE_RADIUS - 6);
            svgGroup.appendChild(innerCircle);
        }

        const foreignObjectSize = 100;
        const foreignObjectElement = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObjectElement.setAttribute("x", -foreignObjectSize / 2); foreignObjectElement.setAttribute("y", -foreignObjectSize / 2);
        foreignObjectElement.setAttribute("width", foreignObjectSize); foreignObjectElement.setAttribute("height", foreignObjectSize);
        foreignObjectElement.style.pointerEvents = "none";

        const div = document.createElement("div");
        div.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        div.style.width = "100%"; div.style.height = "100%";
        div.style.display = "flex"; div.style.alignItems = "center"; div.style.justifyContent = "center";
        div.className = "katex-container";

        const textWrapper = document.createElement("div");
        textWrapper.style.display = "inline-block";
        textWrapper.style.whiteSpace = "nowrap";
        textWrapper.style.transformOrigin = "center center";
        textWrapper.innerHTML = renderKatex(node.name);

        div.appendChild(textWrapper);
        foreignObjectElement.appendChild(div);
        svgGroup.appendChild(foreignObjectElement);

        svgGroup.addEventListener('mousedown', (event) => handleNodeMouseDown(event, node.id));
        svgGroup.addEventListener('mouseup', (event) => handleNodeMouseUp(event, node.id));

        nodesLayer.appendChild(svgGroup);

        const innerRadius = node.isAccept ? (NODE_RADIUS - 8) : (NODE_RADIUS - 4);
        const maxFit = innerRadius * 1.5;
        const elementWidth = textWrapper.scrollWidth;
        const elementHeight = textWrapper.scrollHeight;
        if (elementWidth > maxFit || elementHeight > maxFit) {
            const scaleFactor = Math.min(maxFit / elementWidth, maxFit / elementHeight);
            textWrapper.style.transform = `scale(${scaleFactor})`;
        }
    });
}

/**
 * Renders all edges onto the edges SVG layer.
 */
function renderEdges() {
    edgesLayer.innerHTML = '';

    edges.forEach(edge => {
        const sourceNode = getNodeById(edge.sourceId);
        const targetNode = getNodeById(edge.targetId);
        if (!sourceNode || !targetNode) return;

        const isSelected = selectedElement && selectedElement.type === 'edge' && selectedElement.id === edge.id;
        const isSelfLoop = sourceNode.id === targetNode.id;

        const svgGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        svgGroup.setAttribute("class", `edge ${isSelected ? 'selected' : ''}`);
        svgGroup.dataset.id = edge.id;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "edge-path");

        let pathData = "";
        let labelPositionX, labelPositionY;

        const numLines = edge.label.split('\n').length;
        let maxLineLength = 1;
        edge.label.split('\n').forEach(lineText => { if (lineText.length > maxLineLength) maxLineLength = lineText.length; });

        const estimatedWidth = 16 + maxLineLength * 7.5;
        const estimatedHeight = numLines * 22;

        if (isSelfLoop) {
            const radius = NODE_RADIUS;
            const angle = edge.loopAngle !== undefined ? edge.loopAngle : -Math.PI / 2;
            const spread = Math.PI / 6;

            const startAngle = angle - spread;
            const endAngle = angle + spread;

            const startX = sourceNode.positionX + radius * Math.cos(startAngle);
            const startY = sourceNode.positionY + radius * Math.sin(startAngle);
            const endX = sourceNode.positionX + radius * Math.cos(endAngle);
            const endY = sourceNode.positionY + radius * Math.sin(endAngle);

            const loopRadius = radius * 0.85;
            pathData = `M ${startX},${startY} A ${loopRadius} ${loopRadius} 0 1 1 ${endX},${endY}`;

            const labelDistance = radius + (loopRadius * 2) + (numLines * 10);
            labelPositionX = sourceNode.positionX + labelDistance * Math.cos(angle);
            labelPositionY = sourceNode.positionY + labelDistance * Math.sin(angle);

        } else {
            let curveOffset = edge.curveOffset || 0;

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
                const startX = sourceNode.positionX + NODE_RADIUS * Math.cos(angle);
                const startY = sourceNode.positionY + NODE_RADIUS * Math.sin(angle);
                const endX = targetNode.positionX - NODE_RADIUS * Math.cos(angle);
                const endY = targetNode.positionY - NODE_RADIUS * Math.sin(angle);

                pathData = `M ${startX},${startY} L ${endX},${endY}`;

                labelPositionX = midpointX + normalX * dynamicOffset;
                labelPositionY = midpointY + normalY * dynamicOffset;
            } else {
                const controlPointX = midpointX + normalX * curveOffset;
                const controlPointY = midpointY + normalY * curveOffset;

                const startAngle = Math.atan2(controlPointY - sourceNode.positionY, controlPointX - sourceNode.positionX);
                const startX = sourceNode.positionX + NODE_RADIUS * Math.cos(startAngle);
                const startY = sourceNode.positionY + NODE_RADIUS * Math.sin(startAngle);

                const endAngle = Math.atan2(targetNode.positionY - controlPointY, targetNode.positionX - controlPointX);
                const endX = targetNode.positionX - NODE_RADIUS * Math.cos(endAngle);
                const endY = targetNode.positionY - NODE_RADIUS * Math.sin(endAngle);

                pathData = `M ${startX},${startY} Q ${controlPointX},${controlPointY} ${endX},${endY}`;

                const offsetDirection = curveOffset > 0 ? 1 : -1;
                const finalOffset = (Math.abs(curveOffset) * 0.5) + dynamicOffset;

                labelPositionX = midpointX + normalX * offsetDirection * finalOffset;
                labelPositionY = midpointY + normalY * offsetDirection * finalOffset;
            }
        }

        path.setAttribute("d", pathData);
        svgGroup.appendChild(path);

        const hitbox = document.createElementNS("http://www.w3.org/2000/svg", "path");
        hitbox.setAttribute("d", pathData);
        hitbox.setAttribute("stroke", "transparent");
        hitbox.setAttribute("stroke-width", "25");
        hitbox.setAttribute("fill", "none");
        hitbox.style.cursor = "pointer";
        svgGroup.appendChild(hitbox);

        const foreignObjectSizeX = 300;
        const foreignObjectSizeY = 200;
        const foreignObjectElement = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObjectElement.setAttribute("x", labelPositionX - foreignObjectSizeX / 2);
        foreignObjectElement.setAttribute("y", labelPositionY - foreignObjectSizeY / 2);
        foreignObjectElement.setAttribute("width", foreignObjectSizeX);
        foreignObjectElement.setAttribute("height", foreignObjectSizeY);
        foreignObjectElement.style.pointerEvents = "none";

        svgGroup.dataset.labelX = labelPositionX;
        svgGroup.dataset.labelY = labelPositionY;

        const containerDiv = document.createElement("div");
        containerDiv.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        containerDiv.style.width = "100%";
        containerDiv.style.height = "100%";
        containerDiv.style.display = "flex";
        containerDiv.style.alignItems = "center";
        containerDiv.style.justifyContent = "center";

        const bgDiv = document.createElement("div");
        bgDiv.style.padding = "2px 8px";
        bgDiv.style.pointerEvents = "auto";
        bgDiv.style.cursor = "pointer";
        bgDiv.style.textAlign = "center";
        bgDiv.style.background = "transparent";
        bgDiv.style.color = (isSelected) ? "#2563eb" : "#333";
        bgDiv.style.textShadow = "0px 0px 4px rgba(255,255,255,0.9), 0px 0px 4px rgba(255,255,255,0.9)";

        const lines = edge.label.split('\n');
        bgDiv.innerHTML = lines.map(lineText => renderKatex(lineText)).join('<br/>');

        bgDiv.addEventListener('mousedown', (event) => handleEdgeMouseDown(event, edge.id));

        containerDiv.appendChild(bgDiv);
        foreignObjectElement.appendChild(containerDiv);
        svgGroup.appendChild(foreignObjectElement);

        path.addEventListener('mousedown', (event) => handleEdgeMouseDown(event, edge.id));
        hitbox.addEventListener('mousedown', (event) => handleEdgeMouseDown(event, edge.id));

        edgesLayer.appendChild(svgGroup);
    });
}
