import { AutomatonGraph } from './core/AutomatonGraph.js';
import { AutomatonNode } from './core/AutomatonNode.js';
import { SelectionModel, EdgeDraftState } from './interaction/SelectionModel.js';
import { CameraController } from './interaction/CameraController.js';
import { PointerController } from './interaction/PointerController.js';
import { KeyboardController } from './interaction/KeyboardController.js';
import { CanvasRenderer } from './rendering/CanvasRenderer.js';
import { PropertiesPanel } from './ui/PropertiesPanel.js';
import { ProjectFile, DiagramExporter } from './io/ProjectIO.js';

/**
 * The composition root: wires every model, controller, and view together into
 * a running Automata Editor instance, and owns the top-level render loop.
 */
export class AutomataEditorApp {
    static EXAMPLE_START_X = 350;
    static EXAMPLE_START_Y = 300;
    static EXAMPLE_ACCEPT_X = 650;
    static EXAMPLE_ACCEPT_Y = 300;
    static WIDE_ASPECT_RATIO = 16 / 9;
    static TALL_ASPECT_RATIO = 3 / 4;
    static MOBILE_BREAKPOINT_PX = 640;

    /**
     * @param {Document} document
     */
    constructor(document) {
        this.dom = this.queryElements(document);

        this.graph = new AutomatonGraph();
        this.selectionModel = new SelectionModel();
        this.edgeDraft = new EdgeDraftState();
        this.camera = new CameraController(this.dom.svgElement, this.dom.zoomDisplayElement);

        this.pointerController = new PointerController({
            svgElement: this.dom.svgElement,
            tempEdgePathElement: this.dom.tempEdgePathElement,
            selectionBoxElement: this.dom.selectionBoxElement,
            graph: this.graph,
            selectionModel: this.selectionModel,
            cameraController: this.camera,
            edgeDraft: this.edgeDraft,
            requestRender: () => this.render(),
            openPropertiesPanel: () => this.propertiesPanel.open(),
            closePropertiesPanel: () => this.propertiesPanel.close()
        });

        this.canvasRenderer = new CanvasRenderer(
            {
                nodesLayerElement: this.dom.nodesLayerElement,
                edgesLayerElement: this.dom.edgesLayerElement,
                guidesLayerElement: this.dom.guidesLayerElement
            },
            this.graph,
            this.selectionModel,
            this.edgeDraft,
            this.pointerController
        );

        this.propertiesPanel = new PropertiesPanel(
            {
                panelElement: this.dom.propertiesPanelElement,
                titleElement: this.dom.panelTitleElement,
                nodePropsElement: this.dom.nodePropsElement,
                edgePropsElement: this.dom.edgePropsElement,
                nodeNameInput: this.dom.nodeNameInput,
                nodeIsStartCheckbox: this.dom.nodeIsStartCheckbox,
                nodeIsAcceptCheckbox: this.dom.nodeIsAcceptCheckbox,
                edgeLabelInput: this.dom.edgeLabelInput,
                deleteNodeButton: this.dom.deleteNodeButton,
                deleteEdgeButton: this.dom.deleteEdgeButton
            },
            this.graph,
            this.selectionModel,
            () => this.render(),
            () => {
                this.applyCanvasLetterboxSizing();
                this.camera.updateViewBox();
            }
        );

        this.keyboardController = new KeyboardController({
            graph: this.graph,
            selectionModel: this.selectionModel,
            cameraController: this.camera,
            edgeDraft: this.edgeDraft,
            tempEdgePathElement: this.dom.tempEdgePathElement,
            requestRender: () => this.render(),
            openPropertiesPanel: () => this.propertiesPanel.open(),
            closePropertiesPanel: () => this.propertiesPanel.close(),
            announce: message => this.announce(message)
        });

        this.bindToolbar();
        this.applyCanvasLetterboxSizing();
        window.addEventListener('resize', () => {
            this.applyCanvasLetterboxSizing();
            this.camera.updateViewBox();
        });

        this.seedExampleDiagram();
    }

    /**
     * Picks a canvas aspect ratio suited to the viewport's own shape: a
     * conventional widescreen ratio for landscape-leaning viewports, and a
     * taller, portrait-friendly ratio for "long" viewports (portrait phones
     * and tablets), where a 16:9 box would letterbox down to a thin strip.
     * @returns {number}
     */
    getCanvasAspectRatio() {
        const isLongScreen = window.innerHeight > window.innerWidth;
        return isLongScreen ? AutomataEditorApp.TALL_ASPECT_RATIO : AutomataEditorApp.WIDE_ASPECT_RATIO;
    }

    /**
     * Sizes the canvas container to the largest box that fits its parent while
     * holding the current canvas aspect ratio exactly, letterboxing rather than
     * stretching it. A CSS aspect-ratio utility alone cannot guarantee this: when
     * both the width and height end up independently constrained (as happens on
     * very narrow or very short viewports), the two dimensions stop reconciling
     * to the ratio.
     *
     * Below MOBILE_BREAKPOINT_PX the properties panel sits in normal document
     * flow beneath the canvas instead of overlaying it, so its rendered height
     * is subtracted from the space available to the canvas here.
     */
    applyCanvasLetterboxSizing() {
        const parent = this.dom.canvasContainerElement.parentElement;
        const availableWidth = parent.clientWidth;
        let availableHeight = parent.clientHeight;

        const isMobileLayout = window.innerWidth < AutomataEditorApp.MOBILE_BREAKPOINT_PX;
        if (isMobileLayout && this.dom.propertiesPanelElement.style.display === 'block') {
            const gapPx = parseFloat(getComputedStyle(parent).rowGap) || 0;
            availableHeight -= this.dom.propertiesPanelElement.offsetHeight + gapPx;
        }
        if (availableWidth <= 0 || availableHeight <= 0) return;

        const aspectRatio = this.getCanvasAspectRatio();
        let width = availableWidth;
        let height = width / aspectRatio;
        if (height > availableHeight) {
            height = availableHeight;
            width = height * aspectRatio;
        }

        this.dom.canvasContainerElement.style.width = `${width}px`;
        this.dom.canvasContainerElement.style.height = `${height}px`;
    }

    /**
     * @param {Document} document
     * @returns {Object<string, Element>} Every DOM element the app needs, by role.
     */
    queryElements(document) {
        return {
            canvasContainerElement: document.getElementById('canvas-container'),
            svgElement: document.getElementById('automaton-canvas'),
            zoomDisplayElement: document.getElementById('zoom-level-display'),
            selectionBoxElement: document.getElementById('selection-box'),
            guidesLayerElement: document.getElementById('guides-layer'),
            nodesLayerElement: document.getElementById('nodes-layer'),
            edgesLayerElement: document.getElementById('edges-layer'),
            tempEdgePathElement: document.getElementById('temp-edge'),
            propertiesPanelElement: document.getElementById('properties-panel'),
            panelTitleElement: document.getElementById('panel-title'),
            nodePropsElement: document.getElementById('node-props'),
            edgePropsElement: document.getElementById('edge-props'),
            nodeNameInput: document.getElementById('node-name-input'),
            nodeIsStartCheckbox: document.getElementById('node-is-start'),
            nodeIsAcceptCheckbox: document.getElementById('node-is-accept'),
            edgeLabelInput: document.getElementById('edge-label-input'),
            deleteNodeButton: document.getElementById('delete-node-button'),
            deleteEdgeButton: document.getElementById('delete-edge-button'),
            a11yStatusElement: document.getElementById('a11y-status'),
            loadFileInput: document.getElementById('load-file-input'),
            loadButton: document.getElementById('load-button'),
            saveButton: document.getElementById('save-button'),
            exportSvgButton: document.getElementById('export-svg-button'),
            exportTikzButton: document.getElementById('export-tikz-button'),
            zoomOutButton: document.getElementById('zoom-out-button'),
            zoomInButton: document.getElementById('zoom-in-button')
        };
    }

    bindToolbar() {
        this.dom.loadButton.addEventListener('click', () => this.dom.loadFileInput.click());
        this.dom.loadFileInput.addEventListener('change', event => this.handleLoadFile(event));
        this.dom.saveButton.addEventListener('click', () => ProjectFile.save(this.graph, this.camera));
        this.dom.exportSvgButton.addEventListener('click', () => DiagramExporter.downloadSvg(this.graph, this.dom.svgElement));
        this.dom.exportTikzButton.addEventListener('click', () => DiagramExporter.downloadTikz(this.graph));
        this.dom.zoomOutButton.addEventListener('click', () => this.camera.changeZoom(-0.1));
        this.dom.zoomInButton.addEventListener('click', () => this.camera.changeZoom(0.1));
    }

    /**
     * @param {Event} event
     */
    async handleLoadFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const result = await ProjectFile.load(file);
            this.graph.replaceWith(result.graph);
            this.selectionModel.clear();
            this.edgeDraft.cancel();
            this.camera.restore(result.panPositionX, result.panPositionY, result.zoom);
            this.render();

            if (result.droppedCount > 0) {
                const entryWord = result.droppedCount === 1 ? 'entry' : 'entries';
                alert(`Loaded with ${result.droppedCount} invalid node/edge ${entryWord} skipped.`);
            }
        } catch (error) {
            alert(error.message);
        } finally {
            event.target.value = '';
        }
    }

    /**
     * @param {string} message
     */
    announce(message) {
        if (this.dom.a11yStatusElement) this.dom.a11yStatusElement.textContent = message;
    }

    render() {
        this.canvasRenderer.render();
        this.propertiesPanel.refresh();
    }

    seedExampleDiagram() {
        const startNode = this.graph.addNode(AutomataEditorApp.EXAMPLE_START_X, AutomataEditorApp.EXAMPLE_START_Y);
        startNode.isStart = true;
        const acceptNode = this.graph.addNode(AutomataEditorApp.EXAMPLE_ACCEPT_X, AutomataEditorApp.EXAMPLE_ACCEPT_Y);
        acceptNode.isAccept = true;
        this.graph.addEdge(startNode.id, acceptNode.id, 'a');

        this.render();
        this.fitCameraToSeedDiagram();
        window.setTimeout(() => this.fitCameraToSeedDiagram(), 100);
    }

    /**
     * Fits the camera to the seed diagram's bounds so it stays fully visible
     * even on narrow or portrait canvases, instead of a fixed 100% zoom that
     * can clip its nodes off-screen.
     */
    fitCameraToSeedDiagram() {
        const bounds = {
            minX: AutomataEditorApp.EXAMPLE_START_X - AutomatonNode.RADIUS,
            maxX: AutomataEditorApp.EXAMPLE_ACCEPT_X + AutomatonNode.RADIUS,
            minY: AutomataEditorApp.EXAMPLE_START_Y - AutomatonNode.RADIUS,
            maxY: AutomataEditorApp.EXAMPLE_ACCEPT_Y + AutomatonNode.RADIUS
        };
        this.camera.fitToContent(bounds, this.dom.svgElement.clientWidth, this.dom.svgElement.clientHeight);
    }
}
