import { AutomatonNode } from '../core/AutomatonNode.js';
import { GeometryUtils } from '../geometry/GeometryUtils.js';

/**
 * Renders an AutomatonGraph's nodes, edges, and alignment guides onto the SVG canvas,
 * and wires the resulting DOM elements to a PointerController for interaction.
 */
export class CanvasRenderer {
    /**
     * @param {{nodesLayerElement: SVGGElement, edgesLayerElement: SVGGElement, guidesLayerElement: SVGGElement}} layers
     * @param {import('../core/AutomatonGraph.js').AutomatonGraph} graph
     * @param {import('../interaction/SelectionModel.js').SelectionModel} selectionModel
     * @param {import('../interaction/SelectionModel.js').EdgeDraftState} edgeDraft
     * @param {import('../interaction/PointerController.js').PointerController} pointerController
     */
    constructor(layers, graph, selectionModel, edgeDraft, pointerController) {
        this.nodesLayerElement = layers.nodesLayerElement;
        this.edgesLayerElement = layers.edgesLayerElement;
        this.guidesLayerElement = layers.guidesLayerElement;
        this.graph = graph;
        this.selectionModel = selectionModel;
        this.edgeDraft = edgeDraft;
        this.pointerController = pointerController;
    }

    /**
     * Re-renders every layer of the canvas from the current graph and selection state.
     */
    render() {
        this.renderNodes();
        this.renderEdges();
        this.renderGuides();
    }

    renderGuides() {
        this.guidesLayerElement.innerHTML = '';
        this.pointerController.activeGuides.forEach(guide => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('stroke', '#f59e0b');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('stroke-dasharray', '5,5');
            if (guide.type === 'v') {
                line.setAttribute('x1', guide.x);
                line.setAttribute('x2', guide.x);
                line.setAttribute('y1', -10000);
                line.setAttribute('y2', 10000);
            } else {
                line.setAttribute('y1', guide.y);
                line.setAttribute('y2', guide.y);
                line.setAttribute('x1', -10000);
                line.setAttribute('x2', 10000);
            }
            this.guidesLayerElement.appendChild(line);
        });
    }

    /**
     * @param {AutomatonNode} node
     * @returns {SVGPathElement[]} The visible start-arrow chevron and its wider invisible drag hitbox.
     */
    createStartArrowElements(node) {
        const angle = node.startAngle;
        const tipX = AutomatonNode.RADIUS * Math.cos(angle);
        const tipY = AutomatonNode.RADIUS * Math.sin(angle);
        const tailX = (AutomatonNode.RADIUS + 40) * Math.cos(angle);
        const tailY = (AutomatonNode.RADIUS + 40) * Math.sin(angle);
        const pathData = `M ${tailX},${tailY} L ${tipX},${tipY}`;

        const startArrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        startArrow.setAttribute('class', 'start-arrow');
        startArrow.setAttribute('d', pathData);

        const arrowHitbox = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrowHitbox.setAttribute('d', pathData);
        arrowHitbox.setAttribute('stroke', 'transparent');
        arrowHitbox.setAttribute('stroke-width', '25');
        arrowHitbox.setAttribute('fill', 'none');
        arrowHitbox.style.cursor = 'pointer';
        arrowHitbox.addEventListener('mousedown', event => this.pointerController.handleStartArrowMouseDown(event, node.id));
        arrowHitbox.addEventListener('touchstart', event => this.pointerController.handleStartArrowMouseDown(event, node.id), { passive: false });

        return [startArrow, arrowHitbox];
    }

    /**
     * @param {AutomatonNode} node
     * @returns {SVGForeignObjectElement} The KaTeX-rendered, auto-scaled label for a node.
     */
    createNodeLabelElement(node) {
        const size = 100;
        const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        foreignObject.setAttribute('x', -size / 2);
        foreignObject.setAttribute('y', -size / 2);
        foreignObject.setAttribute('width', size);
        foreignObject.setAttribute('height', size);
        foreignObject.style.pointerEvents = 'none';

        const container = document.createElement('div');
        container.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.className = 'katex-container';

        const textWrapper = document.createElement('div');
        textWrapper.style.display = 'inline-block';
        textWrapper.style.whiteSpace = 'nowrap';
        textWrapper.style.transformOrigin = 'center center';
        textWrapper.innerHTML = GeometryUtils.renderKatex(node.name);

        container.appendChild(textWrapper);
        foreignObject.appendChild(container);
        return foreignObject;
    }

    /**
     * Shrinks a just-attached node label to fit inside its node circle, if it overflows.
     * @param {AutomatonNode} node
     * @param {HTMLElement} textWrapper
     */
    fitNodeLabel(node, textWrapper) {
        const innerRadius = node.isAccept ? AutomatonNode.RADIUS - 8 : AutomatonNode.RADIUS - 4;
        const maxFit = innerRadius * 1.5;
        const elementWidth = textWrapper.scrollWidth;
        const elementHeight = textWrapper.scrollHeight;
        if (elementWidth > maxFit || elementHeight > maxFit) {
            const scaleFactor = Math.min(maxFit / elementWidth, maxFit / elementHeight);
            textWrapper.style.transform = `scale(${scaleFactor})`;
        }
    }

    /**
     * @param {AutomatonNode} node
     * @returns {SVGGElement} The complete, event-wired group element for a node.
     */
    createNodeElement(node) {
        const isSelected = this.selectionModel.hasNode(node.id);
        const isDrawingLineFromHere = this.edgeDraft.active && this.edgeDraft.sourceNodeId === node.id;

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `node ${isSelected ? 'selected' : ''} ${isDrawingLineFromHere ? 'drawing-edge' : ''}`);
        group.setAttribute('transform', `translate(${node.positionX}, ${node.positionY})`);
        group.dataset.id = node.id;

        if (node.isStart) {
            this.createStartArrowElements(node).forEach(element => group.appendChild(element));
        }

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'node-circle');
        circle.setAttribute('r', AutomatonNode.RADIUS);
        group.appendChild(circle);

        if (node.isAccept) {
            const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            innerCircle.setAttribute('class', 'accept-circle');
            innerCircle.setAttribute('r', AutomatonNode.RADIUS - 6);
            group.appendChild(innerCircle);
        }

        group.appendChild(this.createNodeLabelElement(node));

        group.addEventListener('mousedown', event => this.pointerController.handleNodeMouseDown(event, node.id));
        group.addEventListener('mouseup', event => this.pointerController.handleNodeMouseUp(event, node.id));
        group.addEventListener('touchstart', event => this.pointerController.handleNodeMouseDown(event, node.id), { passive: false });
        group.addEventListener('touchend', event => this.pointerController.handleNodeMouseUp(event, node.id));
        group.addEventListener('touchcancel', event => this.pointerController.handleNodeMouseUp(event, node.id));

        return group;
    }

    renderNodes() {
        this.nodesLayerElement.innerHTML = '';
        this.graph.nodes.forEach(node => {
            const group = this.createNodeElement(node);
            this.nodesLayerElement.appendChild(group);
            this.fitNodeLabel(node, group.querySelector('.katex-container > div'));
        });
    }

    /**
     * @param {import('../core/AutomatonEdge.js').AutomatonEdge} edge
     * @param {boolean} isSelected
     * @param {number} labelPositionX
     * @param {number} labelPositionY
     * @returns {SVGForeignObjectElement} The KaTeX-rendered, draggable label for an edge.
     */
    createEdgeLabelElement(edge, isSelected, labelPositionX, labelPositionY) {
        const sizeX = 300;
        const sizeY = 200;
        const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        foreignObject.setAttribute('x', labelPositionX - sizeX / 2);
        foreignObject.setAttribute('y', labelPositionY - sizeY / 2);
        foreignObject.setAttribute('width', sizeX);
        foreignObject.setAttribute('height', sizeY);
        foreignObject.style.pointerEvents = 'none';

        const container = document.createElement('div');
        container.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';

        const labelBackground = document.createElement('div');
        labelBackground.style.padding = '2px 8px';
        labelBackground.style.pointerEvents = 'auto';
        labelBackground.style.cursor = 'pointer';
        labelBackground.style.textAlign = 'center';
        labelBackground.style.background = 'transparent';
        labelBackground.style.color = isSelected ? '#2563eb' : '#333';
        labelBackground.style.textShadow = '0px 0px 4px rgba(255,255,255,0.9), 0px 0px 4px rgba(255,255,255,0.9)';

        labelBackground.innerHTML = edge.label.split('\n').map(line => GeometryUtils.renderKatex(line)).join('<br/>');
        labelBackground.addEventListener('mousedown', event => this.pointerController.handleEdgeMouseDown(event, edge.id));
        labelBackground.addEventListener('touchstart', event => this.pointerController.handleEdgeMouseDown(event, edge.id), { passive: false });

        container.appendChild(labelBackground);
        foreignObject.appendChild(container);
        return foreignObject;
    }

    /**
     * @param {import('../core/AutomatonEdge.js').AutomatonEdge} edge
     * @param {AutomatonNode} sourceNode
     * @param {AutomatonNode} targetNode
     * @returns {SVGGElement} The complete, event-wired group element for an edge.
     */
    createEdgeElement(edge, sourceNode, targetNode) {
        const isSelected = this.selectionModel.selectedElement?.type === 'edge' && this.selectionModel.selectedElement.id === edge.id;
        const { pathData, labelPositionX, labelPositionY } = GeometryUtils.computeEdgePathAndLabelPosition(edge, sourceNode, targetNode);

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `edge ${isSelected ? 'selected' : ''}`);
        group.dataset.id = edge.id;
        group.dataset.labelX = labelPositionX;
        group.dataset.labelY = labelPositionY;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'edge-path');
        path.setAttribute('d', pathData);
        group.appendChild(path);

        const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitbox.setAttribute('d', pathData);
        hitbox.setAttribute('stroke', 'transparent');
        hitbox.setAttribute('stroke-width', '25');
        hitbox.setAttribute('fill', 'none');
        hitbox.style.cursor = 'pointer';
        group.appendChild(hitbox);

        group.appendChild(this.createEdgeLabelElement(edge, isSelected, labelPositionX, labelPositionY));

        path.addEventListener('mousedown', event => this.pointerController.handleEdgeMouseDown(event, edge.id));
        hitbox.addEventListener('mousedown', event => this.pointerController.handleEdgeMouseDown(event, edge.id));
        path.addEventListener('touchstart', event => this.pointerController.handleEdgeMouseDown(event, edge.id), { passive: false });
        hitbox.addEventListener('touchstart', event => this.pointerController.handleEdgeMouseDown(event, edge.id), { passive: false });

        return group;
    }

    renderEdges() {
        this.edgesLayerElement.innerHTML = '';
        this.graph.edges.forEach(edge => {
            const sourceNode = this.graph.getNodeById(edge.sourceId);
            const targetNode = this.graph.getNodeById(edge.targetId);
            if (!sourceNode || !targetNode) return;
            this.edgesLayerElement.appendChild(this.createEdgeElement(edge, sourceNode, targetNode));
        });
    }
}
