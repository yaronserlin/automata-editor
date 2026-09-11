import { describe, it, expect, beforeEach } from 'vitest';
import { AutomatonGraph } from '../js/core/AutomatonGraph.js';

describe('AutomatonGraph', () => {
    let graph;

    beforeEach(() => {
        graph = new AutomatonGraph();
    });

    it('addNode assigns a sequential name and empty flags', () => {
        const a = graph.addNode(10, 20);
        const b = graph.addNode(30, 40);
        expect(a.name).toBe('q_{0}');
        expect(b.name).toBe('q_{1}');
        expect(a.isStart).toBe(false);
        expect(a.isAccept).toBe(false);
        expect(graph.nodes).toHaveLength(2);
    });

    it('addEdge defaults to an epsilon-labeled transition', () => {
        const a = graph.addNode(0, 0);
        const b = graph.addNode(100, 0);
        const edge = graph.addEdge(a.id, b.id);
        expect(edge.label).toBe('\\epsilon');
        expect(edge.sourceId).toBe(a.id);
        expect(edge.targetId).toBe(b.id);
    });

    it('addEdge gives a self-loop a loop angle and a regular edge a curve offset', () => {
        const a = graph.addNode(0, 0);
        const b = graph.addNode(100, 0);
        const selfLoop = graph.addEdge(a.id, a.id, 'x');
        const straight = graph.addEdge(a.id, b.id, 'y');
        expect(selfLoop.isSelfLoop).toBe(true);
        expect(straight.curveOffset).toBe(0);
    });

    it('addEdge curves a second edge between the same two nodes so they do not overlap', () => {
        const a = graph.addNode(0, 0);
        const b = graph.addNode(100, 0);
        graph.addEdge(a.id, b.id, 'x');
        const second = graph.addEdge(a.id, b.id, 'y');
        expect(second.curveOffset).not.toBe(0);
    });

    it('deleteNode removes the node and any edges touching it', () => {
        const a = graph.addNode(0, 0);
        const b = graph.addNode(100, 0);
        graph.addEdge(a.id, b.id, 'x');

        graph.deleteNode(a.id);

        expect(graph.getNodeById(a.id)).toBeUndefined();
        expect(graph.edges).toHaveLength(0);
    });

    it('deleteEdge removes only the targeted edge', () => {
        const a = graph.addNode(0, 0);
        const b = graph.addNode(100, 0);
        const keep = graph.addEdge(a.id, b.id, 'x');
        const remove = graph.addEdge(b.id, a.id, 'y');

        graph.deleteEdge(remove.id);

        expect(graph.edges).toHaveLength(1);
        expect(graph.getEdgeById(keep.id)).toBeDefined();
        expect(graph.getEdgeById(remove.id)).toBeUndefined();
    });

    it('getNodeById/getEdgeById return undefined for unknown ids', () => {
        expect(graph.getNodeById('does-not-exist')).toBeUndefined();
        expect(graph.getEdgeById('does-not-exist')).toBeUndefined();
    });

    it('selectableElements lists every node followed by every edge', () => {
        const a = graph.addNode(0, 0);
        const b = graph.addNode(100, 0);
        const edge = graph.addEdge(a.id, b.id);
        expect(graph.selectableElements).toEqual([a, b, edge]);
    });

    it('replaceWith swaps in another graph\'s contents while keeping the same instance', () => {
        graph.addNode(0, 0);
        const other = new AutomatonGraph();
        other.addNode(10, 10);
        other.addNode(20, 20);

        graph.replaceWith(other);

        expect(graph.nodes).toHaveLength(2);
        expect(graph.nodes[0].positionX).toBe(10);
    });
});
