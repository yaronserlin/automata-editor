import { describe, it, expect } from 'vitest';
import { AutomatonNode } from '../js/core/AutomatonNode.js';
import { AutomatonEdge } from '../js/core/AutomatonEdge.js';
import { AutomatonGraph } from '../js/core/AutomatonGraph.js';

describe('AutomatonNode.fromRaw', () => {
    it('accepts a well-formed node', () => {
        const node = AutomatonNode.fromRaw({ id: 'node-0', positionX: 10, positionY: 20, name: 'q_{0}', isStart: true, isAccept: false }, 0);
        expect(node).toBeInstanceOf(AutomatonNode);
        expect(node).toMatchObject({ id: 'node-0', positionX: 10, positionY: 20, name: 'q_{0}', isStart: true, isAccept: false });
    });

    it('rejects a node with missing or non-numeric coordinates', () => {
        expect(AutomatonNode.fromRaw({ id: 'a', positionX: 'oops', positionY: 5 }, 0)).toBeNull();
        expect(AutomatonNode.fromRaw({ id: 'a', positionY: 5 }, 0)).toBeNull();
        expect(AutomatonNode.fromRaw({ id: 'a', positionX: NaN, positionY: 5 }, 0)).toBeNull();
    });

    it('rejects non-object entries', () => {
        expect(AutomatonNode.fromRaw(null, 0)).toBeNull();
        expect(AutomatonNode.fromRaw('node', 0)).toBeNull();
    });

    it('falls back to an index-based id and coerces a non-string name', () => {
        const node = AutomatonNode.fromRaw({ positionX: 1, positionY: 1, name: 42 }, 3);
        expect(node.id).toBe('node-3');
        expect(node.name).toBe('42');
    });
});

describe('AutomatonEdge.fromRaw', () => {
    const validNodeIds = new Set(['n0', 'n1']);

    it('accepts an edge between two known nodes', () => {
        const edge = AutomatonEdge.fromRaw({ id: 'e0', sourceId: 'n0', targetId: 'n1', label: 'a' }, 0, validNodeIds);
        expect(edge).toBeInstanceOf(AutomatonEdge);
        expect(edge).toMatchObject({ id: 'e0', sourceId: 'n0', targetId: 'n1', label: 'a', curveOffset: 0 });
    });

    it('rejects an edge referencing an unknown node id', () => {
        expect(AutomatonEdge.fromRaw({ id: 'e0', sourceId: 'n0', targetId: 'ghost', label: 'a' }, 0, validNodeIds)).toBeNull();
    });

    it('preserves a self-loop\'s loop angle', () => {
        const edge = AutomatonEdge.fromRaw({ sourceId: 'n0', targetId: 'n0', label: 'a' }, 0, validNodeIds);
        expect(edge.isSelfLoop).toBe(true);
        expect(edge.loopAngle).toBe(AutomatonEdge.DEFAULT_LOOP_ANGLE);
    });
});

describe('AutomatonGraph.fromRaw', () => {
    it('returns null for a structurally invalid file', () => {
        expect(AutomatonGraph.fromRaw(null)).toBeNull();
        expect(AutomatonGraph.fromRaw({})).toBeNull();
        expect(AutomatonGraph.fromRaw({ nodes: 'not-an-array', edges: [] })).toBeNull();
    });

    it('reconstructs a valid project with zero dropped entries', () => {
        const parsed = {
            nodes: [{ id: 'n0', positionX: 0, positionY: 0, name: 'q_{0}' }],
            edges: [],
            nodeIdCounter: 1,
            edgeIdCounter: 0,
            currentZoom: 1.5
        };
        const result = AutomatonGraph.fromRaw(parsed);
        expect(result.droppedCount).toBe(0);
        expect(result.graph.nodes).toHaveLength(1);
        expect(result.zoom).toBe(1.5);
    });

    it('drops malformed nodes and edges with dangling references instead of throwing', () => {
        const parsed = {
            nodes: [
                { id: 'n0', positionX: 0, positionY: 0 },
                { id: 'bad', positionX: null, positionY: 0 }
            ],
            edges: [
                { sourceId: 'n0', targetId: 'n0', label: 'a' },
                { sourceId: 'n0', targetId: 'ghost', label: 'b' }
            ]
        };
        const result = AutomatonGraph.fromRaw(parsed);
        expect(result.graph.nodes).toHaveLength(1);
        expect(result.graph.edges).toHaveLength(1);
        expect(result.droppedCount).toBe(2);
    });

    it('de-duplicates repeated node ids', () => {
        const parsed = {
            nodes: [
                { id: 'n1', positionX: 0, positionY: 0 },
                { id: 'n1', positionX: 5, positionY: 5 }
            ],
            edges: []
        };
        const result = AutomatonGraph.fromRaw(parsed);
        expect(result.graph.nodes).toHaveLength(2);
        expect(new Set(result.graph.nodes.map(node => node.id)).size).toBe(2);
    });

    it('defaults missing numeric fields instead of propagating NaN or undefined', () => {
        const result = AutomatonGraph.fromRaw({ nodes: [], edges: [] });
        expect(result.panPositionX).toBe(0);
        expect(result.panPositionY).toBe(0);
        expect(result.zoom).toBe(1.0);
        expect(result.graph.nextNodeIndex).toBe(0);
        expect(result.graph.nextEdgeIndex).toBe(0);
    });
});
