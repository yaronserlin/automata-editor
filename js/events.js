/**
 * Canvas event listeners and interactive logic.
 */

svgCanvas.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        changeZoom(event.deltaY > 0 ? -0.1 : 0.1);
    }
}, { passive: false });

svgCanvas.addEventListener('mousedown', (event) => {
    // Camera pan action - middle mouse button or Alt+Click
    if (event.button === 1 || (event.button === 0 && event.altKey)) {
        event.preventDefault();
        isPanning = true;
        panStart = {
            positionX: event.clientX,
            positionY: event.clientY,
            initialPanX: panPositionX,
            initialPanY: panPositionY
        };
        svgCanvas.style.cursor = 'grabbing';
        return;
    }

    if (event.target.tagName === 'svg') {
        event.preventDefault();
        selectElement(null);
        if (!event.shiftKey) {
            selectedNodes.clear();
        }

        // Start Multi-select box
        isBoxSelecting = true;
        selectionBoxStart = getMousePosition(event);
        preBoxSelectedNodes = new Set(selectedNodes);

        selectionBox.setAttribute('x', selectionBoxStart.positionX);
        selectionBox.setAttribute('y', selectionBoxStart.positionY);
        selectionBox.setAttribute('width', 0);
        selectionBox.setAttribute('height', 0);
        selectionBox.classList.remove('hidden');

        renderAll();
    }
});

svgCanvas.addEventListener('dblclick', (event) => {
    if (event.target.tagName === 'svg') {
        const position = getMousePosition(event);
        const newNode = addNode(position.positionX, position.positionY);
        selectedNodes.clear();
        selectedNodes.add(newNode.id);
        selectElement({ type: 'node', id: newNode.id });
        renderAll();
    }
});

svgCanvas.addEventListener('mousemove', (event) => {
    // Panning the camera in the infinite space
    if (isPanning) {
        // Convert screen pixels to internal canvas coordinates for smooth panning at any zoom level
        const deltaX = (event.clientX - panStart.positionX) / currentZoom;
        const deltaY = (event.clientY - panStart.positionY) / currentZoom;

        panPositionX = panStart.initialPanX + deltaX;
        panPositionY = panStart.initialPanY + deltaY;

        updateViewBox();
        return;
    }

    const mousePosition = getMousePosition(event);

    // 0. Box Selecting
    if (isBoxSelecting) {
        const startX = Math.min(selectionBoxStart.positionX, mousePosition.positionX);
        const startY = Math.min(selectionBoxStart.positionY, mousePosition.positionY);
        const boxWidth = Math.abs(mousePosition.positionX - selectionBoxStart.positionX);
        const boxHeight = Math.abs(mousePosition.positionY - selectionBoxStart.positionY);

        selectionBox.setAttribute('x', startX);
        selectionBox.setAttribute('y', startY);
        selectionBox.setAttribute('width', boxWidth);
        selectionBox.setAttribute('height', boxHeight);

        selectedNodes = new Set(preBoxSelectedNodes);
        nodes.forEach(node => {
            if (node.positionX >= startX && node.positionX <= startX + boxWidth &&
                node.positionY >= startY && node.positionY <= startY + boxHeight) {
                selectedNodes.add(node.id);
            }
        });
        renderAll();
    }

    // 1. Dragging Node(s) (With Snapping for primary node)
    if (isDraggingNode && draggedNodeId) {
        let deltaX = mousePosition.positionX - dragStartPosition.positionX;
        let deltaY = mousePosition.positionY - dragStartPosition.positionY;

        const initialPosition = initialNodePositions.get(draggedNodeId);
        let proposedX = initialPosition.positionX + deltaX;
        let proposedY = initialPosition.positionY + deltaY;

        const SNAP_DISTANCE = 12;
        activeGuides = [];
        let snappedX = false;
        let snappedY = false;

        // Snapping logic - compare ONLY to unselected nodes
        nodes.forEach(otherNode => {
            if (selectedNodes.has(otherNode.id)) return;

            if (!snappedX && Math.abs(proposedX - otherNode.positionX) < SNAP_DISTANCE) {
                proposedX = otherNode.positionX; snappedX = true;
                activeGuides.push({ type: 'v', x: proposedX });
            }
            if (!snappedY && Math.abs(proposedY - otherNode.positionY) < SNAP_DISTANCE) {
                proposedY = otherNode.positionY; snappedY = true;
                activeGuides.push({ type: 'h', y: proposedY });
            }
        });

        if (!snappedX) {
            for (let index1 = 0; index1 < nodes.length; index1++) {
                if (selectedNodes.has(nodes[index1].id)) continue;
                for (let index2 = index1 + 1; index2 < nodes.length; index2++) {
                    if (selectedNodes.has(nodes[index2].id)) continue;
                    let distance = Math.abs(nodes[index1].positionX - nodes[index2].positionX);
                    if (distance < 20) continue;
                    const targets = [nodes[index1].positionX - distance, nodes[index1].positionX + distance, nodes[index2].positionX - distance, nodes[index2].positionX + distance];
                    for (let targetPositionX of targets) {
                        if (Math.abs(proposedX - targetPositionX) < SNAP_DISTANCE) {
                            proposedX = targetPositionX; snappedX = true;
                            activeGuides.push({ type: 'v', x: proposedX });
                            break;
                        }
                    }
                    if (snappedX) break;
                }
                if (snappedX) break;
            }
        }
        if (!snappedY) {
            for (let index1 = 0; index1 < nodes.length; index1++) {
                if (selectedNodes.has(nodes[index1].id)) continue;
                for (let index2 = index1 + 1; index2 < nodes.length; index2++) {
                    if (selectedNodes.has(nodes[index2].id)) continue;
                    let distance = Math.abs(nodes[index1].positionY - nodes[index2].positionY);
                    if (distance < 20) continue;
                    const targets = [nodes[index1].positionY - distance, nodes[index1].positionY + distance, nodes[index2].positionY - distance, nodes[index2].positionY + distance];
                    for (let targetPositionY of targets) {
                        if (Math.abs(proposedY - targetPositionY) < SNAP_DISTANCE) {
                            proposedY = targetPositionY; snappedY = true;
                            activeGuides.push({ type: 'h', y: proposedY });
                            break;
                        }
                    }
                    if (snappedY) break;
                }
                if (snappedY) break;
            }
        }

        // Calculate the final actual shift delta
        let snappedDeltaX = proposedX - initialPosition.positionX;
        let snappedDeltaY = proposedY - initialPosition.positionY;

        // Move all selected nodes by the same delta
        selectedNodes.forEach(id => {
            const node = getNodeById(id);
            const initial = initialNodePositions.get(id);
            if (node && initial) {
                node.positionX = initial.positionX + snappedDeltaX;
                node.positionY = initial.positionY + snappedDeltaY;
            }
        });
        renderAll();
    }

    // 2. Dragging Edge
    if (isDraggingEdge && draggedEdgeId) {
        const edge = getEdgeById(draggedEdgeId);
        const sourceNode = getNodeById(edge.sourceId);
        const targetNode = getNodeById(edge.targetId);

        if (sourceNode && targetNode) {
            if (sourceNode.id === targetNode.id) {
                edge.loopAngle = Math.atan2(mousePosition.positionY - sourceNode.positionY, mousePosition.positionX - sourceNode.positionX);
            } else {
                const diffX = targetNode.positionX - sourceNode.positionX;
                const diffY = targetNode.positionY - sourceNode.positionY;
                const distance = Math.sqrt(diffX * diffX + diffY * diffY);
                if (distance > 0) {
                    const dotProduct = (-diffY / distance) * (mousePosition.positionX - sourceNode.positionX) + (diffX / distance) * (mousePosition.positionY - sourceNode.positionY);
                    let newCurveOffset = 2 * dotProduct;

                    // Auto-snap to a straight line when the user is close to the middle
                    if (Math.abs(newCurveOffset) < 20) {
                        newCurveOffset = 0;
                    }

                    edge.curveOffset = newCurveOffset;
                }
            }
            renderAll();
        }
    }

    // 3. Drawing Edge
    if (isDrawingEdge && sourceNodeForEdge) {
        const sourceNode = getNodeById(sourceNodeForEdge);
        tempEdgePath.style.display = 'block';
        const diffX = mousePosition.positionX - sourceNode.positionX;
        const diffY = mousePosition.positionY - sourceNode.positionY;
        const angle = Math.atan2(diffY, diffX);
        const startX = sourceNode.positionX + NODE_RADIUS * Math.cos(angle);
        const startY = sourceNode.positionY + NODE_RADIUS * Math.sin(angle);
        tempEdgePath.setAttribute("d", `M ${startX},${startY} L ${mousePosition.positionX},${mousePosition.positionY}`);
    }

    // 4. Dragging Start Arrow
    if (isDraggingStartArrow && draggedStartArrowNodeId) {
        const node = getNodeById(draggedStartArrowNodeId);
        if (node) {
            node.startAngle = Math.atan2(mousePosition.positionY - node.positionY, mousePosition.positionX - node.positionX);
            renderAll();
        }
    }
});

svgCanvas.addEventListener('mouseup', (event) => {
    if (isPanning) {
        isPanning = false;
        svgCanvas.style.cursor = 'crosshair';
        return;
    }

    isDraggingNode = false;
    draggedNodeId = null;
    isDraggingEdge = false;
    draggedEdgeId = null;
    isDraggingStartArrow = false;
    draggedStartArrowNodeId = null;

    if (isDrawingEdge) {
        isDrawingEdge = false;
        tempEdgePath.style.display = 'none';
        sourceNodeForEdge = null;
    }

    if (isBoxSelecting) {
        isBoxSelecting = false;
        selectionBox.classList.add('hidden');

        // If selection contains 1 node, open properties. Otherwise clear properties.
        if (selectedNodes.size === 1) {
            const id = Array.from(selectedNodes)[0];
            selectElement({ type: 'node', id: id });
        } else {
            selectElement(null);
        }
    }

    activeGuides = [];
    renderGuides();
});

/**
 * Handles the mouse down event for a specified node. Selects the node and initiates dragging.
 * @param {MouseEvent} event - The mouse event.
 * @param {string} nodeId - The ID of the node clicked.
 */
function handleNodeMouseDown(event, nodeId) {
    event.stopPropagation();
    event.preventDefault();

    if (event.shiftKey) {
        // Draw edge
        isDrawingEdge = true;
        sourceNodeForEdge = nodeId;
    } else {
        // If we clicked a node that isn't selected, select ONLY it
        if (!selectedNodes.has(nodeId)) {
            selectedNodes.clear();
            selectedNodes.add(nodeId);
        }

        selectElement({ type: 'node', id: nodeId });

        // Prepare for dragging all selected nodes
        isDraggingNode = true;
        draggedNodeId = nodeId;
        dragStartPosition = getMousePosition(event);
        initialNodePositions.clear();
        selectedNodes.forEach(id => {
            const node = getNodeById(id);
            if (node) initialNodePositions.set(id, { positionX: node.positionX, positionY: node.positionY });
        });
    }
    renderAll();
}

/**
 * Handles the mouse up event for a target node, finishing the edge drawing process if active.
 * @param {MouseEvent} event - The mouse event.
 * @param {string} targetNodeId - The ID of the node released on.
 */
function handleNodeMouseUp(event, targetNodeId) {
    if (isDrawingEdge && sourceNodeForEdge) {
        event.stopPropagation();
        const newEdge = addEdge(sourceNodeForEdge, targetNodeId);
        selectedNodes.clear();
        selectElement({ type: 'edge', id: newEdge.id });

        isDrawingEdge = false;
        tempEdgePath.style.display = 'none';
        sourceNodeForEdge = null;
        renderAll();
    }
}

/**
 * Handles the mouse down event for an edge object.
 * @param {MouseEvent} event - The mouse event.
 * @param {string} edgeId - The ID of the edge interacted with.
 */
function handleEdgeMouseDown(event, edgeId) {
    event.stopPropagation();
    event.preventDefault();
    selectedNodes.clear();
    selectElement({ type: 'edge', id: edgeId });
    isDraggingEdge = true;
    draggedEdgeId = edgeId;
    renderAll();
}

window.addEventListener('keydown', (event) => {
    if ((event.key === 'Delete' || event.key === 'Backspace')) {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

        if (selectedNodes.size > 0) {
            selectedNodes.forEach(id => deleteNode(id, false));
            selectedNodes.clear();
            renderAll();
        } else if (selectedElement && selectedElement.type === 'edge') {
            deleteEdge(selectedElement.id);
        }
    }
});

nodeNameInput.addEventListener('input', (event) => {
    if (selectedElement && selectedElement.type === 'node') {
        const node = getNodeById(selectedElement.id);
        if (node) { node.name = event.target.value; renderAll(); }
    }
});

nodeIsStartCheckbox.addEventListener('change', (event) => {
    if (selectedElement && selectedElement.type === 'node') {
        const node = getNodeById(selectedElement.id);
        if (node) { node.isStart = event.target.checked; renderAll(); }
    }
});

nodeIsAcceptCheckbox.addEventListener('change', (event) => {
    if (selectedElement && selectedElement.type === 'node') {
        const node = getNodeById(selectedElement.id);
        if (node) { node.isAccept = event.target.checked; renderAll(); }
    }
});

edgeLabelInput.addEventListener('input', (event) => {
    if (selectedElement && selectedElement.type === 'edge') {
        const edge = getEdgeById(selectedElement.id);
        if (edge) { edge.label = event.target.value; renderAll(); }
    }
});
