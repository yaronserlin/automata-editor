import { AutomatonGraph } from './core/AutomatonGraph.js';
import { AutomatonNode } from './core/AutomatonNode.js';
import { GeometryUtils } from './geometry/GeometryUtils.js';
import { SelectionModel, EdgeDraftState } from './interaction/SelectionModel.js';
import { CameraController } from './interaction/CameraController.js';
import { PointerController } from './interaction/PointerController.js';
import { KeyboardController } from './interaction/KeyboardController.js';
import { CanvasRenderer } from './rendering/CanvasRenderer.js';
import { PropertiesPanel } from './ui/PropertiesPanel.js';
import { ProjectFile, DiagramExporter } from './io/ProjectIO.js';
import { AutosaveStore } from './io/AutosaveStore.js';
import { HistoryManager } from './core/HistoryManager.js';
import { SimulationPanel } from './ui/SimulationPanel.js';
import { ToastManager } from './ui/ToastManager.js';
import { OnboardingHint } from './ui/OnboardingHint.js';

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
    static MIN_MOBILE_CANVAS_HEIGHT_PX = 220;
    /** @type {number} Quiet period before a change is recorded, so typing or nudging groups into one undo step. */
    static COMMIT_DELAY_MS = 350;

    /**
     * @param {Document} document
     */
    constructor(document) {
        this.dom = this.queryElements(document);

        this.graph = new AutomatonGraph();
        this.history = new HistoryManager();
        this.autosave = new AutosaveStore();
        this.toasts = new ToastManager(this.dom.toastContainerElement);
        this.pendingCommitTimerId = null;
        this.isRestoringHistory = false;
        /** Whether the diagram has changed since it was last saved to or loaded from a file. */
        this.hasUnsavedFileChanges = false;
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
            this.pointerController,
            () => this.simulationPanel?.getHighlight() ?? null
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
                deleteEdgeButton: this.dom.deleteEdgeButton,
                nodeNamePreview: this.dom.nodeNamePreview,
                nodeNameError: this.dom.nodeNameError,
                edgeLabelPreview: this.dom.edgeLabelPreview,
                edgeLabelError: this.dom.edgeLabelError,
                insertEpsilonButton: this.dom.insertEpsilonButton
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
            announce: message => this.announce(message),
            undo: () => this.undo(),
            redo: () => this.redo(),
            onDeleted: description => this.toasts.show(description, {
                action: { label: 'Undo', onClick: () => this.undo() }
            })
        });

        this.onboardingHint = new OnboardingHint(
            {
                hintElement: this.dom.onboardingHintElement,
                textElement: this.dom.onboardingHintTextElement,
                dismissButton: this.dom.onboardingDismissButton,
                helpButton: this.dom.onboardingHelpButton
            },
            () => this.openHelp()
        );

        this.simulationPanel = new SimulationPanel(
            {
                inputElement: this.dom.simInput,
                runButton: this.dom.simRunButton,
                stepBackButton: this.dom.simStepBackButton,
                playButton: this.dom.simPlayButton,
                stepForwardButton: this.dom.simStepForwardButton,
                resetButton: this.dom.simResetButton,
                tapeElement: this.dom.simTape,
                statusElement: this.dom.simStatus,
                typeBadgeElement: this.dom.simTypeBadge
            },
            this.graph,
            () => this.render(),
            message => this.announce(message),
            () => this.onboardingHint.observeSimulationRun()
        );

        this.bindToolbar();
        this.bindHelpDialog();
        this.bindUnloadWarning();
        this.applyCanvasLetterboxSizing();
        window.addEventListener('resize', () => {
            this.applyCanvasLetterboxSizing();
            this.camera.updateViewBox();
        });
        // The simulation result row and the mobile properties panel change the space left
        // for the canvas without a window resize, so watch the canvas area itself too.
        if (typeof ResizeObserver === 'function') {
            new ResizeObserver(() => {
                this.applyCanvasLetterboxSizing();
                this.camera.updateViewBox();
            }).observe(this.dom.canvasContainerElement.parentElement);
        }

        if (!this.restoreAutosave()) this.seedExampleDiagram();
        this.history.reset(this.graph.toSnapshot());
        this.simulationPanel.invalidate();
        this.updateUndoButtons();
        this.onboardingHint.start(this.diagramCounts);
    }

    /** @returns {{nodes: number, edges: number}} */
    get diagramCounts() {
        return { nodes: this.graph.nodes.length, edges: this.graph.edges.length };
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

        if (isMobileLayout) {
            // On phones every pixel counts: fill the free space instead of letterboxing,
            // which left large empty bands above and below the canvas.
            this.dom.canvasContainerElement.style.width = `${availableWidth}px`;
            this.dom.canvasContainerElement.style.height = `${Math.max(availableHeight, AutomataEditorApp.MIN_MOBILE_CANVAS_HEIGHT_PX)}px`;
            return;
        }

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
            zoomInButton: document.getElementById('zoom-in-button'),
            undoButton: document.getElementById('undo-button'),
            redoButton: document.getElementById('redo-button'),
            helpButton: document.getElementById('help-button'),
            helpDialog: document.getElementById('help-dialog'),
            helpCloseButton: document.getElementById('help-close-button'),
            toastContainerElement: document.getElementById('toast-container'),
            onboardingHintElement: document.getElementById('onboarding-hint'),
            onboardingHintTextElement: document.getElementById('onboarding-hint-text'),
            onboardingDismissButton: document.getElementById('onboarding-dismiss-button'),
            onboardingHelpButton: document.getElementById('onboarding-help-button'),
            edgeDraftBannerElement: document.getElementById('edge-draft-banner'),
            nodeNamePreview: document.getElementById('node-name-preview'),
            nodeNameError: document.getElementById('node-name-error'),
            edgeLabelPreview: document.getElementById('edge-label-preview'),
            edgeLabelError: document.getElementById('edge-label-error'),
            insertEpsilonButton: document.getElementById('insert-epsilon-button'),
            simInput: document.getElementById('sim-input'),
            simRunButton: document.getElementById('sim-run-button'),
            simStepBackButton: document.getElementById('sim-step-back-button'),
            simPlayButton: document.getElementById('sim-play-button'),
            simStepForwardButton: document.getElementById('sim-step-forward-button'),
            simResetButton: document.getElementById('sim-reset-button'),
            simTape: document.getElementById('sim-tape'),
            simStatus: document.getElementById('sim-status'),
            simTypeBadge: document.getElementById('sim-type-badge')
        };
    }

    bindToolbar() {
        this.dom.loadButton.addEventListener('click', () => this.dom.loadFileInput.click());
        this.dom.loadFileInput.addEventListener('change', event => this.handleLoadFile(event));
        this.dom.saveButton.addEventListener('click', () => this.saveProjectFile());
        this.dom.exportSvgButton.addEventListener('click', () => {
            try {
                DiagramExporter.downloadSvg(this.graph, this.dom.svgElement);
            } catch (error) {
                this.toasts.show(`Couldn't export the SVG: ${error.message}`, { type: 'error' });
            }
        });
        this.dom.exportTikzButton.addEventListener('click', () => {
            try {
                DiagramExporter.downloadTikz(this.graph);
            } catch (error) {
                this.toasts.show(`Couldn't export the LaTeX: ${error.message}`, { type: 'error' });
            }
        });
        this.dom.zoomOutButton.addEventListener('click', () => this.camera.changeZoom(-0.1));
        this.dom.zoomInButton.addEventListener('click', () => this.camera.changeZoom(0.1));
        this.dom.undoButton.addEventListener('click', () => this.undo());
        this.dom.redoButton.addEventListener('click', () => this.redo());
    }

    bindHelpDialog() {
        this.dom.helpButton.addEventListener('click', () => this.openHelp());
        this.dom.helpCloseButton.addEventListener('click', () => this.dom.helpDialog.close());
        // Clicking the dimmed backdrop (outside the dialog box) closes it too.
        this.dom.helpDialog.addEventListener('click', event => {
            if (event.target === this.dom.helpDialog) this.dom.helpDialog.close();
        });
    }

    openHelp() {
        if (typeof this.dom.helpDialog.showModal === 'function') {
            if (!this.dom.helpDialog.open) this.dom.helpDialog.showModal();
        } else {
            this.dom.helpDialog.setAttribute('open', '');
        }
    }

    /**
     * Autosave already protects against losing work on refresh, but a project that was
     * never saved to a file only lives in this browser - so leaving the page with
     * unsaved-to-file changes still asks for confirmation.
     */
    bindUnloadWarning() {
        window.addEventListener('beforeunload', event => {
            this.flushPendingCommit();
            if (!this.hasUnsavedFileChanges) return;
            event.preventDefault();
            event.returnValue = '';
        });
    }

    saveProjectFile() {
        this.flushPendingCommit();
        ProjectFile.save(this.graph, this.camera);
        this.hasUnsavedFileChanges = false;
        this.toasts.show('Saved as automata_project.json', { type: 'success' });
        this.announce('Project saved');
    }

    /**
     * @param {Event} event
     */
    async handleLoadFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const result = await ProjectFile.load(file);
            this.flushPendingCommit();
            this.graph.replaceWith(result.graph);
            this.selectionModel.clear();
            this.edgeDraft.cancel();
            this.camera.restore(result.panPositionX, result.panPositionY, result.zoom);
            this.render();
            // Loading is undoable like any other change, then counts as "saved".
            this.commitChange();
            this.hasUnsavedFileChanges = false;

            if (result.droppedCount > 0) {
                const entryWord = result.droppedCount === 1 ? 'entry' : 'entries';
                this.toasts.show(`Loaded ${file.name}, but ${result.droppedCount} invalid state/transition ${entryWord} had to be skipped.`, { type: 'error' });
            } else {
                this.toasts.show(`Loaded ${file.name}`, { type: 'success' });
            }
        } catch (error) {
            this.toasts.show(`Couldn't load ${file.name}: ${error.message}`, { type: 'error' });
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
        this.updateEdgeDraftBanner();
        this.scheduleCommit();
    }

    /**
     * Shows what to do next while a transition is being drawn, for mouse, touch,
     * and keyboard users alike (previously only screen readers were told).
     */
    updateEdgeDraftBanner() {
        const banner = this.dom.edgeDraftBannerElement;
        if (!this.edgeDraft.active) {
            banner.classList.add('hidden');
            this.onboardingHint?.setSuppressed(false);
            return;
        }
        const source = this.graph.getNodeById(this.edgeDraft.sourceNodeId);
        const sourceName = source ? GeometryUtils.renderKatex(source.name) : '';
        const isTouch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
        let instructions;
        if (this.edgeDraft.mode === 'keyboard') {
            instructions = 'Press <kbd>[</kbd> / <kbd>]</kbd> to choose the target, <kbd>Enter</kbd> to connect, <kbd>Esc</kbd> to cancel.';
        } else if (isTouch) {
            instructions = 'Drag to the target state, or tap it. Tap empty space to cancel.';
        } else {
            instructions = 'Click the target state (the same state makes a self-loop). Click empty space or press <kbd>Esc</kbd> to cancel.';
        }
        banner.innerHTML = `<strong>Drawing a transition from ${sourceName}.</strong> ${instructions}`;
        banner.classList.remove('hidden');
        this.onboardingHint?.setSuppressed(true);
    }

    /**
     * Records the current diagram in undo history after a short quiet period, and
     * autosaves it. Drags wait until the pointer is released, so one drag = one undo step.
     */
    scheduleCommit() {
        if (this.isRestoringHistory) return;
        window.clearTimeout(this.pendingCommitTimerId);
        this.pendingCommitTimerId = window.setTimeout(() => {
            this.pendingCommitTimerId = null;
            if (this.pointerController.isEditingGestureActive) {
                this.scheduleCommit();
                return;
            }
            this.commitChange();
        }, AutomataEditorApp.COMMIT_DELAY_MS);
    }

    /**
     * Records a change right away if one is waiting, e.g. before undo or saving.
     */
    flushPendingCommit() {
        if (this.pendingCommitTimerId === null) return;
        window.clearTimeout(this.pendingCommitTimerId);
        this.pendingCommitTimerId = null;
        this.commitChange();
    }

    commitChange() {
        const changed = this.history.record(this.graph.toSnapshot());
        if (!changed) return;
        this.hasUnsavedFileChanges = true;
        this.autosave.save(this.graph, this.camera);
        this.simulationPanel.invalidate();
        this.onboardingHint.observeDiagram(this.diagramCounts);
        this.updateUndoButtons();
    }

    undo() {
        this.flushPendingCommit();
        const snapshot = this.history.undo();
        if (snapshot === null) {
            this.announce('Nothing to undo');
            return;
        }
        this.restoreSnapshot(snapshot);
        this.announce('Undone');
    }

    redo() {
        this.flushPendingCommit();
        const snapshot = this.history.redo();
        if (snapshot === null) {
            this.announce('Nothing to redo');
            return;
        }
        this.restoreSnapshot(snapshot);
        this.announce('Redone');
    }

    /**
     * @param {string} snapshot
     */
    restoreSnapshot(snapshot) {
        this.graph.replaceWith(AutomatonGraph.fromSnapshot(snapshot));
        this.edgeDraft.cancel();
        this.dom.tempEdgePathElement.style.display = 'none';
        const selected = this.selectionModel.resolve(this.graph);
        const survivingNodeIds = [...this.selectionModel.selectedNodeIds].filter(id => this.graph.getNodeById(id));
        if (!selected) {
            this.selectionModel.selectNodes(survivingNodeIds);
            if (survivingNodeIds.length === 0) this.propertiesPanel.close();
        }

        this.isRestoringHistory = true;
        this.render();
        this.isRestoringHistory = false;

        this.hasUnsavedFileChanges = true;
        this.autosave.save(this.graph, this.camera);
        this.simulationPanel.invalidate();
        this.updateUndoButtons();
    }

    updateUndoButtons() {
        this.dom.undoButton.disabled = !this.history.canUndo;
        this.dom.redoButton.disabled = !this.history.canRedo;
    }

    /**
     * Restores the diagram autosaved in this browser, if there is one.
     * @returns {boolean} Whether a diagram was restored.
     */
    restoreAutosave() {
        const saved = this.autosave.load();
        if (!saved || (saved.graph.nodes.length === 0 && saved.graph.edges.length === 0)) return false;

        this.graph.replaceWith(saved.graph);
        this.isRestoringHistory = true;
        this.render();
        this.isRestoringHistory = false;
        this.camera.restore(saved.panPositionX, saved.panPositionY, saved.zoom);
        window.setTimeout(() => this.camera.updateViewBox(), 100);

        this.toasts.show('Restored your last diagram from this browser.', {
            type: 'info',
            duration: 6000,
            action: { label: 'Start over', onClick: () => this.startOver() }
        });
        return true;
    }

    /**
     * Replaces the diagram with the example one. Undoable.
     */
    startOver() {
        this.flushPendingCommit();
        this.selectionModel.clear();
        this.edgeDraft.cancel();
        this.propertiesPanel.close();
        this.graph.replaceWith(new AutomatonGraph());
        this.seedExampleDiagram();
        this.flushPendingCommit();
        this.toasts.show('Started a new diagram. Press Ctrl+Z to get the old one back.', {
            action: { label: 'Undo', onClick: () => this.undo() }
        });
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
