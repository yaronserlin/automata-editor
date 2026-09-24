import { describe, it, expect } from 'vitest';
import { NodePlacement } from '../js/geometry/NodePlacement.js';
import { AutomatonGraph } from '../js/core/AutomatonGraph.js';

describe('NodePlacement.findFreePosition', () => {
    it('uses the preferred point when the canvas is empty there', () => {
        const graph = new AutomatonGraph();
        graph.addNode(1000, 1000);
        expect(NodePlacement.findFreePosition(graph, { positionX: 0, positionY: 0 })).toEqual({ positionX: 0, positionY: 0 });
    });

    it('moves away from a state sitting on the preferred point', () => {
        const graph = new AutomatonGraph();
        graph.addNode(500, 300);
        const position = NodePlacement.findFreePosition(graph, { positionX: 500, positionY: 300 });
        const distance = Math.hypot(position.positionX - 500, position.positionY - 300);
        expect(distance).toBeGreaterThanOrEqual(NodePlacement.MIN_NODE_DISTANCE);
    });

    it('does not land on a transition passing through the preferred point', () => {
        // The default example: two states with a straight edge through the view center.
        const graph = new AutomatonGraph();
        const a = graph.addNode(350, 300);
        const b = graph.addNode(650, 300);
        graph.addEdge(a.id, b.id, 'a');

        expect(NodePlacement.isPositionFree(graph, 500, 300)).toBe(false);
        const position = NodePlacement.findFreePosition(graph, { positionX: 500, positionY: 300 });
        expect(NodePlacement.isPositionFree(graph, position.positionX, position.positionY)).toBe(true);
        expect(Math.abs(position.positionY - 300)).toBeGreaterThanOrEqual(NodePlacement.MIN_EDGE_DISTANCE);
    });

    it('keeps successive new states apart from each other', () => {
        const graph = new AutomatonGraph();
        for (let index = 0; index < 6; index++) {
            const position = NodePlacement.findFreePosition(graph, { positionX: 500, positionY: 300 });
            graph.addNode(position.positionX, position.positionY);
        }
        for (let i = 0; i < graph.nodes.length; i++) {
            for (let j = i + 1; j < graph.nodes.length; j++) {
                const distance = Math.hypot(graph.nodes[i].positionX - graph.nodes[j].positionX, graph.nodes[i].positionY - graph.nodes[j].positionY);
                expect(distance).toBeGreaterThanOrEqual(NodePlacement.MIN_NODE_DISTANCE);
            }
        }
    });

    it('avoids self-loops and curved edges', () => {
        const graph = new AutomatonGraph();
        const a = graph.addNode(500, 300);
        graph.addEdge(a.id, a.id, 'x');
        const loopTop = { positionX: 500, positionY: 300 - 30 - 25 };
        expect(NodePlacement.isPositionFree(graph, loopTop.positionX, loopTop.positionY)).toBe(false);

        const curved = new AutomatonGraph();
        const b = curved.addNode(300, 300);
        const c = curved.addNode(700, 300);
        const edge = curved.addEdge(b.id, c.id, 'y');
        edge.curveOffset = 120;
        // A quadratic curve's apex sits halfway to its control point.
        expect(NodePlacement.isPositionFree(curved, 500, 360)).toBe(false);
    });
});

describe('NodePlacement.distanceToSegment', () => {
    it('measures perpendicular and endpoint distances', () => {
        const start = { x: 0, y: 0 };
        const end = { x: 10, y: 0 };
        expect(NodePlacement.distanceToSegment(5, 3, start, end)).toBe(3);
        expect(NodePlacement.distanceToSegment(-4, 3, start, end)).toBe(5);
        expect(NodePlacement.distanceToSegment(2, 2, start, start)).toBeCloseTo(Math.SQRT2 * 2);
    });
});
