/**
 * Document Object Model (DOM) elements used throughout the application.
 */

/** @type {SVGSVGElement} Main SVG canvas element */
const svgCanvas = document.getElementById('automaton-canvas');

/** @type {HTMLElement} Element displaying the current zoom percentage */
const zoomDisplay = document.getElementById('zoom-level-display');

/** @type {SVGRectElement} Selection box rectangle element for multi-select */
const selectionBox = document.getElementById('selection-box');

/** @type {SVGGElement} SVG group layer for drawing guides */
const guidesLayer = document.getElementById('guides-layer');

/** @type {SVGGElement} SVG group layer for drawing nodes */
const nodesLayer = document.getElementById('nodes-layer');

/** @type {SVGGElement} SVG group layer for drawing edges */
const edgesLayer = document.getElementById('edges-layer');

/** @type {SVGPathElement} Temporary SVG path used while drawing a new edge */
const tempEdgePath = document.getElementById('temp-edge');

/** @type {HTMLElement} Panel container for displaying properties */
const propertiesPanel = document.getElementById('properties-panel');

/** @type {HTMLElement} Title element inside the properties panel */
const panelTitle = document.getElementById('panel-title');

/** @type {HTMLElement} Container for node-specific properties */
const nodePropsDiv = document.getElementById('node-props');

/** @type {HTMLElement} Container for edge-specific properties */
const edgePropsDiv = document.getElementById('edge-props');

/** @type {HTMLInputElement} Input field for editing a node's name */
const nodeNameInput = document.getElementById('node-name-input');

/** @type {HTMLInputElement} Checkbox to mark a node as a start node */
const nodeIsStartCheckbox = document.getElementById('node-is-start');

/** @type {HTMLInputElement} Checkbox to mark a node as an accept node */
const nodeIsAcceptCheckbox = document.getElementById('node-is-accept');

/** @type {HTMLInputElement} Input field (textarea) for editing an edge's label */
const edgeLabelInput = document.getElementById('edge-label-input');
