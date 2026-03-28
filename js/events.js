/**
 * Canvas event listeners and interactive logic.
 */

svgCanvas.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        changeZoom(event.deltaY > 0 ? -0.1 : 0.1);
    }
}, { passive: false });

let lastTapTime = 0;
let lastNodeTapTime = 0;
let dragStartPosition = null;
const handleCanvasPointerDown = (event) => {
    // Double-tap implementation (max 300ms)
    if (event.type === 'touchstart') {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        if (tapLength < 300 && tapLength > 0) {
            handleDoubleClick(event);
            lastTapTime = 0;
            return;
        }
        lastTapTime = currentTime;
    }

    // Pinch-to-zoom initialization
    if (event.type === 'touchstart' && event.touches && event.touches.length === 2) {
        if (event.cancelable) event.preventDefault();
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        initialPinchDistance = Math.hypot(dx, dy);
        isPinching = true;
        isPanning = false; // Override panning
        return;
    }

    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    // Camera pan action - middle mouse button or Alt+Click or 2-finger touch
    if (event.button === 1 || (event.button === 0 && event.altKey) || (event.type === 'touchstart' && event.touches && event.touches.length === 2)) {
        if (event.cancelable) event.preventDefault();
        isPanning = true;
        isPinching = false;
        
        let panClientX = clientX;
        let panClientY = clientY;
        
        // Use midpoint of two fingers for panning
        if (event.touches && event.touches.length === 2) {
            panClientX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
            panClientY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        }

        panStart = {
            positionX: panClientX,
            positionY: panClientY,
            initialPanX: panPositionX,
            initialPanY: panPositionY
        };
        svgCanvas.style.cursor = 'grabbing';
        return;
    }

    if (event.target.tagName === 'svg') {
        if (event.type !== 'touchstart' || event.cancelable) event.preventDefault();
        
        // Single tapping the bg closes properties and drawing modes
        if (isDrawingEdge) {
            isDrawingEdge = false;
            tempEdgePath.style.display = 'none';
            sourceNodeForEdge = null;
        }
        
        selectElement(null);
        propertiesPanel.style.display = 'none'; // Force hide

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
};

svgCanvas.addEventListener('mousedown', handleCanvasPointerDown);
svgCanvas.addEventListener('touchstart', handleCanvasPointerDown, { passive: false });

const handleDoubleClick = (event) => {
    if (event.cancelable) event.preventDefault();

    let targetElement = event.target;
    // Walk up to see if a node or edge was clicked
    let nodeGroup = targetElement.closest ? targetElement.closest('.node') : null;
    let edgeGroup = targetElement.closest ? targetElement.closest('.edge') : null;

    if (nodeGroup && nodeGroup.dataset && nodeGroup.dataset.id) {
        // Double clicked a Node -> Open Properties AND start drawing edge
        const nodeId = nodeGroup.dataset.id;
        selectedNodes.clear();
        selectedNodes.add(nodeId);
        selectElement({ type: 'node', id: nodeId });
        if (typeof openPropertiesPanel === 'function') openPropertiesPanel();
        
        isDrawingEdge = true;
        sourceNodeForEdge = nodeId;
        isDraggingNode = false;
        draggedNodeId = null;

        const node = getNodeById(nodeId);
        if (node) {
            const initialTouchPos = getMousePosition(event);
            tempEdgePath.style.display = 'block';
            tempEdgePath.setAttribute("d", `M ${node.positionX},${node.positionY} L ${initialTouchPos.positionX},${initialTouchPos.positionY}`);
        }
        renderAll();
    } else if (edgeGroup && edgeGroup.dataset && edgeGroup.dataset.id) {
        // Double clicked an Edge -> Open Properties
        const edgeId = edgeGroup.dataset.id;
        selectedNodes.clear();
        selectElement({ type: 'edge', id: edgeId });
        if (typeof openPropertiesPanel === 'function') openPropertiesPanel();
    } else if (targetElement.tagName === 'svg') {
        // Double clicked the Background -> Create Node
        const position = getMousePosition(event);
        const newNode = addNode(position.positionX, position.positionY);
        selectedNodes.clear();
        selectedNodes.add(newNode.id);
        selectElement({ type: 'node', id: newNode.id });
        renderAll();
    }
};

svgCanvas.addEventListener('dblclick', handleDoubleClick);

let initialPinchDistance = null;
let isPinching = false;
const handleCanvasPointerMove = (event) => {

    // Pinch-to-zoom execution
    if (isPinching && event.touches && event.touches.length === 2) {
        if (event.cancelable) event.preventDefault();
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const currentDistance = Math.hypot(dx, dy);
        
        if (initialPinchDistance > 0) {
            const zoomDelta = (currentDistance - initialPinchDistance) * 0.005; // Adjust sensitivity
            changeZoom(zoomDelta);
        }
        initialPinchDistance = currentDistance;
        return;
    }
    // Panning the camera in the infinite space
    if (isPanning) {
        if (event.cancelable) event.preventDefault();
        let clientX = event.touches ? event.touches[0].clientX : event.clientX;
        let clientY = event.touches ? event.touches[0].clientY : event.clientY;
        
        if (event.touches && event.touches.length === 2) {
            clientX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
            clientY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        }
        
        // Convert screen pixels to internal canvas coordinates for smooth panning at any zoom level
        const deltaX = (clientX - panStart.positionX) / currentZoom;
        const deltaY = (clientY - panStart.positionY) / currentZoom;

        panPositionX = panStart.initialPanX + deltaX;
        panPositionY = panStart.initialPanY + deltaY;

        updateViewBox();
        return;
    }
    
    if (event.type === 'touchmove' && (isDraggingNode || isDraggingEdge || isDrawingEdge || isBoxSelecting || isDraggingStartArrow)) {
        if (event.cancelable) event.preventDefault(); // stop scroll while dragging
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
};

svgCanvas.addEventListener('mousemove', handleCanvasPointerMove);
svgCanvas.addEventListener('touchmove', handleCanvasPointerMove, { passive: false });

const handleCanvasPointerUp = (event) => {
    if (isPinching && (!event.touches || event.touches.length < 2)) {
        isPinching = false;
        initialPinchDistance = null;
        return;
    }

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
};

svgCanvas.addEventListener('mouseup', handleCanvasPointerUp);
svgCanvas.addEventListener('touchend', handleCanvasPointerUp);
svgCanvas.addEventListener('touchcancel', handleCanvasPointerUp);

/**
 * Handles the mouse down event for a specified node. Selects the node and initiates dragging.
 * @param {MouseEvent} event - The mouse event.
 * @param {string} nodeId - The ID of the node clicked.
 */
function handleNodeMouseDown(event, nodeId) {
    event.stopPropagation();
    if (event.type !== 'touchstart' || event.cancelable) event.preventDefault();

    if (event.type === 'touchstart') {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastNodeTapTime;
        if (tapLength < 300 && tapLength > 0) {
            // Emulate double click since stopPropagation blocks canvas from seeing it
            handleDoubleClick(event);
            lastNodeTapTime = 0;
            return; 
        }
        lastNodeTapTime = currentTime;
    }

    // If drawing edge, clicking another node finishes it.
    if (isDrawingEdge && sourceNodeForEdge) {
        handleNodeMouseUp(event, nodeId);
        return; // Don't drag the node we just connected to
    }

    // Single click just selects (doesn't open properties if closed) 
    // and prepares for drag.
    if (!selectedNodes.has(nodeId)) {
        selectedNodes.clear();
        selectedNodes.add(nodeId);
    }

    // Prepare for dragging all selected nodes
    isDraggingNode = true;
    draggedNodeId = nodeId;
    dragStartPosition = getMousePosition(event);
    initialNodePositions.clear();
    selectedNodes.forEach(id => {
        const node = getNodeById(id);
        if (node) initialNodePositions.set(id, { positionX: node.positionX, positionY: node.positionY });
    });

    renderAll();
}

/**
 * Handles the mouse up event for a target node, finishing the edge drawing process if active.
 * @param {MouseEvent|TouchEvent} event - The mouse/touch event.
 * @param {string} targetNodeId - The ID of the node released on.
 */
function handleNodeMouseUp(event, targetNodeId) {
    if (isDrawingEdge && sourceNodeForEdge) {
        event.stopPropagation();
        
        let actualTargetId = targetNodeId;
        if (event.type === 'touchend' || event.type === 'touchcancel') {
            const touch = (event.changedTouches && event.changedTouches.length > 0) ? event.changedTouches[0] : null;
            if (touch) {
                const dropElement = document.elementFromPoint(touch.clientX, touch.clientY);
                const nodeGroup = dropElement ? dropElement.closest('.node') : null;
                if (nodeGroup && nodeGroup.dataset && nodeGroup.dataset.id) {
                    actualTargetId = nodeGroup.dataset.id;
                } else {
                    actualTargetId = null;
                }
            }
        }

        if (actualTargetId) {
            const newEdge = addEdge(sourceNodeForEdge, actualTargetId);
            selectedNodes.clear();
            selectElement({ type: 'edge', id: newEdge.id });
        }

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
    if (event.type !== 'touchstart' || event.cancelable) event.preventDefault();
    selectedNodes.clear();
    // Do not call selectElement to avoid opening properties on 1st click
    // selectElement({ type: 'edge', id: edgeId });
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
