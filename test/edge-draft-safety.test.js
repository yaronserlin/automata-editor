import { describe, it, expect } from 'vitest';
import { AutomatonGraph } from '../js/core/AutomatonGraph.js';
import { SelectionModel, EdgeDraftState } from '../js/interaction/SelectionModel.js';
import { KeyboardController } from '../js/interaction/KeyboardController.js';
import { PointerController } from '../js/interaction/PointerController.js';

function makePointerController(graph, selectionModel, edgeDraft, tempEdge) {
    return new PointerController({
        svgElement: { addEventListener() {}, style: {} },
        tempEdgePathElement: tempEdge,
        selectionBoxElement: { setAttribute() {}, classList: { remove() {}, add() {} } },
        graph,
        selectionModel,
        cameraController: {},
        edgeDraft,
        requestRender() {},
        openPropertiesPanel() {},
        closePropertiesPanel() {}
    });
}

describe('edge-draft safety around deletion', () => {
    it('deleteSelection cancels an in-progress edge draft', () => {
        globalThis.window = { addEventListener() {} };
        const graph = new AutomatonGraph();
        const a = graph.addNode(0, 0);
        graph.addNode(100, 0);
        const selectionModel = new SelectionModel();
        const edgeDraft = new EdgeDraftState();
        const tempEdge = { style: {} };
        const controller = new KeyboardController({
            graph,
            selectionModel,
            cameraController: {},
            edgeDraft,
            tempEdgePathElement: tempEdge,
            requestRender() {},
            openPropertiesPanel() {},
            closePropertiesPanel() {},
            announce() {}
        });

        selectionModel.selectSingleNode(a.id);
        edgeDraft.start(a.id, 'keyboard');
        controller.deleteSelection();

        expect(edgeDraft.active).toBe(false);
        expect(edgeDraft.sourceNodeId).toBeNull();
        expect(tempEdge.style.display).toBe('none');
        expect(graph.nodes).toHaveLength(1);
    });

    it('handleEdgeDrawMove cancels a draft whose source node is gone instead of throwing', () => {
        const graph = new AutomatonGraph();
        const selectionModel = new SelectionModel();
        const edgeDraft = new EdgeDraftState();
        const tempEdge = { style: {} };
        const controller = makePointerController(graph, selectionModel, edgeDraft, tempEdge);

        edgeDraft.start('node-that-was-deleted', 'pointer');
        expect(() => controller.handleEdgeDrawMove({ positionX: 5, positionY: 5 })).not.toThrow();
        expect(edgeDraft.active).toBe(false);
        expect(tempEdge.style.display).toBe('none');
    });

    it('handleEdgeDragMove drops the gesture when the dragged edge is gone instead of throwing', () => {
        const graph = new AutomatonGraph();
        const selectionModel = new SelectionModel();
        const edgeDraft = new EdgeDraftState();
        const controller = makePointerController(graph, selectionModel, edgeDraft, { style: {} });

        controller.isDraggingEdge = true;
        controller.draggedEdgeId = 'edge-that-was-deleted';
        expect(() => controller.handleEdgeDragMove({ positionX: 5, positionY: 5 })).not.toThrow();
        expect(controller.isDraggingEdge).toBe(false);
        expect(controller.draggedEdgeId).toBeNull();
    });
});
