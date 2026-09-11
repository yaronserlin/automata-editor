/**
 * Generic validation helpers for normalizing untrusted, loosely-typed data
 * (such as a parsed project file) into well-formed values.
 */
export class Validation {
    /**
     * @param {*} value
     * @returns {boolean} Whether value is a finite number.
     */
    static isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    /**
     * @param {*} value
     * @param {string} [fallback]
     * @returns {string} value coerced to a string, or fallback when value is nullish.
     */
    static asString(value, fallback = '') {
        if (typeof value === 'string') return value;
        if (value === undefined || value === null) return fallback;
        return String(value);
    }

    /**
     * @param {*} value
     * @param {number} fallback
     * @returns {number} value when it is a finite number, otherwise fallback.
     */
    static asFiniteNumber(value, fallback) {
        return Validation.isFiniteNumber(value) ? value : fallback;
    }
}
