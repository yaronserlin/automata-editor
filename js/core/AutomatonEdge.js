import { Validation } from './Validation.js';

/**
 * A transition between two states - or a self-loop - in a finite automaton diagram.
 */
export class AutomatonEdge {
    /** @type {number} Curve-offset step, in SVG units, applied per curve adjustment. */
    static CURVE_STEP = 15;

    /** @type {number} Loop-angle step, in radians, applied per curve adjustment on a self-loop. */
    static LOOP_ANGLE_STEP = Math.PI / 12;

    /** @type {number} Default loop angle (pointing up) for a self-loop. */
    static DEFAULT_LOOP_ANGLE = -Math.PI / 2;

    /**
     * @param {string} id
     * @param {string} sourceId
     * @param {string} targetId
     * @param {string} label
     * @param {{curveOffset?: number, loopAngle?: number}} [options]
     */
    constructor(id, sourceId, targetId, label, options = {}) {
        this.id = id;
        this.sourceId = sourceId;
        this.targetId = targetId;
        this.label = label;
        this.curveOffset = options.curveOffset ?? 0;
        this.loopAngle = options.loopAngle ?? AutomatonEdge.DEFAULT_LOOP_ANGLE;
    }

    /**
     * @returns {boolean} Whether this edge starts and ends on the same node.
     */
    get isSelfLoop() {
        return this.sourceId === this.targetId;
    }

    /**
     * Bends this edge's curve one step in the given direction. On a self-loop this
     * rotates the loop instead, since a self-loop has no curve offset to bend.
     * @param {1|-1} direction
     */
    adjustCurve(direction) {
        if (this.isSelfLoop) {
            this.loopAngle += direction * AutomatonEdge.LOOP_ANGLE_STEP;
        } else {
            this.curveOffset += direction * AutomatonEdge.CURVE_STEP;
        }
    }

    /**
     * Resets this edge to its default shape: straight, or a loop pointing up.
     */
    resetCurve() {
        this.curveOffset = 0;
        this.loopAngle = AutomatonEdge.DEFAULT_LOOP_ANGLE;
    }

    /**
     * @returns {Object} A plain, JSON-serializable representation of this edge.
     */
    toJSON() {
        return {
            id: this.id,
            sourceId: this.sourceId,
            targetId: this.targetId,
            label: this.label,
            curveOffset: this.curveOffset,
            loopAngle: this.loopAngle
        };
    }

    /**
     * Validates and normalizes an untrusted, parsed edge object.
     * @param {*} raw
     * @param {number} fallbackIndex - Used to derive an id when raw.id is missing or invalid.
     * @param {Set<string>} validNodeIds - Ids of nodes that survived validation.
     * @returns {AutomatonEdge|null} A valid edge, or null when raw cannot be salvaged.
     */
    static fromRaw(raw, fallbackIndex, validNodeIds) {
        if (!raw || typeof raw !== 'object') return null;
        if (!validNodeIds.has(raw.sourceId) || !validNodeIds.has(raw.targetId)) return null;

        const id = typeof raw.id === 'string' && raw.id ? raw.id : `edge-${fallbackIndex}`;
        return new AutomatonEdge(id, raw.sourceId, raw.targetId, Validation.asString(raw.label), {
            curveOffset: Validation.asFiniteNumber(raw.curveOffset, 0),
            loopAngle: Validation.asFiniteNumber(raw.loopAngle, AutomatonEdge.DEFAULT_LOOP_ANGLE)
        });
    }
}
