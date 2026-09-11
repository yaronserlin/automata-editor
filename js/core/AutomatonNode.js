import { Validation } from './Validation.js';

/**
 * A single state in a finite automaton diagram.
 */
export class AutomatonNode {
    /** @type {number} Radius, in SVG units, of a rendered node circle. */
    static RADIUS = 30;

    /**
     * @param {string} id
     * @param {number} positionX
     * @param {number} positionY
     * @param {string} name
     * @param {{isStart?: boolean, isAccept?: boolean, startAngle?: number}} [options]
     */
    constructor(id, positionX, positionY, name, options = {}) {
        this.id = id;
        this.positionX = positionX;
        this.positionY = positionY;
        this.name = name;
        this.isStart = options.isStart ?? false;
        this.isAccept = options.isAccept ?? false;
        this.startAngle = options.startAngle ?? Math.PI;
    }

    /**
     * Translates this node by the given offset.
     * @param {number} deltaX
     * @param {number} deltaY
     */
    moveBy(deltaX, deltaY) {
        this.positionX += deltaX;
        this.positionY += deltaY;
    }

    /**
     * @returns {Object} A plain, JSON-serializable representation of this node.
     */
    toJSON() {
        return {
            id: this.id,
            positionX: this.positionX,
            positionY: this.positionY,
            name: this.name,
            isStart: this.isStart,
            isAccept: this.isAccept,
            startAngle: this.startAngle
        };
    }

    /**
     * Validates and normalizes an untrusted, parsed node object.
     * @param {*} raw
     * @param {number} fallbackIndex - Used to derive an id when raw.id is missing or invalid.
     * @returns {AutomatonNode|null} A valid node, or null when raw cannot be salvaged.
     */
    static fromRaw(raw, fallbackIndex) {
        if (!raw || typeof raw !== 'object') return null;
        if (!Validation.isFiniteNumber(raw.positionX) || !Validation.isFiniteNumber(raw.positionY)) return null;

        const id = typeof raw.id === 'string' && raw.id ? raw.id : `node-${fallbackIndex}`;
        return new AutomatonNode(id, raw.positionX, raw.positionY, Validation.asString(raw.name), {
            isStart: Boolean(raw.isStart),
            isAccept: Boolean(raw.isAccept),
            startAngle: Validation.asFiniteNumber(raw.startAngle, Math.PI)
        });
    }
}
