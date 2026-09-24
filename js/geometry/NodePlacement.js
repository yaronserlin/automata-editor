import { AutomatonNode } from '../core/AutomatonNode.js';
import { GeometryUtils } from './GeometryUtils.js';

/**
 * Finds free space for new states, so a state created with the keyboard (N)
 * never lands on top of an existing state, transition, or label.
 *
 * DOM-free, so it can be unit tested in plain Node.
 */
export class NodePlacement {
    /** @type {number} Minimum distance between the centers of two states. */
    static MIN_NODE_DISTANCE = AutomatonNode.RADIUS * 2 + 30;
    /** @type {number} Minimum distance from a new state's center to any transition line. */
    static MIN_EDGE_DISTANCE = AutomatonNode.RADIUS + 14;
    /** @type {number} Minimum distance from a new state's center to a transition label anchor. */
    static MIN_LABEL_DISTANCE = AutomatonNode.RADIUS + 26;
    /** @type {number} Distance between candidate rings when searching outward. */
    static RING_STEP = 70;
    static MAX_RINGS = 10;
    static CURVE_SAMPLES = 24;

    /**
     * @param {import('../core/AutomatonGraph.js').AutomatonGraph} graph
     * @param {{positionX: number, positionY: number}} preferred - Where the state would ideally go.
     * @returns {{positionX: number, positionY: number}} The preferred point if it is free,
     *   otherwise the nearest free point found on rings spiraling out from it.
     */
    static findFreePosition(graph, preferred) {
        const obstacles = NodePlacement.collectObstacles(graph);
        if (NodePlacement.isFree(obstacles, preferred.positionX, preferred.positionY)) return { ...preferred };

        for (let ring = 1; ring <= NodePlacement.MAX_RINGS; ring++) {
            const radius = ring * NodePlacement.RING_STEP;
            const candidateCount = 8 * ring;
            for (let index = 0; index < candidateCount; index++) {
                // Start to the right and go round, so results are stable and predictable.
                const angle = (index / candidateCount) * Math.PI * 2;
                const positionX = preferred.positionX + radius * Math.cos(angle);
                const positionY = preferred.positionY + radius * Math.sin(angle);
                if (NodePlacement.isFree(obstacles, positionX, positionY)) {
                    return { positionX: Math.round(positionX), positionY: Math.round(positionY) };
                }
            }
        }
        return { ...preferred };
    }

    /**
     * @param {import('../core/AutomatonGraph.js').AutomatonGraph} graph
     * @param {number} positionX
     * @param {number} positionY
     * @returns {boolean} Whether a new state at this point would overlap nothing.
     */
    static isPositionFree(graph, positionX, positionY) {
        return NodePlacement.isFree(NodePlacement.collectObstacles(graph), positionX, positionY);
    }

    /**
     * @param {import('../core/AutomatonGraph.js').AutomatonGraph} graph
     * @returns {{nodes: Array<{x: number, y: number}>, edgePolylines: Array<Array<{x: number, y: number}>>, labels: Array<{x: number, y: number}>}}
     */
    static collectObstacles(graph) {
        const nodes = graph.nodes.map(node => ({ x: node.positionX, y: node.positionY }));
        const edgePolylines = [];
        const labels = [];

        graph.edges.forEach(edge => {
            const sourceNode = graph.getNodeById(edge.sourceId);
            const targetNode = graph.getNodeById(edge.targetId);
            if (!sourceNode || !targetNode) return;
            edgePolylines.push(NodePlacement.sampleEdge(edge, sourceNode, targetNode));
            const { labelPositionX, labelPositionY } = GeometryUtils.computeEdgePathAndLabelPosition(edge, sourceNode, targetNode);
            labels.push({ x: labelPositionX, y: labelPositionY });
        });

        return { nodes, edgePolylines, labels };
    }

    /**
     * Approximates an edge's drawn shape as a polyline.
     * @param {import('../core/AutomatonEdge.js').AutomatonEdge} edge
     * @param {AutomatonNode} sourceNode
     * @param {AutomatonNode} targetNode
     * @returns {Array<{x: number, y: number}>}
     */
    static sampleEdge(edge, sourceNode, targetNode) {
        const samples = NodePlacement.CURVE_SAMPLES;
        const points = [];

        if (edge.isSelfLoop) {
            const loopRadius = AutomatonNode.RADIUS * 0.85;
            const centerDistance = AutomatonNode.RADIUS + loopRadius * 0.6;
            const centerX = sourceNode.positionX + centerDistance * Math.cos(edge.loopAngle);
            const centerY = sourceNode.positionY + centerDistance * Math.sin(edge.loopAngle);
            for (let index = 0; index <= samples; index++) {
                const angle = (index / samples) * Math.PI * 2;
                points.push({ x: centerX + loopRadius * Math.cos(angle), y: centerY + loopRadius * Math.sin(angle) });
            }
            return points;
        }

        const startX = sourceNode.positionX;
        const startY = sourceNode.positionY;
        const endX = targetNode.positionX;
        const endY = targetNode.positionY;
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const distance = Math.hypot(deltaX, deltaY) || 1;
        const curveOffset = Math.abs(edge.curveOffset || 0) < 1 ? 0 : edge.curveOffset;
        const controlX = (startX + endX) / 2 + (-deltaY / distance) * curveOffset;
        const controlY = (startY + endY) / 2 + (deltaX / distance) * curveOffset;

        for (let index = 0; index <= samples; index++) {
            const t = index / samples;
            const inverse = 1 - t;
            points.push({
                x: inverse * inverse * startX + 2 * inverse * t * controlX + t * t * endX,
                y: inverse * inverse * startY + 2 * inverse * t * controlY + t * t * endY
            });
        }
        return points;
    }

    /**
     * @param {ReturnType<typeof NodePlacement.collectObstacles>} obstacles
     * @param {number} positionX
     * @param {number} positionY
     * @returns {boolean}
     */
    static isFree(obstacles, positionX, positionY) {
        for (const node of obstacles.nodes) {
            if (Math.hypot(node.x - positionX, node.y - positionY) < NodePlacement.MIN_NODE_DISTANCE) return false;
        }
        for (const label of obstacles.labels) {
            if (Math.hypot(label.x - positionX, label.y - positionY) < NodePlacement.MIN_LABEL_DISTANCE) return false;
        }
        for (const polyline of obstacles.edgePolylines) {
            for (let index = 1; index < polyline.length; index++) {
                const distance = NodePlacement.distanceToSegment(positionX, positionY, polyline[index - 1], polyline[index]);
                if (distance < NodePlacement.MIN_EDGE_DISTANCE) return false;
            }
        }
        return true;
    }

    /**
     * @param {number} pointX
     * @param {number} pointY
     * @param {{x: number, y: number}} segmentStart
     * @param {{x: number, y: number}} segmentEnd
     * @returns {number} The shortest distance from the point to the segment.
     */
    static distanceToSegment(pointX, pointY, segmentStart, segmentEnd) {
        const deltaX = segmentEnd.x - segmentStart.x;
        const deltaY = segmentEnd.y - segmentStart.y;
        const lengthSquared = deltaX * deltaX + deltaY * deltaY;
        if (lengthSquared === 0) return Math.hypot(pointX - segmentStart.x, pointY - segmentStart.y);
        const t = Math.max(0, Math.min(1, ((pointX - segmentStart.x) * deltaX + (pointY - segmentStart.y) * deltaY) / lengthSquared));
        return Math.hypot(pointX - (segmentStart.x + t * deltaX), pointY - (segmentStart.y + t * deltaY));
    }
}
