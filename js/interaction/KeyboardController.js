import { AutomatonNode } from '../core/AutomatonNode.js';
import { AutomatonEdge } from '../core/AutomatonEdge.js';

/**
 * Provides full keyboard-only control of the diagram: creating, selecting, moving,
 * connecting, reshaping, and deleting nodes and edges without a mouse or touch input.
 */
export class KeyboardController {
    static MOVE_STEP = 10;
    static FINE_MOVE_STEP = 1;

    /**
     * @param {Object} dependencies
     * @param {import('../core/AutomatonGraph.js').AutomatonGraph} dependencies.graph
     * @param {import('./SelectionModel.js').SelectionModel} dependencies.selectionModel
     * @param {import('./CameraController.js').CameraController} dependencies.cameraController
     * @param {import('./SelectionModel.js').EdgeDraftState} dependencies.edgeDraft
     * @param {SVGPathElement} dependencies.tempEdgePathElement
     * @param {() => void} dependencies.requestRender
     * @param {() => void} dependencies.openPropertiesPanel
     * @param {() => void} dependencies.closePropertiesPanel
     * @param {(message: string) => void} dependencies.announce
     */
    constructor({ graph, selectionModel, cameraController, edgeDraft, tempEdgePathElement, requestRender, openPropertiesPanel, closePropertiesPanel, announce }) {
        this.graph = graph;
        this.selectionModel = selectionModel;
        this.cameraController = cameraController;
        this.edgeDraft = edgeDraft;
        this.tempEdgePathElement = tempEdgePathElement;
        this.requestRender = requestRender;
        this.openPropertiesPanel = openPropertiesPanel;
        this.closePropertiesPanel = closePropertiesPanel;
        this.announce = announce;

        window.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    /**
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
        const isEditingField = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA';

        if (event.key === 'Delete' || event.key === 'Backspace') {
            if (isEditingField) return;
            this.deleteSelection();
            return;
        }

        if (isEditingField) return;

        switch (event.key) {
            case 'n':
            case 'N':
                event.preventDefault();
                this.createNodeAtViewCenter();
                break;
            case '[':
                event.preventDefault();
                this.cycleSelection(-1);
                break;
            case ']':
                event.preventDefault();
                this.cycleSelection(1);
                break;
            case 'Enter':
                event.preventDefault();
                this.handleEnter();
                break;
            case 'Escape':
                this.handleEscape();
                break;
            case '+':
            case '=':
                event.preventDefault();
                this.adjustSelectedEdgeCurve(1);
                break;
            case '-':
                event.preventDefault();
                this.adjustSelectedEdgeCurve(-1);
                break;
            case '0':
                event.preventDefault();
                this.resetSelectedEdgeCurve();
                break;
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowLeft':
            case 'ArrowRight':
                this.handleArrowKey(event);
                break;
            default:
                break;
        }
    }

    deleteSelection() {
        if (this.selectionModel.selectedNodeIds.size > 0) {
            this.selectionModel.selectedNodeIds.forEach(id => this.graph.deleteNode(id));
            this.selectionModel.clear();
            this.requestRender();
        } else if (this.selectionModel.selectedElement && this.selectionModel.selectedElement.type === 'edge') {
            this.graph.deleteEdge(this.selectionModel.selectedElement.id);
            this.selectionModel.clear();
            this.requestRender();
        }
    }

    createNodeAtViewCenter() {
        const center = this.cameraController.getViewCenter();
        const cascade = (this.graph.nextNodeIndex % 6) * 18;
        const newNode = this.graph.addNode(center.positionX + cascade, center.positionY + cascade);
        this.selectionModel.selectSingleNode(newNode.id);
        this.openPropertiesPanel();
        this.requestRender();
        this.announce(`Created node ${newNode.name}`);
    }

    /**
     * @param {1|-1} direction
     */
    cycleSelection(direction) {
        if (this.edgeDraft.active) {
            this.selectionModel.cycle(this.graph.nodes, direction);
            const target = this.selectionModel.resolve(this.graph);
            this.announce(`Target node ${target ? target.name : ''}`);
            this.requestRender();
            return;
        }

        this.selectionModel.cycle(this.graph.selectableElements, direction);
        const selected = this.selectionModel.resolve(this.graph);
        if (selected) {
            this.openPropertiesPanel();
            const isNode = selected instanceof AutomatonNode;
            this.announce(`Selected ${isNode ? 'node' : 'edge'} ${isNode ? selected.name : selected.label}`);
        }
        this.requestRender();
    }

    handleEnter() {
        if (this.edgeDraft.active) {
            this.confirmEdgeDraft();
        } else if (this.selectionModel.selectedElement?.type === 'node' && this.selectionModel.selectedNodeIds.size === 1) {
            this.startEdgeDraft();
        }
    }

    startEdgeDraft() {
        const sourceId = [...this.selectionModel.selectedNodeIds][0];
        this.edgeDraft.start(sourceId);
        this.tempEdgePathElement.style.display = 'none';
        this.requestRender();
        this.announce('Drawing edge. Use bracket keys to choose a target node, Enter to connect, Escape to cancel.');
    }

    confirmEdgeDraft() {
        const targetId = [...this.selectionModel.selectedNodeIds][0];
        if (!targetId) return;
        const newEdge = this.graph.addEdge(this.edgeDraft.sourceNodeId, targetId);
        this.edgeDraft.cancel();
        this.selectionModel.selectEdge(newEdge.id);
        this.openPropertiesPanel();
        this.requestRender();
        this.announce('Edge created');
    }

    handleEscape() {
        if (this.edgeDraft.active) {
            this.edgeDraft.cancel();
            this.tempEdgePathElement.style.display = 'none';
            this.announce('Edge drawing cancelled');
        } else {
            this.selectionModel.clear();
            this.closePropertiesPanel();
        }
        this.requestRender();
    }

    /**
     * @param {1|-1} direction
     */
    adjustSelectedEdgeCurve(direction) {
        const selected = this.selectionModel.resolve(this.graph);
        if (!(selected instanceof AutomatonEdge)) return;
        selected.adjustCurve(direction);
        this.requestRender();
        this.announce(selected.isSelfLoop ? 'Loop angle adjusted' : 'Curve adjusted');
    }

    resetSelectedEdgeCurve() {
        const selected = this.selectionModel.resolve(this.graph);
        if (!(selected instanceof AutomatonEdge)) return;
        selected.resetCurve();
        this.requestRender();
        this.announce('Edge shape reset');
    }

    /**
     * @param {KeyboardEvent} event
     */
    handleArrowKey(event) {
        if (this.selectionModel.selectedNodeIds.size === 0) return;

        const step = event.shiftKey ? KeyboardController.FINE_MOVE_STEP : KeyboardController.MOVE_STEP;
        let deltaX = 0;
        let deltaY = 0;
        if (event.key === 'ArrowUp') deltaY = -step;
        else if (event.key === 'ArrowDown') deltaY = step;
        else if (event.key === 'ArrowLeft') deltaX = -step;
        else deltaX = step;

        event.preventDefault();
        this.selectionModel.selectedNodeIds.forEach(id => {
            const node = this.graph.getNodeById(id);
            if (node) node.moveBy(deltaX, deltaY);
        });
        this.requestRender();
    }
}
