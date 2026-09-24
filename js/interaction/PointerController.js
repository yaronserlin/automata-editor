import { GeometryUtils } from '../geometry/GeometryUtils.js';
import { AutomatonNode } from '../core/AutomatonNode.js';

/**
 * Interprets mouse and touch input on the canvas: panning, zooming, box-select,
 * dragging nodes/edges/the start-arrow, and drawing new edges by drag or double-click.
 */
export class PointerController {
    /** @type {number} Maximum gap between two presses on a node that counts as a double-click. */
    static DOUBLE_CLICK_MS = 400;

    /**
     * @param {Object} dependencies
     * @param {SVGSVGElement} dependencies.svgElement
     * @param {SVGPathElement} dependencies.tempEdgePathElement
     * @param {SVGRectElement} dependencies.selectionBoxElement
     * @param {import('../core/AutomatonGraph.js').AutomatonGraph} dependencies.graph
     * @param {import('./SelectionModel.js').SelectionModel} dependencies.selectionModel
     * @param {import('./CameraController.js').CameraController} dependencies.cameraController
     * @param {import('./SelectionModel.js').EdgeDraftState} dependencies.edgeDraft
     * @param {() => void} dependencies.requestRender
     * @param {() => void} dependencies.openPropertiesPanel
     * @param {() => void} dependencies.closePropertiesPanel
     */
    constructor({ svgElement, tempEdgePathElement, selectionBoxElement, graph, selectionModel, cameraController, edgeDraft, requestRender, openPropertiesPanel, closePropertiesPanel }) {
        this.svgElement = svgElement;
        this.tempEdgePathElement = tempEdgePathElement;
        this.selectionBoxElement = selectionBoxElement;
        this.graph = graph;
        this.selectionModel = selectionModel;
        this.cameraController = cameraController;
        this.edgeDraft = edgeDraft;
        this.requestRender = requestRender;
        this.openPropertiesPanel = openPropertiesPanel;
        this.closePropertiesPanel = closePropertiesPanel;

        this.isDraggingNode = false;
        this.draggedNodeId = null;
        this.initialNodePositions = new Map();
        this.dragStartPosition = { positionX: 0, positionY: 0 };

        this.isDraggingEdge = false;
        this.draggedEdgeId = null;

        this.isDraggingStartArrow = false;
        this.draggedStartArrowNodeId = null;

        this.isBoxSelecting = false;
        this.selectionBoxStart = { positionX: 0, positionY: 0 };
        this.preBoxSelectedNodeIds = new Set();

        this.isPanning = false;
        this.panStart = { positionX: 0, positionY: 0, initialPanX: 0, initialPanY: 0 };

        this.isPinching = false;
        this.initialPinchDistance = null;
        /** @type {{clientX: number, clientY: number}|null} Last midpoint of a two-finger gesture, for panning. */
        this.lastPinchMidpoint = null;

        this.lastCanvasTapTime = 0;
        this.lastNodeTapTime = 0;
        /** @type {{nodeId: string, time: number}|null} Last mouse press on a node, for double-click detection. */
        this.lastNodeClick = null;
        /**
         * True between the double-click/double-tap that starts an edge and the release of
         * that same press, so releasing on the source state keeps the draft open (the user
         * then clicks the target) instead of instantly creating a self-loop.
         */
        this.awaitingDraftRelease = false;

        /** @type {Array<{type: 'v'|'h', x?: number, y?: number}>} */
        this.activeGuides = [];

        this.bindCanvasEvents();
    }

    bindCanvasEvents() {
        this.svgElement.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.svgElement.addEventListener('mousedown', this.handleCanvasPointerDown.bind(this));
        this.svgElement.addEventListener('touchstart', this.handleCanvasPointerDown.bind(this), { passive: false });
        this.svgElement.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        this.svgElement.addEventListener('mousemove', this.handleCanvasPointerMove.bind(this));
        this.svgElement.addEventListener('touchmove', this.handleCanvasPointerMove.bind(this), { passive: false });
        this.svgElement.addEventListener('mouseup', this.handleCanvasPointerUp.bind(this));
        this.svgElement.addEventListener('touchend', this.handleCanvasPointerUp.bind(this));
        this.svgElement.addEventListener('touchcancel', this.handleCanvasPointerUp.bind(this));
    }

    /**
     * Moves keyboard focus from a text field (e.g. Test input or the properties panel)
     * back to the canvas when the user presses on it, so shortcuts like Delete and
     * Ctrl+Z work right away. Pressing on a state calls preventDefault, which would
     * otherwise leave focus in the text field.
     */
    focusCanvas() {
        const active = document.activeElement;
        if (active && active !== this.svgElement && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
            active.blur();
            this.svgElement.focus({ preventScroll: true });
        }
    }

    /**
     * @param {WheelEvent} event
     */
    handleWheel(event) {
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            this.cameraController.changeZoom(event.deltaY > 0 ? -0.1 : 0.1);
        }
    }

    /**
     * @param {MouseEvent|TouchEvent} event
     */
    handleCanvasPointerDown(event) {
        this.focusCanvas();
        if (event.type === 'touchstart') {
            const currentTime = Date.now();
            const tapLength = currentTime - this.lastCanvasTapTime;
            if (tapLength < 300 && tapLength > 0) {
                this.handleDoubleClick(event);
                this.lastCanvasTapTime = 0;
                return;
            }
            this.lastCanvasTapTime = currentTime;
        }

        if (event.type === 'touchstart' && event.touches && event.touches.length === 2) {
            if (event.cancelable) event.preventDefault();
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            this.initialPinchDistance = Math.hypot(dx, dy);
            this.lastPinchMidpoint = this.getTouchMidpoint(event);
            this.isPinching = true;
            this.isPanning = false;
            return;
        }

        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;

        if (event.button === 1 || (event.button === 0 && event.altKey) || (event.type === 'touchstart' && event.touches && event.touches.length === 2)) {
            if (event.cancelable) event.preventDefault();
            this.isPanning = true;
            this.isPinching = false;

            let panClientX = clientX;
            let panClientY = clientY;
            if (event.touches && event.touches.length === 2) {
                panClientX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
                panClientY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
            }

            this.panStart = {
                positionX: panClientX,
                positionY: panClientY,
                initialPanX: this.cameraController.panPositionX,
                initialPanY: this.cameraController.panPositionY
            };
            this.svgElement.style.cursor = 'grabbing';
            return;
        }

        if (event.target.tagName === 'svg') {
            if (event.type !== 'touchstart' || event.cancelable) event.preventDefault();

            if (this.edgeDraft.active) {
                this.edgeDraft.cancel();
                this.tempEdgePathElement.style.display = 'none';
            }

            this.selectionModel.selectedElement = null;
            this.closePropertiesPanel();

            if (!event.shiftKey) {
                this.selectionModel.selectedNodeIds.clear();
            }
            this.preBoxSelectedNodeIds = new Set(this.selectionModel.selectedNodeIds);

            this.isBoxSelecting = true;
            this.selectionBoxStart = GeometryUtils.getMousePosition(this.svgElement, event);

            this.selectionBoxElement.setAttribute('x', this.selectionBoxStart.positionX);
            this.selectionBoxElement.setAttribute('y', this.selectionBoxStart.positionY);
            this.selectionBoxElement.setAttribute('width', 0);
            this.selectionBoxElement.setAttribute('height', 0);
            this.selectionBoxElement.classList.remove('hidden');

            this.requestRender();
        }
    }

    /**
     * @param {MouseEvent|TouchEvent} event
     */
    handleDoubleClick(event) {
        if (event.cancelable) event.preventDefault();

        const targetElement = event.target;
        const nodeGroup = targetElement.closest ? targetElement.closest('.node') : null;
        const edgeGroup = targetElement.closest ? targetElement.closest('.edge') : null;

        if (nodeGroup && nodeGroup.dataset && nodeGroup.dataset.id) {
            const nodeId = nodeGroup.dataset.id;
            // Already started by the press-timing detection in handleNodeMouseDown.
            if (this.edgeDraft.active && this.edgeDraft.sourceNodeId === nodeId) return;
            this.startEdgeDraftFromDoubleClick(event, nodeId);
        } else if (edgeGroup && edgeGroup.dataset && edgeGroup.dataset.id) {
            this.selectionModel.selectEdge(edgeGroup.dataset.id);
            this.openPropertiesPanel();
        } else if (targetElement.tagName === 'svg') {
            const position = GeometryUtils.getMousePosition(this.svgElement, event);
            const newNode = this.graph.addNode(position.positionX, position.positionY);
            this.selectionModel.selectSingleNode(newNode.id);
            this.requestRender();
        }
    }

    /**
     * Starts drawing a transition from a node after a double-click or double-tap on it.
     * The user then either keeps the button/finger down and drags to the target, or
     * releases and clicks/taps the target.
     * @param {MouseEvent|TouchEvent} event
     * @param {string} nodeId
     */
    startEdgeDraftFromDoubleClick(event, nodeId) {
        this.selectionModel.selectSingleNode(nodeId);
        this.openPropertiesPanel();

        this.edgeDraft.start(nodeId, 'pointer');
        this.awaitingDraftRelease = true;
        this.lastNodeClick = null;
        this.isDraggingNode = false;
        this.draggedNodeId = null;

        const node = this.graph.getNodeById(nodeId);
        if (node) {
            const initialTouchPos = GeometryUtils.getMousePosition(this.svgElement, event);
            this.tempEdgePathElement.style.display = 'block';
            this.tempEdgePathElement.setAttribute('d', `M ${node.positionX},${node.positionY} L ${initialTouchPos.positionX},${initialTouchPos.positionY}`);
        }
        this.requestRender();
    }

    /**
     * @param {MouseEvent|TouchEvent} event
     */
    handleCanvasPointerMove(event) {
        if (this.isPinching && event.touches && event.touches.length === 2) {
            this.handlePinchZoomMove(event);
            return;
        }
        if (this.isPanning) {
            this.handlePanMove(event);
            return;
        }

        if (event.type === 'touchmove' && (this.isDraggingNode || this.isDraggingEdge || this.edgeDraft.active || this.isBoxSelecting || this.isDraggingStartArrow)) {
            if (event.cancelable) event.preventDefault();
        }

        const mousePosition = GeometryUtils.getMousePosition(this.svgElement, event);

        if (this.isBoxSelecting) this.handleBoxSelectMove(mousePosition);
        if (this.isDraggingNode && this.draggedNodeId) this.handleNodeDragMove(mousePosition);
        if (this.isDraggingEdge && this.draggedEdgeId) this.handleEdgeDragMove(mousePosition);
        if (this.edgeDraft.active && this.edgeDraft.sourceNodeId) this.handleEdgeDrawMove(mousePosition);
        if (this.isDraggingStartArrow && this.draggedStartArrowNodeId) this.handleStartArrowDragMove(mousePosition);
    }

    /**
     * @param {TouchEvent} event
     */
    handlePinchZoomMove(event) {
        if (event.cancelable) event.preventDefault();
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const currentDistance = Math.hypot(dx, dy);
        if (this.initialPinchDistance > 0) {
            this.cameraController.changeZoom((currentDistance - this.initialPinchDistance) * 0.005);
        }
        this.initialPinchDistance = currentDistance;

        // Moving both fingers together pans the canvas, so touch users can reach off-screen states.
        const midpoint = this.getTouchMidpoint(event);
        if (this.lastPinchMidpoint) {
            this.cameraController.panPositionX += (midpoint.clientX - this.lastPinchMidpoint.clientX) / this.cameraController.zoom;
            this.cameraController.panPositionY += (midpoint.clientY - this.lastPinchMidpoint.clientY) / this.cameraController.zoom;
            this.cameraController.updateViewBox();
        }
        this.lastPinchMidpoint = midpoint;
    }

    /**
     * @param {TouchEvent} event
     * @returns {{clientX: number, clientY: number}} The midpoint between the first two touches.
     */
    getTouchMidpoint(event) {
        return {
            clientX: (event.touches[0].clientX + event.touches[1].clientX) / 2,
            clientY: (event.touches[0].clientY + event.touches[1].clientY) / 2
        };
    }

    /**
     * @returns {boolean} Whether a drag gesture that edits the diagram is still in progress,
     *   so undo history can wait for it to finish instead of recording every frame.
     */
    get isEditingGestureActive() {
        return this.isDraggingNode || this.isDraggingEdge || this.isDraggingStartArrow;
    }

    /**
     * @param {MouseEvent|TouchEvent} event
     */
    handlePanMove(event) {
        if (event.cancelable) event.preventDefault();
        let clientX = event.touches ? event.touches[0].clientX : event.clientX;
        let clientY = event.touches ? event.touches[0].clientY : event.clientY;
        if (event.touches && event.touches.length === 2) {
            clientX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
            clientY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        }
        const deltaX = (clientX - this.panStart.positionX) / this.cameraController.zoom;
        const deltaY = (clientY - this.panStart.positionY) / this.cameraController.zoom;
        this.cameraController.panPositionX = this.panStart.initialPanX + deltaX;
        this.cameraController.panPositionY = this.panStart.initialPanY + deltaY;
        this.cameraController.updateViewBox();
    }

    /**
     * @param {{positionX: number, positionY: number}} mousePosition
     */
    handleBoxSelectMove(mousePosition) {
        const startX = Math.min(this.selectionBoxStart.positionX, mousePosition.positionX);
        const startY = Math.min(this.selectionBoxStart.positionY, mousePosition.positionY);
        const boxWidth = Math.abs(mousePosition.positionX - this.selectionBoxStart.positionX);
        const boxHeight = Math.abs(mousePosition.positionY - this.selectionBoxStart.positionY);

        this.selectionBoxElement.setAttribute('x', startX);
        this.selectionBoxElement.setAttribute('y', startY);
        this.selectionBoxElement.setAttribute('width', boxWidth);
        this.selectionBoxElement.setAttribute('height', boxHeight);

        const covered = new Set(this.preBoxSelectedNodeIds);
        this.graph.nodes.forEach(node => {
            if (node.positionX >= startX && node.positionX <= startX + boxWidth &&
                node.positionY >= startY && node.positionY <= startY + boxHeight) {
                covered.add(node.id);
            }
        });
        this.selectionModel.selectNodes(covered);
        this.requestRender();
    }

    /**
     * @param {{positionX: number, positionY: number}} mousePosition
     */
    handleNodeDragMove(mousePosition) {
        const deltaX = mousePosition.positionX - this.dragStartPosition.positionX;
        const deltaY = mousePosition.positionY - this.dragStartPosition.positionY;
        const initialPosition = this.initialNodePositions.get(this.draggedNodeId);
        const proposedX = initialPosition.positionX + deltaX;
        const proposedY = initialPosition.positionY + deltaY;

        const otherNodes = this.graph.nodes.filter(node => !this.selectionModel.hasNode(node.id));
        const snapX = GeometryUtils.computeAxisSnap(otherNodes, proposedX, 'positionX');
        const snapY = GeometryUtils.computeAxisSnap(otherNodes, proposedY, 'positionY');

        this.activeGuides = [];
        if (snapX.snapped) this.activeGuides.push({ type: 'v', x: snapX.value });
        if (snapY.snapped) this.activeGuides.push({ type: 'h', y: snapY.value });

        const snappedDeltaX = snapX.value - initialPosition.positionX;
        const snappedDeltaY = snapY.value - initialPosition.positionY;

        this.selectionModel.selectedNodeIds.forEach(id => {
            const node = this.graph.getNodeById(id);
            const initial = this.initialNodePositions.get(id);
            if (node && initial) {
                node.positionX = initial.positionX + snappedDeltaX;
                node.positionY = initial.positionY + snappedDeltaY;
            }
        });
        this.requestRender();
    }

    /**
     * @param {{positionX: number, positionY: number}} mousePosition
     */
    handleEdgeDragMove(mousePosition) {
        const edge = this.graph.getEdgeById(this.draggedEdgeId);
        // The edge may have been deleted mid-drag (e.g. the Delete key works while
        // the mouse button is held down), so drop the gesture instead of throwing.
        if (!edge) {
            this.isDraggingEdge = false;
            this.draggedEdgeId = null;
            return;
        }
        const sourceNode = this.graph.getNodeById(edge.sourceId);
        const targetNode = this.graph.getNodeById(edge.targetId);
        if (!sourceNode || !targetNode) return;

        if (edge.isSelfLoop) {
            edge.loopAngle = Math.atan2(mousePosition.positionY - sourceNode.positionY, mousePosition.positionX - sourceNode.positionX);
        } else {
            const diffX = targetNode.positionX - sourceNode.positionX;
            const diffY = targetNode.positionY - sourceNode.positionY;
            const distance = Math.sqrt(diffX * diffX + diffY * diffY);
            if (distance > 0) {
                const dotProduct = (-diffY / distance) * (mousePosition.positionX - sourceNode.positionX) + (diffX / distance) * (mousePosition.positionY - sourceNode.positionY);
                let newCurveOffset = 2 * dotProduct;
                if (Math.abs(newCurveOffset) < 20) newCurveOffset = 0;
                edge.curveOffset = newCurveOffset;
            }
        }
        this.requestRender();
    }

    /**
     * @param {{positionX: number, positionY: number}} mousePosition
     */
    handleEdgeDrawMove(mousePosition) {
        const sourceNode = this.graph.getNodeById(this.edgeDraft.sourceNodeId);
        // The draft's source node may have been deleted after the draft started
        // (e.g. a properties-panel delete); cancel the draft instead of throwing
        // on every pointer move.
        if (!sourceNode) {
            this.edgeDraft.cancel();
            this.tempEdgePathElement.style.display = 'none';
            return;
        }
        this.tempEdgePathElement.style.display = 'block';
        const diffX = mousePosition.positionX - sourceNode.positionX;
        const diffY = mousePosition.positionY - sourceNode.positionY;
        const angle = Math.atan2(diffY, diffX);
        const startX = sourceNode.positionX + AutomatonNode.RADIUS * Math.cos(angle);
        const startY = sourceNode.positionY + AutomatonNode.RADIUS * Math.sin(angle);
        this.tempEdgePathElement.setAttribute('d', `M ${startX},${startY} L ${mousePosition.positionX},${mousePosition.positionY}`);
    }

    /**
     * @param {{positionX: number, positionY: number}} mousePosition
     */
    handleStartArrowDragMove(mousePosition) {
        const node = this.graph.getNodeById(this.draggedStartArrowNodeId);
        if (node) {
            node.startAngle = Math.atan2(mousePosition.positionY - node.positionY, mousePosition.positionX - node.positionX);
            this.requestRender();
        }
    }

    /**
     * @param {MouseEvent|TouchEvent} event
     */
    handleCanvasPointerUp(event) {
        if (this.isPinching && (!event.touches || event.touches.length < 2)) {
            this.isPinching = false;
            this.initialPinchDistance = null;
            this.lastPinchMidpoint = null;
            return;
        }
        if (this.isPanning) {
            this.isPanning = false;
            this.svgElement.style.cursor = 'crosshair';
            return;
        }

        this.isDraggingNode = false;
        this.draggedNodeId = null;
        this.isDraggingEdge = false;
        this.draggedEdgeId = null;
        this.isDraggingStartArrow = false;
        this.draggedStartArrowNodeId = null;

        if (this.edgeDraft.active) {
            this.edgeDraft.cancel();
            this.tempEdgePathElement.style.display = 'none';
        }

        if (this.isBoxSelecting) {
            this.isBoxSelecting = false;
            this.selectionBoxElement.classList.add('hidden');

            if (this.selectionModel.selectedNodeIds.size === 1) {
                this.selectionModel.selectedElement = { type: 'node', id: [...this.selectionModel.selectedNodeIds][0] };
            } else {
                this.selectionModel.selectedElement = null;
            }
        }

        this.activeGuides = [];
        this.requestRender();
    }

    /**
     * @param {MouseEvent|TouchEvent} event
     * @param {string} nodeId
     */
    handleNodeMouseDown(event, nodeId) {
        event.stopPropagation();
        this.focusCanvas();
        if (event.type !== 'touchstart' || event.cancelable) event.preventDefault();

        if (event.type === 'touchstart') {
            const currentTime = Date.now();
            const tapLength = currentTime - this.lastNodeTapTime;
            if (tapLength < 300 && tapLength > 0) {
                this.handleDoubleClick(event);
                this.lastNodeTapTime = 0;
                return;
            }
            this.lastNodeTapTime = currentTime;
        }

        if (event.shiftKey && !this.edgeDraft.active) {
            const node = this.graph.getNodeById(nodeId);
            if (node) {
                this.selectionModel.selectSingleNode(nodeId);
                this.openPropertiesPanel();

                this.edgeDraft.start(nodeId, 'pointer');
                this.awaitingDraftRelease = false;
                this.isDraggingNode = false;
                this.draggedNodeId = null;
                this.tempEdgePathElement.style.display = 'block';
                const position = GeometryUtils.getMousePosition(this.svgElement, event);
                this.tempEdgePathElement.setAttribute('d', `M ${node.positionX},${node.positionY} L ${position.positionX},${position.positionY}`);
            }
            return;
        }

        if (this.edgeDraft.active && this.edgeDraft.sourceNodeId) {
            this.lastNodeClick = null;
            this.handleNodeMouseUp(event, nodeId);
            return;
        }

        // The canvas re-renders on every press, which replaces the node's DOM element, so
        // the browser's own dblclick event never reaches a node. Detect it from timing instead.
        if (event.type === 'mousedown' && event.button === 0) {
            const now = Date.now();
            const isDoubleClick = this.lastNodeClick !== null
                && this.lastNodeClick.nodeId === nodeId
                && now - this.lastNodeClick.time < PointerController.DOUBLE_CLICK_MS;
            this.lastNodeClick = isDoubleClick ? null : { nodeId, time: now };
            if (isDoubleClick) {
                this.startEdgeDraftFromDoubleClick(event, nodeId);
                return;
            }
        }

        if (!this.selectionModel.hasNode(nodeId)) {
            this.selectionModel.selectSingleNode(nodeId);
        }
        this.selectionModel.selectedElement = { type: 'node', id: nodeId };
        this.openPropertiesPanel();

        this.isDraggingNode = true;
        this.draggedNodeId = nodeId;
        this.dragStartPosition = GeometryUtils.getMousePosition(this.svgElement, event);
        this.initialNodePositions.clear();
        this.selectionModel.selectedNodeIds.forEach(id => {
            const node = this.graph.getNodeById(id);
            if (node) this.initialNodePositions.set(id, { positionX: node.positionX, positionY: node.positionY });
        });

        this.requestRender();
    }

    /**
     * @param {MouseEvent|TouchEvent} event
     * @param {string} targetNodeId
     */
    handleNodeMouseUp(event, targetNodeId) {
        if (!this.edgeDraft.active || !this.edgeDraft.sourceNodeId) return;
        event.stopPropagation();

        let actualTargetId = targetNodeId;
        if (event.type === 'touchend' || event.type === 'touchcancel') {
            const touch = (event.changedTouches && event.changedTouches.length > 0) ? event.changedTouches[0] : null;
            if (touch) {
                const dropElement = document.elementFromPoint(touch.clientX, touch.clientY);
                const nodeGroup = dropElement ? dropElement.closest('.node') : null;
                actualTargetId = (nodeGroup && nodeGroup.dataset && nodeGroup.dataset.id) ? nodeGroup.dataset.id : null;
            } else {
                actualTargetId = null;
            }
        }

        const isReleaseOfStartingPress = this.awaitingDraftRelease && (event.type === 'mouseup' || event.type === 'touchend');
        this.awaitingDraftRelease = false;
        if (isReleaseOfStartingPress && actualTargetId === this.edgeDraft.sourceNodeId) {
            // Released on the source itself: keep drawing and wait for a click on the target.
            return;
        }

        if (actualTargetId) {
            const newEdge = this.graph.addEdge(this.edgeDraft.sourceNodeId, actualTargetId);
            this.selectionModel.selectEdge(newEdge.id);
            this.openPropertiesPanel();
        }

        this.edgeDraft.cancel();
        this.tempEdgePathElement.style.display = 'none';
        this.requestRender();
    }

    /**
     * @param {MouseEvent|TouchEvent} event
     * @param {string} edgeId
     */
    handleEdgeMouseDown(event, edgeId) {
        event.stopPropagation();
        this.focusCanvas();
        if (event.type !== 'touchstart' || event.cancelable) event.preventDefault();
        this.selectionModel.selectEdge(edgeId);
        this.openPropertiesPanel();
        this.isDraggingEdge = true;
        this.draggedEdgeId = edgeId;
        this.requestRender();
    }

    /**
     * @param {MouseEvent|TouchEvent} event
     * @param {string} nodeId
     */
    handleStartArrowMouseDown(event, nodeId) {
        event.stopPropagation();
        if (event.type !== 'touchstart' || event.cancelable) event.preventDefault();
        this.isDraggingStartArrow = true;
        this.draggedStartArrowNodeId = nodeId;
        this.selectionModel.selectSingleNode(nodeId);
        this.requestRender();
    }
}
