/**
 * Snapshot-based undo/redo history. Each entry is an opaque, immutable
 * snapshot (the app uses a JSON string of the graph), so recording a state
 * that equals the current one is a no-op - selection changes, camera moves,
 * and repeated renders never create empty undo steps.
 *
 * This module is DOM-free, so it can be unit tested in plain Node.
 */
export class HistoryManager {
    static DEFAULT_LIMIT = 100;

    /**
     * @param {number} [limit] Maximum number of undo steps kept; the oldest are dropped first.
     */
    constructor(limit = HistoryManager.DEFAULT_LIMIT) {
        this.limit = limit;
        /** @type {string[]} */
        this.undoStack = [];
        /** @type {string[]} */
        this.redoStack = [];
        /** @type {string|null} */
        this.current = null;
    }

    /**
     * Starts a fresh history whose baseline is the given snapshot.
     * @param {string} snapshot
     */
    reset(snapshot) {
        this.undoStack = [];
        this.redoStack = [];
        this.current = snapshot;
    }

    /**
     * Records a new state. Clears the redo stack when the state actually changed.
     * @param {string} snapshot
     * @returns {boolean} Whether a new undo step was created.
     */
    record(snapshot) {
        if (snapshot === this.current) return false;
        if (this.current !== null) {
            this.undoStack.push(this.current);
            if (this.undoStack.length > this.limit) this.undoStack.shift();
        }
        this.current = snapshot;
        this.redoStack = [];
        return true;
    }

    /**
     * @returns {string|null} The snapshot to restore, or null when there is nothing to undo.
     */
    undo() {
        if (this.undoStack.length === 0) return null;
        this.redoStack.push(this.current);
        this.current = this.undoStack.pop();
        return this.current;
    }

    /**
     * @returns {string|null} The snapshot to restore, or null when there is nothing to redo.
     */
    redo() {
        if (this.redoStack.length === 0) return null;
        this.undoStack.push(this.current);
        this.current = this.redoStack.pop();
        return this.current;
    }

    /** @returns {boolean} */
    get canUndo() {
        return this.undoStack.length > 0;
    }

    /** @returns {boolean} */
    get canRedo() {
        return this.redoStack.length > 0;
    }
}
