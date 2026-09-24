import { GeometryUtils } from '../geometry/GeometryUtils.js';

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
     * @param {HTMLElement} [elements.nodeNamePreview] Rendered preview of the state name.
     * @param {HTMLElement} [elements.nodeNameError] Plain-language LaTeX error for the state name.
     * @param {HTMLElement} [elements.edgeLabelPreview] Rendered preview of the transition label.
     * @param {HTMLElement} [elements.edgeLabelError] Plain-language LaTeX error for the transition label.
     * @param {HTMLButtonElement} [elements.insertEpsilonButton] Inserts \epsilon into the transition label.
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
            this.updateLatexFeedback(node.name, this.nodeNameInput, this.nodeNamePreview, this.nodeNameError);
        } else {
            const edge = this.graph.getEdgeById(this.selectionModel.selectedElement.id);
            if (!edge) return;
            this.titleElement.textContent = 'Edge Properties';
            this.nodePropsElement.style.display = 'none';
            this.edgePropsElement.style.display = 'block';
            this.edgeLabelInput.value = edge.label;
            this.updateLatexFeedback(edge.label, this.edgeLabelInput, this.edgeLabelPreview, this.edgeLabelError);
        }
    }

    /**
     * Shows a rendered preview of a label and, when it is not valid LaTeX, a short
     * explanation under the field - instead of only red raw text on the canvas.
     * @param {string} text
     * @param {HTMLInputElement|HTMLTextAreaElement} inputElement
     * @param {HTMLElement|undefined} previewElement
     * @param {HTMLElement|undefined} errorElement
     */
    updateLatexFeedback(text, inputElement, previewElement, errorElement) {
        const error = GeometryUtils.getLatexError(text);
        if (errorElement) {
            errorElement.textContent = error ?? '';
            errorElement.classList.toggle('hidden', !error);
        }
        if (error) {
            inputElement.setAttribute('aria-invalid', 'true');
            if (errorElement?.id) inputElement.setAttribute('aria-describedby', errorElement.id);
        } else {
            inputElement.removeAttribute('aria-invalid');
            inputElement.removeAttribute('aria-describedby');
        }
        if (previewElement) {
            const showPreview = Boolean(text) && !error;
            previewElement.innerHTML = showPreview
                ? text.split('\n').map(line => GeometryUtils.renderKatex(line)).join('<br/>')
                : '';
            previewElement.parentElement?.classList.toggle('hidden', !showPreview);
        }
    }

    bindInputListeners() {
        this.nodeNameInput.addEventListener('input', event => {
            if (this.selectionModel.selectedElement?.type !== 'node') return;
            const node = this.graph.getNodeById(this.selectionModel.selectedElement.id);
            if (node) {
                node.name = event.target.value;
                this.updateLatexFeedback(node.name, this.nodeNameInput, this.nodeNamePreview, this.nodeNameError);
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
                this.updateLatexFeedback(edge.label, this.edgeLabelInput, this.edgeLabelPreview, this.edgeLabelError);
                this.requestRender();
            }
        });

        this.insertEpsilonButton?.addEventListener('click', () => this.insertIntoEdgeLabel('\\epsilon'));

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

    /**
     * Inserts text at the cursor in the transition label, as if the user had typed it.
     * @param {string} text
     */
    insertIntoEdgeLabel(text) {
        const input = this.edgeLabelInput;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        input.value = input.value.slice(0, start) + text + input.value.slice(end);
        input.focus();
        input.setSelectionRange(start + text.length, start + text.length);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
}
