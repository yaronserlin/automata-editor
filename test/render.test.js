import { describe, it, expect } from 'vitest';
import { AutomatonEdge } from '../js/core/AutomatonEdge.js';
import { SelectionModel } from '../js/interaction/SelectionModel.js';
import { AutomatonGraph } from '../js/core/AutomatonGraph.js';

describe('AutomatonEdge curve editing', () => {
    it('adjustCurve bends a regular edge by the curve step', () => {
        const edge = new AutomatonEdge('e0', 'a', 'b', 'x');
        edge.adjustCurve(1);
        expect(edge.curveOffset).toBe(AutomatonEdge.CURVE_STEP);
        edge.adjustCurve(-1);
        expect(edge.curveOffset).toBe(0);
    });

    it('adjustCurve rotates a self-loop\'s angle instead of setting a curve offset', () => {
        const edge = new AutomatonEdge('e0', 'a', 'a', 'x');
        const initialAngle = edge.loopAngle;
        edge.adjustCurve(1);
        expect(edge.loopAngle).toBe(initialAngle + AutomatonEdge.LOOP_ANGLE_STEP);
        expect(edge.curveOffset).toBe(0);
    });

    it('resetCurve restores the default straight/loop-up shape', () => {
        const edge = new AutomatonEdge('e0', 'a', 'b', 'x', { curveOffset: 80 });
        edge.resetCurve();
        expect(edge.curveOffset).toBe(0);
        expect(edge.loopAngle).toBe(AutomatonEdge.DEFAULT_LOOP_ANGLE);
    });
});

describe('SelectionModel.cycle', () => {
    it('cycles forward through a combined nodes-then-edges list, wrapping around', () => {
        const graph = new AutomatonGraph();
        const a = graph.addNode(0, 0);
        const b = graph.addNode(100, 0);
        const edge = graph.addEdge(a.id, b.id);
        const selection = new SelectionModel();

        selection.cycle(graph.selectableElements, 1);
        expect(selection.selectedElement).toEqual({ type: 'node', id: a.id });

        selection.cycle(graph.selectableElements, 1);
        expect(selection.selectedElement).toEqual({ type: 'node', id: b.id });

        selection.cycle(graph.selectableElements, 1);
        expect(selection.selectedElement).toEqual({ type: 'edge', id: edge.id });

        selection.cycle(graph.selectableElements, 1);
        expect(selection.selectedElement).toEqual({ type: 'node', id: a.id });
    });

    it('starts at the first element regardless of direction when nothing is selected', () => {
        const graph = new AutomatonGraph();
        const a = graph.addNode(0, 0);
        graph.addNode(100, 0);
        const selection = new SelectionModel();

        selection.cycle(graph.selectableElements, -1);
        expect(selection.selectedElement).toEqual({ type: 'node', id: a.id });
    });

    it('cycles backward once a selection already exists', () => {
        const graph = new AutomatonGraph();
        const a = graph.addNode(0, 0);
        const b = graph.addNode(100, 0);
        const selection = new SelectionModel();

        selection.selectSingleNode(a.id);
        selection.cycle(graph.selectableElements, -1);
        expect(selection.selectedElement).toEqual({ type: 'node', id: b.id });
    });

    it('does nothing when the list is empty', () => {
        const selection = new SelectionModel();
        selection.cycle([], 1);
        expect(selection.selectedElement).toBeNull();
    });
});
