/**
 * Core Data Structures (State)
 */
const NODE_RADIUS = 30;

/** @type {Array<Object>} List of all nodes in the automaton */
let nodes = [];

/** @type {Array<Object>} List of all edges in the automaton */
let edges = [];

/** @type {number} Counter for generating unique node IDs */
let nodeIdCounter = 0;

/** @type {number} Counter for generating unique edge IDs */
let edgeIdCounter = 0;

/**
 * UI State
 */
/** @type {Object|null} Active element selected for properties panel */
let selectedElement = null;

/** @type {Set<string>} Set of node IDs currently selected (supports multi-select) */
let selectedNodes = new Set();

/**
 * Dragging & Selecting State
 */
let isDraggingNode = false;
let draggedNodeId = null;
let initialNodePositions = new Map();
let dragStartPosition = { positionX: 0, positionY: 0 };

let isDraggingEdge = false;
let draggedEdgeId = null;

let isDrawingEdge = false;
let sourceNodeForEdge = null;

let isDraggingStartArrow = false;
let draggedStartArrowNodeId = null;

let isBoxSelecting = false;
let selectionBoxStart = { positionX: 0, positionY: 0 };
let preBoxSelectedNodes = new Set();

/**
 * Camera Engine (Zoom & Pan State)
 */
let currentZoom = 1.0;
let panPositionX = 0;
let panPositionY = 0;
let isPanning = false;
let panStart = { positionX: 0, positionY: 0, initialPanX: 0, initialPanY: 0 };

/** @type {Array<Object>} Active smart positioning guides during dragging */
let activeGuides = [];
