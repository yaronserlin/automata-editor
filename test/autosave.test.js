import { describe, it, expect } from 'vitest';
import { AutosaveStore } from '../js/io/AutosaveStore.js';
import { AutomatonGraph } from '../js/core/AutomatonGraph.js';

/** A minimal in-memory stand-in for window.localStorage. */
class MemoryStorage {
    constructor() {
        this.items = new Map();
    }
    getItem(key) {
        return this.items.has(key) ? this.items.get(key) : null;
    }
    setItem(key, value) {
        this.items.set(key, String(value));
    }
    removeItem(key) {
        this.items.delete(key);
    }
}

/** Storage that throws on every call, like a blocked or full localStorage. */
class ThrowingStorage {
    getItem() { throw new Error('blocked'); }
    setItem() { throw new Error('QuotaExceededError'); }
    removeItem() { throw new Error('blocked'); }
}

const camera = { panPositionX: 12, panPositionY: -4, zoom: 1.5 };

describe('AutosaveStore', () => {
    it('saves and restores a diagram with its camera', () => {
        const store = new AutosaveStore(new MemoryStorage());
        const graph = new AutomatonGraph();
        const a = graph.addNode(10, 20);
        a.isStart = true;
        graph.addEdge(a.id, a.id, 'a');

        expect(store.save(graph, camera)).toBe(true);
        const restored = store.load();

        expect(restored.graph.nodes).toHaveLength(1);
        expect(restored.graph.nodes[0].isStart).toBe(true);
        expect(restored.graph.edges[0].label).toBe('a');
        expect(restored.zoom).toBe(1.5);
        expect(restored.panPositionX).toBe(12);
    });

    it('returns null when nothing has been saved', () => {
        expect(new AutosaveStore(new MemoryStorage()).load()).toBeNull();
    });

    it('discards corrupt data instead of throwing', () => {
        const storage = new MemoryStorage();
        storage.setItem(AutosaveStore.STORAGE_KEY, '{not json');
        const store = new AutosaveStore(storage);
        expect(store.load()).toBeNull();
        expect(storage.getItem(AutosaveStore.STORAGE_KEY)).toBeNull();
    });

    it('returns null for a structurally invalid save', () => {
        const storage = new MemoryStorage();
        storage.setItem(AutosaveStore.STORAGE_KEY, JSON.stringify({ nodes: 'nope' }));
        expect(new AutosaveStore(storage).load()).toBeNull();
    });

    it('fails quietly when storage is blocked or missing', () => {
        const graph = new AutomatonGraph();
        const blocked = new AutosaveStore(new ThrowingStorage());
        expect(blocked.save(graph, camera)).toBe(false);
        expect(blocked.load()).toBeNull();
        expect(() => blocked.clear()).not.toThrow();

        const missing = new AutosaveStore(null);
        expect(missing.isAvailable).toBe(false);
        expect(missing.save(graph, camera)).toBe(false);
        expect(missing.load()).toBeNull();
    });
});
