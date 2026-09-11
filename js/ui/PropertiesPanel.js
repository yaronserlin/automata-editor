/**
 * Shows and edits the properties of whichever single node or edge is selected,
 * and wires the panel's inputs and delete buttons back into the graph.
 */
export class PropertiesPanel {
    /**
     * @param {Object} elements
     * @param {HTMLElement} elements.panelElement
     * @param {HTMLElement} elements.titleElement
     * @param {HTMLElement} elements.nodePropsElement
     * @param {HTMLElement} elements.edgePropsElement
     * @param {HTMLInputElement} elements.nodeNameInput
     * @param {HTMLInputElement} elements.nodeIsStartCheckbox
     * @param {HTMLInputElement} elements.nodeIsAcceptCheckbox
     * @param {HTMLTextAreaElement} elements.edgeLabelInput
     * @param {HTMLButtonElement} elements.deleteNodeButton
     * @param {HTMLButtonElement} elements.deleteEdgeButton
     * @param {import('../core/AutomatonGraph.js').AutomatonGraph} graph
     * @param {import('../interaction/SelectionModel.js').SelectionModel} selectionModel
     * @param {() => void} requestRender
     * @param {() => void} [onVisibilityChange] Called whenever the panel actually
     *   toggles open/closed, so a layout that reserves space for the panel (rather
     *   than overlaying it) can re-measure.
     */
    constructor(elements, graph, selectionModel, requestRender, onVisibilityChange = () => {}) {
        Object.assign(this, elements);
        this.graph = graph;
        this.selectionModel = selectionModel;
        this.requestRender = requestRender;
        this.onVisibilityChange = onVisibilityChange;

        this.bindInputListeners();
    }

    /**
     * @param {boolean} visible
     */
    setVisible(visible) {
        const isCurrentlyVisible = this.panelElement.style.display === 'block';
        if (isCurrentlyVisible === visible) return;
        this.panelElement.style.display = visible ? 'block' : 'none';
        this.onVisibilityChange();
    }

    open() {
        this.setVisible(true);
        this.refresh();
    }

    close() {
        this.setVisible(false);
    }

    refresh() {
        if (!this.selectionModel.selectedElement || this.selectionModel.isMultiNodeSelection) {
            this.setVisible(false);
            return;
        }
        if (this.panelElement.style.display !== 'block') return;

        if (this.selectionModel.selectedElement.type === 'node') {
            const node = this.graph.getNodeById(this.selectionModel.selectedElement.id);
            if (!node) return;
            this.titleElement.textContent = 'Node Properties';
            this.nodePropsElement.style.display = 'block';
            this.edgePropsElement.style.display = 'none';
            this.nodeNameInput.value = node.name;
            this.nodeIsStartCheckbox.checked = node.isStart;
            this.nodeIsAcceptCheckbox.checked = node.isAccept;
        } else {
            const edge = this.graph.getEdgeById(this.selectionModel.selectedElement.id);
            if (!edge) return;
            this.titleElement.textContent = 'Edge Properties';
            this.nodePropsElement.style.display = 'none';
            this.edgePropsElement.style.display = 'block';
            this.edgeLabelInput.value = edge.label;
        }
    }

    bindInputListeners() {
        this.nodeNameInput.addEventListener('input', event => {
            if (this.selectionModel.selectedElement?.type !== 'node') return;
            const node = this.graph.getNodeById(this.selectionModel.selectedElement.id);
            if (node) {
                node.name = event.target.value;
                this.requestRender();
            }
        });

        this.nodeIsStartCheckbox.addEventListener('change', event => {
            if (this.selectionModel.selectedElement?.type !== 'node') return;
            const node = this.graph.getNodeById(this.selectionModel.selectedElement.id);
            if (node) {
                node.isStart = event.target.checked;
                this.requestRender();
            }
        });

        this.nodeIsAcceptCheckbox.addEventListener('change', event => {
            if (this.selectionModel.selectedElement?.type !== 'node') return;
            const node = this.graph.getNodeById(this.selectionModel.selectedElement.id);
            if (node) {
                node.isAccept = event.target.checked;
                this.requestRender();
            }
        });

        this.edgeLabelInput.addEventListener('input', event => {
            if (this.selectionModel.selectedElement?.type !== 'edge') return;
            const edge = this.graph.getEdgeById(this.selectionModel.selectedElement.id);
            if (edge) {
                edge.label = event.target.value;
                this.requestRender();
            }
        });

        this.deleteNodeButton.addEventListener('click', () => {
            if (this.selectionModel.selectedElement?.type !== 'node') return;
            this.graph.deleteNode(this.selectionModel.selectedElement.id);
            this.selectionModel.clear();
            this.requestRender();
        });

        this.deleteEdgeButton.addEventListener('click', () => {
            if (this.selectionModel.selectedElement?.type !== 'edge') return;
            this.graph.deleteEdge(this.selectionModel.selectedElement.id);
            this.selectionModel.clear();
            this.requestRender();
        });
    }
}
