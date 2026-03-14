/**
 * Generates the next available node name sequentially (e.g. q_{0}, q_{1}).
 * @returns {string} The generated node name.
 */
function getNextNodeName() {
    let index = 0;
    while (nodes.some(node => node.name === `q_{${index}}`)) index++;
    return `q_{${index}}`;
}

/**
 * Creates and adds a new node to the graph layout.
 * @param {number} positionX - The X coordinate.
 * @param {number} positionY - The Y coordinate.
 * @returns {Object} The created node object.
 */
function addNode(positionX, positionY) {
    const node = {
        id: `node-${nodeIdCounter++}`,
        positionX: positionX,
        positionY: positionY,
        name: getNextNodeName(),
        isStart: false,
        isAccept: false,
        startAngle: Math.PI
    };
    nodes.push(node);
    return node;
}

/**
 * Creates and adds a transition edge between source and target nodes.
 * @param {string} sourceId - The ID of the source node.
 * @param {string} targetId - The ID of the target node.
 * @param {string} label - The mathematical transition letter.
 * @returns {Object} The created edge object.
 */
function addEdge(sourceId, targetId, label = "\\epsilon") {
    const existingForwardEdges = edges.filter(edge => edge.sourceId === sourceId && edge.targetId === targetId);
    const existingReverseEdges = edges.filter(edge => edge.sourceId === targetId && edge.targetId === sourceId);

    const edge = {
        id: `edge-${edgeIdCounter++}`,
        sourceId: sourceId,
        targetId: targetId,
        label: label,
        loopAngle: -Math.PI / 2
    };

    if (sourceId === targetId) {
        edge.loopAngle = -Math.PI / 2 + (existingForwardEdges.length * Math.PI / 4);
    } else {
        if (existingForwardEdges.length === 0 && existingReverseEdges.length === 0) {
            edge.curveOffset = 0;
        } else {
            let totalEdgesCount = existingForwardEdges.length + existingReverseEdges.length;
            let curveDirection = (existingForwardEdges.length % 2 === 0) ? 1 : -1;
            edge.curveOffset = curveDirection * 40 * Math.ceil(totalEdgesCount / 2);
        }
    }

    edges.push(edge);
    return edge;
}

/**
 * Deletes a given node by ID, cleaning up any edges associated with it.
 * @param {string} nodeId - The ID of the node to delete.
 * @param {boolean} triggerRender - Whether to re-render the view right after deletion.
 */
function deleteNode(nodeId, triggerRender = true) {
    nodes = nodes.filter(node => node.id !== nodeId);
    edges = edges.filter(edge => edge.sourceId !== nodeId && edge.targetId !== nodeId);
    selectedNodes.delete(nodeId);
    if (selectedElement && selectedElement.id === nodeId) selectElement(null);
    if (triggerRender) renderAll();
}

/**
 * Deletes a specific edge by ID.
 * @param {string} edgeId - The ID of the edge to delete.
 * @param {boolean} triggerRender - Whether to re-render the view right after deletion.
 */
function deleteEdge(edgeId, triggerRender = true) {
    edges = edges.filter(edge => edge.id !== edgeId);
    if (selectedElement && selectedElement.id === edgeId) selectElement(null);
    if (triggerRender) renderAll();
}

/**
 * Gets a node based on its unique ID.
 * @param {string} id - The lookup ID.
 * @returns {Object|undefined} The node object if found.
 */
function getNodeById(id) {
    return nodes.find(node => node.id === id);
}

/**
 * Gets an edge based on its unique ID.
 * @param {string} id - The lookup ID.
 * @returns {Object|undefined} The edge object if found.
 */
function getEdgeById(id) {
    return edges.find(edge => edge.id === id);
}
