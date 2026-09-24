import { describe, it, expect } from 'vitest';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { AutomatonGraph } from '../js/core/AutomatonGraph.js';

describe('HistoryManager', () => {
    it('undoes and redoes recorded states in order', () => {
        const history = new HistoryManager();
        history.reset('A');
        history.record('B');
        history.record('C');

        expect(history.undo()).toBe('B');
        expect(history.undo()).toBe('A');
        expect(history.undo()).toBeNull();
        expect(history.redo()).toBe('B');
        expect(history.redo()).toBe('C');
        expect(history.redo()).toBeNull();
    });

    it('ignores a state equal to the current one', () => {
        const history = new HistoryManager();
        history.reset('A');
        expect(history.record('A')).toBe(false);
        expect(history.canUndo).toBe(false);
        expect(history.record('B')).toBe(true);
        expect(history.canUndo).toBe(true);
    });

    it('clears the redo stack when a new change is recorded after undo', () => {
        const history = new HistoryManager();
        history.reset('A');
        history.record('B');
        history.undo();
        expect(history.canRedo).toBe(true);
        history.record('C');
        expect(history.canRedo).toBe(false);
        expect(history.undo()).toBe('A');
    });

    it('drops the oldest steps past its limit', () => {
        const history = new HistoryManager(2);
        history.reset('A');
        history.record('B');
        history.record('C');
        history.record('D');
        expect(history.undo()).toBe('C');
        expect(history.undo()).toBe('B');
        expect(history.undo()).toBeNull();
    });

    it('treats the first record without a baseline as the baseline', () => {
        const history = new HistoryManager();
        history.record('A');
        expect(history.canUndo).toBe(false);
    });
});

describe('AutomatonGraph snapshots', () => {
    it('round-trips a graph through toSnapshot/fromSnapshot unchanged', () => {
        const graph = new AutomatonGraph();
        const a = graph.addNode(10, 20);
        const b = graph.addNode(110, 20);
        a.isStart = true;
        b.isAccept = true;
        graph.addEdge(a.id, b.id, 'a, b');
        graph.addEdge(b.id, b.id, '\\epsilon');

        const snapshot = graph.toSnapshot();
        const restored = AutomatonGraph.fromSnapshot(snapshot);

        expect(restored.toSnapshot()).toBe(snapshot);
        expect(restored.nextNodeIndex).toBe(graph.nextNodeIndex);
        expect(restored.nextEdgeIndex).toBe(graph.nextEdgeIndex);
    });

    it('gives different snapshots for different diagrams and equal ones for equal diagrams', () => {
        const graph = new AutomatonGraph();
        const node = graph.addNode(0, 0);
        const before = graph.toSnapshot();
        expect(graph.toSnapshot()).toBe(before);
        node.moveBy(5, 0);
        expect(graph.toSnapshot()).not.toBe(before);
    });

    it('supports undoing a deletion end to end', () => {
        const graph = new AutomatonGraph();
        const history = new HistoryManager();
        const a = graph.addNode(0, 0);
        const b = graph.addNode(100, 0);
        graph.addEdge(a.id, b.id, 'x');
        history.reset(graph.toSnapshot());

        graph.deleteNode(a.id);
        history.record(graph.toSnapshot());
        expect(graph.edges).toHaveLength(0);

        graph.replaceWith(AutomatonGraph.fromSnapshot(history.undo()));
        expect(graph.nodes).toHaveLength(2);
        expect(graph.edges).toHaveLength(1);
        expect(graph.edges[0].label).toBe('x');
    });
});
