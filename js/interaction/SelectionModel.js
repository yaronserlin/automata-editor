import { AutomatonNode } from '../core/AutomatonNode.js';
/** @typedef {import('../core/AutomatonEdge.js').AutomatonEdge} AutomatonEdge */

/**
 * Tracks which node(s) or edge is currently selected in the editor.
 */
export class SelectionModel {
    constructor() {
        /** @type {{type: 'node'|'edge', id: string}|null} */
        this.selectedElement = null;
        /** @type {Set<string>} */
        this.selectedNodeIds = new Set();
    }

    /**
     * @param {string} nodeId
     */
    selectSingleNode(nodeId) {
        this.selectedNodeIds.clear();
        this.selectedNodeIds.add(nodeId);
        this.selectedElement = { type: 'node', id: nodeId };
    }

    /**
     * @param {Iterable<string>} nodeIds
     */
    selectNodes(nodeIds) {
        this.selectedNodeIds = new Set(nodeIds);
        this.selectedElement = this.selectedNodeIds.size === 1
            ? { type: 'node', id: [...this.selectedNodeIds][0] }
            : null;
    }

    /**
     * @param {string} edgeId
     */
    selectEdge(edgeId) {
        this.selectedNodeIds.clear();
        this.selectedElement = { type: 'edge', id: edgeId };
    }

    clear() {
        this.selectedNodeIds.clear();
        this.selectedElement = null;
    }

    /**
     * @param {string} nodeId
     * @returns {boolean}
     */
    hasNode(nodeId) {
        return this.selectedNodeIds.has(nodeId);
    }

    /**
     * @returns {boolean} Whether more than one node is currently selected.
     */
    get isMultiNodeSelection() {
        return this.selectedNodeIds.size > 1;
    }

    /**
     * @param {import('../core/AutomatonGraph.js').AutomatonGraph} graph
     * @returns {AutomatonNode|AutomatonEdge|null} The single selected model instance.
     */
    resolve(graph) {
        if (!this.selectedElement) return null;
        return this.selectedElement.type === 'node'
            ? graph.getNodeById(this.selectedElement.id)
            : graph.getEdgeById(this.selectedElement.id);
    }

    /**
     * Selects the next or previous element in a combined nodes+edges list, wrapping around.
     * @param {Array<AutomatonNode|AutomatonEdge>} elements - The ordered list to cycle through.
     * @param {1|-1} direction
     */
    cycle(elements, direction) {
        if (elements.length === 0) return;
        const currentIndex = elements.findIndex(element => this.selectedElement && element.id === this.selectedElement.id);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + direction + elements.length) % elements.length;
        const next = elements[nextIndex];

        if (next instanceof AutomatonNode) {
            this.selectSingleNode(next.id);
        } else {
            this.selectEdge(next.id);
        }
    }
}

/**
 * Tracks an in-progress "draw an edge from this node" gesture, shared between
 * pointer and keyboard interaction so either can start or finish it.
 */
export class EdgeDraftState {
    constructor() {
        this.active = false;
        /** @type {string|null} */
        this.sourceNodeId = null;
        /** @type {'pointer'|'keyboard'} How the draft was started, so on-screen help can match it. */
        this.mode = 'pointer';
    }

    /**
     * @param {string} nodeId
     * @param {'pointer'|'keyboard'} [mode]
     */
    start(nodeId, mode = 'pointer') {
        this.active = true;
        this.sourceNodeId = nodeId;
        this.mode = mode;
    }

    cancel() {
        this.active = false;
        this.sourceNodeId = null;
        this.mode = 'pointer';
    }
}
