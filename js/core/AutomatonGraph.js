import { AutomatonNode } from './AutomatonNode.js';
import { AutomatonEdge } from './AutomatonEdge.js';

/**
 * The complete state of a finite automaton diagram: its nodes, its edges, and
 * the id counters used to generate new ones.
 */
export class AutomatonGraph {
    constructor() {
        /** @type {AutomatonNode[]} */
        this.nodes = [];
        /** @type {AutomatonEdge[]} */
        this.edges = [];
        this.nextNodeIndex = 0;
        this.nextEdgeIndex = 0;
    }

    /**
     * @returns {string} The next sequential node name not already in use (q_{0}, q_{1}, ...).
     */
    nextNodeName() {
        let index = 0;
        while (this.nodes.some(node => node.name === `q_{${index}}`)) index++;
        return `q_{${index}}`;
    }

    /**
     * Creates and adds a new node at the given position.
     * @param {number} positionX
     * @param {number} positionY
     * @returns {AutomatonNode}
     */
    addNode(positionX, positionY) {
        const node = new AutomatonNode(`node-${this.nextNodeIndex++}`, positionX, positionY, this.nextNodeName());
        this.nodes.push(node);
        return node;
    }

    /**
     * Creates and adds a transition edge between two nodes, automatically fanning it
     * out (curving it, or rotating a self-loop) so it does not overlap an existing edge.
     * @param {string} sourceId
     * @param {string} targetId
     * @param {string} [label]
     * @returns {AutomatonEdge}
     */
    addEdge(sourceId, targetId, label = '\\epsilon') {
        const edge = new AutomatonEdge(`edge-${this.nextEdgeIndex++}`, sourceId, targetId, label);

        if (edge.isSelfLoop) {
            const existingLoops = this.edges.filter(candidate => candidate.sourceId === sourceId && candidate.isSelfLoop);
            edge.loopAngle = AutomatonEdge.DEFAULT_LOOP_ANGLE + existingLoops.length * (Math.PI / 4);
        } else {
            const forward = this.edges.filter(candidate => candidate.sourceId === sourceId && candidate.targetId === targetId);
            const reverse = this.edges.filter(candidate => candidate.sourceId === targetId && candidate.targetId === sourceId);
            if (forward.length > 0 || reverse.length > 0) {
                const direction = forward.length % 2 === 0 ? 1 : -1;
                edge.curveOffset = direction * 40 * Math.ceil((forward.length + reverse.length) / 2);
            }
        }

        this.edges.push(edge);
        return edge;
    }

    /**
     * Removes a node and any edges attached to it.
     * @param {string} nodeId
     */
    deleteNode(nodeId) {
        this.nodes = this.nodes.filter(node => node.id !== nodeId);
        this.edges = this.edges.filter(edge => edge.sourceId !== nodeId && edge.targetId !== nodeId);
    }

    /**
     * Removes a single edge.
     * @param {string} edgeId
     */
    deleteEdge(edgeId) {
        this.edges = this.edges.filter(edge => edge.id !== edgeId);
    }

    /**
     * Replaces this graph's contents in place with another graph's contents, so
     * existing references to this instance (held by the renderer and controllers)
     * remain valid after loading a project file.
     * @param {AutomatonGraph} otherGraph
     */
    replaceWith(otherGraph) {
        this.nodes = otherGraph.nodes;
        this.edges = otherGraph.edges;
        this.nextNodeIndex = otherGraph.nextNodeIndex;
        this.nextEdgeIndex = otherGraph.nextEdgeIndex;
    }

    /**
     * @param {string} id
     * @returns {AutomatonNode|undefined}
     */
    getNodeById(id) {
        return this.nodes.find(node => node.id === id);
    }

    /**
     * @param {string} id
     * @returns {AutomatonEdge|undefined}
     */
    getEdgeById(id) {
        return this.edges.find(edge => edge.id === id);
    }

    /**
     * @returns {Array<AutomatonNode|AutomatonEdge>} Every node followed by every edge, in
     * creation order - the sequence keyboard selection cycles through.
     */
    get selectableElements() {
        return [...this.nodes, ...this.edges];
    }

    /**
     * @param {{panPositionX: number, panPositionY: number, zoom: number}} camera
     * @returns {Object} A plain, JSON-serializable snapshot of this graph and the given camera state.
     */
    toJSON(camera) {
        return {
            nodes: this.nodes.map(node => node.toJSON()),
            edges: this.edges.map(edge => edge.toJSON()),
            nodeIdCounter: this.nextNodeIndex,
            edgeIdCounter: this.nextEdgeIndex,
            panPositionX: camera.panPositionX,
            panPositionY: camera.panPositionY,
            currentZoom: camera.zoom
        };
    }

    /**
     * @returns {string} A compact JSON snapshot of the diagram itself (no camera state),
     *   used for undo/redo history and change detection. Equal diagrams give equal strings.
     */
    toSnapshot() {
        return JSON.stringify({
            nodes: this.nodes.map(node => node.toJSON()),
            edges: this.edges.map(edge => edge.toJSON()),
            nodeIdCounter: this.nextNodeIndex,
            edgeIdCounter: this.nextEdgeIndex
        });
    }

    /**
     * @param {string} snapshot - A string produced by toSnapshot().
     * @returns {AutomatonGraph} A new graph rebuilt from the snapshot.
     */
    static fromSnapshot(snapshot) {
        const result = AutomatonGraph.fromRaw(JSON.parse(snapshot));
        return result ? result.graph : new AutomatonGraph();
    }

    /**
     * Validates and normalizes an untrusted, parsed project file into a new graph.
     * @param {*} parsedData - The result of JSON.parse() on an untrusted file.
     * @returns {{graph: AutomatonGraph, panPositionX: number, panPositionY: number, zoom: number, droppedCount: number}|null}
     *   The reconstructed state, or null if the file's top-level structure is unusable.
     */
    static fromRaw(parsedData) {
        if (!parsedData || typeof parsedData !== 'object') return null;
        if (!Array.isArray(parsedData.nodes) || !Array.isArray(parsedData.edges)) return null;

        const graph = new AutomatonGraph();
        const usedNodeIds = new Set();
        parsedData.nodes.forEach((raw, index) => {
            const node = AutomatonNode.fromRaw(raw, index);
            if (!node) return;
            while (usedNodeIds.has(node.id)) node.id = `${node.id}-${index}`;
            usedNodeIds.add(node.id);
            graph.nodes.push(node);
        });

        const usedEdgeIds = new Set();
        parsedData.edges.forEach((raw, index) => {
            const edge = AutomatonEdge.fromRaw(raw, index, usedNodeIds);
            if (!edge) return;
            while (usedEdgeIds.has(edge.id)) edge.id = `${edge.id}-${index}`;
            usedEdgeIds.add(edge.id);
            graph.edges.push(edge);
        });

        const droppedCount = (parsedData.nodes.length - graph.nodes.length) + (parsedData.edges.length - graph.edges.length);
        graph.nextNodeIndex = Number.isFinite(parsedData.nodeIdCounter) ? parsedData.nodeIdCounter : graph.nodes.length;
        graph.nextEdgeIndex = Number.isFinite(parsedData.edgeIdCounter) ? parsedData.edgeIdCounter : graph.edges.length;

        return {
            graph,
            panPositionX: Number.isFinite(parsedData.panPositionX) ? parsedData.panPositionX : 0,
            panPositionY: Number.isFinite(parsedData.panPositionY) ? parsedData.panPositionY : 0,
            zoom: Number.isFinite(parsedData.currentZoom) ? parsedData.currentZoom : 1.0,
            droppedCount
        };
    }
}
