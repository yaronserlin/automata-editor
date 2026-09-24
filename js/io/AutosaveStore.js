import { AutomatonGraph } from '../core/AutomatonGraph.js';

/**
 * @returns {Storage|null} window.localStorage, or null where it is unavailable
 *   (Node, disabled storage, or browsers that throw on access in private mode).
 */
function getDefaultStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (error) {
        return null;
    }
}

/**
 * Keeps a copy of the current diagram in the browser's localStorage so a
 * refresh, a closed tab, or a crash never loses work. Everything stays on the
 * user's device.
 */
export class AutosaveStore {
    static STORAGE_KEY = 'automata-editor:autosave:v1';

    /**
     * @param {Storage|null} [storage] Injected for tests; defaults to localStorage.
     */
    constructor(storage = getDefaultStorage()) {
        this.storage = storage;
    }

    /**
     * @returns {boolean} Whether autosave can work in this browser.
     */
    get isAvailable() {
        return this.storage !== null;
    }

    /**
     * @param {AutomatonGraph} graph
     * @param {{panPositionX: number, panPositionY: number, zoom: number}} camera
     * @returns {boolean} Whether the save succeeded (it can fail when storage is full or blocked).
     */
    save(graph, camera) {
        if (!this.storage) return false;
        try {
            const payload = { ...graph.toJSON(camera), savedAt: new Date().toISOString() };
            this.storage.setItem(AutosaveStore.STORAGE_KEY, JSON.stringify(payload));
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * @returns {ReturnType<typeof AutomatonGraph.fromRaw>} The saved diagram, or null when
     *   nothing usable is stored. Corrupt data is discarded rather than thrown.
     */
    load() {
        if (!this.storage) return null;
        let raw;
        try {
            raw = this.storage.getItem(AutosaveStore.STORAGE_KEY);
        } catch (error) {
            return null;
        }
        if (!raw) return null;

        try {
            return AutomatonGraph.fromRaw(JSON.parse(raw));
        } catch (error) {
            this.clear();
            return null;
        }
    }

    clear() {
        if (!this.storage) return;
        try {
            this.storage.removeItem(AutosaveStore.STORAGE_KEY);
        } catch (error) {
            // Storage is blocked; nothing to clear.
        }
    }
}
