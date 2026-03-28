/**
 * Selects an element and triggers a re-render to highlight the selection.
 * @param {Object|null} selection - The element to select.
 */
function selectElement(selection) {
    selectedElement = selection;
    renderAll();
}

/**
 * Updates the SVG viewBox to center the camera according to pan coordinates and zoom level.
 */
function updateViewBox() {
    const canvasWidth = svgCanvas.clientWidth || 1000;
    const canvasHeight = svgCanvas.clientHeight || 600;

    if (canvasWidth === 0 || canvasHeight === 0) return;

    // Dimensions displayed within the screen considering current zoom
    const viewWidth = canvasWidth / currentZoom;
    const viewHeight = canvasHeight / currentZoom;

    // Fixed center of the canvas minus current pan offset
    const centerX = 500 - panPositionX;
    const centerY = 300 - panPositionY;

    // Calculate upper-left corner of the camera viewport
    const viewX = centerX - (viewWidth / 2);
    const viewY = centerY - (viewHeight / 2);

    svgCanvas.setAttribute('viewBox', `${viewX} ${viewY} ${viewWidth} ${viewHeight}`);
}

/**
 * Changes the current zoom level and updates the UI display.
 * @param {number} delta - The zoom increment/decrement.
 */
function changeZoom(delta) {
    currentZoom += delta;
    if (currentZoom < 0.3) currentZoom = 0.3;
    if (currentZoom > 3.0) currentZoom = 3.0;
    zoomDisplay.textContent = Math.round(currentZoom * 100) + '%';
    updateViewBox();
}

/**
 * Updates the properties panel to show the selected node/edge's properties if it's currently visible.
 */
function updatePropertiesPanel() {
    if (!selectedElement || (selectedNodes.size > 1)) {
        propertiesPanel.style.display = 'none';
        return;
    }
    
    // Only update values if it's already block, or if called from openPropertiesPanel
    if (propertiesPanel.style.display !== 'block') return;

    if (selectedElement.type === 'node') {
        const node = getNodeById(selectedElement.id);
        if (!node) return;
        panelTitle.textContent = "Node Properties";
        nodePropsDiv.style.display = 'block'; edgePropsDiv.style.display = 'none';
        nodeNameInput.value = node.name;
        nodeIsStartCheckbox.checked = node.isStart;
        nodeIsAcceptCheckbox.checked = node.isAccept;
    }
    else if (selectedElement.type === 'edge') {
        const edge = getEdgeById(selectedElement.id);
        if (!edge) return;
        panelTitle.textContent = "Edge Properties";
        nodePropsDiv.style.display = 'none'; edgePropsDiv.style.display = 'block';
        edgeLabelInput.value = edge.label;
    }
}

/**
 * Explicitly opens the properties panel for the currently selected element.
 */
function openPropertiesPanel() {
    if (!selectedElement || (selectedNodes.size > 1)) return;
    propertiesPanel.style.display = 'block';
    updatePropertiesPanel();
}
