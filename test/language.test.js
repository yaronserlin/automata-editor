import { describe, it, expect } from 'vitest';
import { AutomatonGraph } from '../js/core/AutomatonGraph.js';
import { AutomatonSimulator } from '../js/core/AutomatonSimulator.js';
import { LanguageAnalyzer, NumberSet, Regex } from '../js/core/LanguageAnalyzer.js';

/**
 * @param {string[]} names
 * @param {Array<[string, string, string]>} edges
 * @param {string[]} starts
 * @param {string[]} accepts
 */
function build(names, edges, starts, accepts) {
    const graph = new AutomatonGraph();
    const ids = {};
    for (const name of names) {
        const node = graph.addNode(0, 0);
        ids[name] = node.id;
        node.isStart = starts.includes(name);
        node.isAccept = accepts.includes(name);
    }
    for (const [from, to, label] of edges) graph.addEdge(ids[from], ids[to], label);
    return graph;
}

/**
 * DFA for L = { a^n b^m c^k d^l | 1 <= n <= 4, m = 2n, k mod 4 = 1, l mod 2 = 0 }.
 */
function buildBlockExample() {
    const names = ['A0', 'A1', 'A2', 'A3', 'A4', 'C0', 'C1', 'C2', 'C3', 'D0', 'D1'];
    const edges = [];
    for (let n = 1; n <= 4; n++) edges.push([`A${n - 1}`, `A${n}`, 'a']);
    for (let n = 1; n <= 4; n++) {
        let previous = `A${n}`;
        for (let step = 1; step < 2 * n; step++) {
            const name = `B${n}_${step}`;
            names.push(name);
            edges.push([previous, name, 'b']);
            previous = name;
        }
        edges.push([previous, 'C0', 'b']);
    }
    edges.push(['C0', 'C1', 'c'], ['C1', 'C2', 'c'], ['C2', 'C3', 'c'], ['C3', 'C0', 'c']);
    edges.push(['C1', 'D1', 'd'], ['D1', 'D0', 'd'], ['D0', 'D1', 'd']);
    return build(names, edges, ['A0'], ['C1', 'D0']);
}

/** Every string over the alphabet up to the given length. */
function allStrings(alphabet, maxLength) {
    const result = [''];
    let frontier = [''];
    for (let length = 1; length <= maxLength; length++) {
        frontier = frontier.flatMap(prefix => alphabet.map(symbol => prefix + symbol));
        result.push(...frontier);
    }
    return result;
}

/** Turns the plain-text regex output (single-letter symbols) into a JS RegExp. */
function toJsRegExp(text) {
    const body = text.replace(/^L = /, '').replace(/ ∪ /g, '|').replace(/ε/g, '').replace(/∅/g, '[^\\s\\S]');
    return new RegExp(`^(?:${body})$`);
}

describe('LanguageAnalyzer: block patterns', () => {
    it('writes the classic example in set-builder notation', () => {
        const result = new LanguageAnalyzer(buildBlockExample()).analyze();
        expect(result.ok).toBe(true);
        expect(result.kind).toBe('pattern');
        expect(result.text).toBe('L = { a^n b^m c^k d^ℓ | 1 ≤ n ≤ 4, m = 2n, k mod 4 = 1, ℓ mod 2 = 0 }');
        expect(result.latex).toContain('m = 2n');
        expect(result.latex).toContain('\\ell \\bmod 2 = 0');
    });

    it('gives the same answer for an NFA with epsilon moves', () => {
        // a^n b^m with an epsilon step between the blocks and an extra start state.
        const graph = build(
            ['s', 'p', 'q'],
            [['s', 'p', '\\epsilon'], ['p', 'p', 'a'], ['p', 'q', '\\epsilon'], ['q', 'q', 'b']],
            ['s'],
            ['q']
        );
        const result = new LanguageAnalyzer(graph).analyze();
        expect(result.kind).toBe('pattern');
        expect(result.text).toBe('L = { a^n b^m | n, m ≥ 0 }');
    });

    it('lists a small finite language word by word', () => {
        const graph = build(['p', 'q', 'r'], [['p', 'q', 'a'], ['q', 'r', 'b'], ['p', 'r', 'b']], ['p'], ['r']);
        expect(new LanguageAnalyzer(graph).analyze().text).toBe('L = { b, ab }');
    });

    it('shows the language of only the empty string', () => {
        const graph = build(['p'], [], ['p'], ['p']);
        expect(new LanguageAnalyzer(graph).analyze().text).toBe('L = { ε }');
    });

    it('writes a union when there are several block shapes', () => {
        const graph = build(
            ['s', 'p', 'q'],
            [['s', 'p', '\\epsilon'], ['p', 'p', 'a'], ['s', 'q', 'b'], ['q', 'q', 'b']],
            ['s'],
            ['p', 'q']
        );
        expect(new LanguageAnalyzer(graph).analyze().text).toBe('L = { a^n | n ≥ 0 } ∪ { b^n | n ≥ 1 }');
    });

    it('describes modular conditions with a lower bound', () => {
        // a^n with n even and n >= 2
        const graph = build(['0', '1', '2', '3'], [['0', '1', 'a'], ['1', '2', 'a'], ['2', '3', 'a'], ['3', '2', 'a']], ['0'], ['2']);
        expect(new LanguageAnalyzer(graph).analyze().text).toBe('L = { a^n | n mod 2 = 0, n ≥ 2 }');
    });
});

describe('LanguageAnalyzer: regular expression fallback', () => {
    it('uses a regular expression when the language is not a block pattern', () => {
        const graph = build(['p', 'q'], [['p', 'p', 'a'], ['p', 'q', 'b'], ['q', 'q', 'b'], ['q', 'p', 'a']], ['p'], ['q']);
        const result = new LanguageAnalyzer(graph).analyze();
        expect(result.kind).toBe('regex');
        const regex = toJsRegExp(result.text);
        for (const word of allStrings(['a', 'b'], 7)) {
            expect(regex.test(word)).toBe(word.endsWith('b'));
        }
    });

    it('simplifies Sigma-star to (a ∪ b)*', () => {
        const graph = build(['p'], [['p', 'p', 'a, b']], ['p'], ['p']);
        expect(new LanguageAnalyzer(graph).analyze().text).toBe('L = (a ∪ b)*');
    });

    it('matches the simulator on random NFAs', () => {
        let seed = 7;
        const random = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        const labels = ['a', 'b', 'a, b', '\\epsilon'];
        for (let trial = 0; trial < 60; trial++) {
            const count = 2 + Math.floor(random() * 3);
            const names = Array.from({ length: count }, (_, index) => `s${index}`);
            const edges = [];
            for (let edge = 0; edge < count * 2; edge++) {
                edges.push([names[Math.floor(random() * count)], names[Math.floor(random() * count)], labels[Math.floor(random() * labels.length)]]);
            }
            const accepts = names.filter(() => random() < 0.4);
            const graph = build(names, edges, ['s0'], accepts);
            const simulator = new AutomatonSimulator(graph);
            const alphabet = LanguageAnalyzer.sortSymbols([...simulator.alphabet]);
            const minimal = LanguageAnalyzer.minimize(LanguageAnalyzer.trim(LanguageAnalyzer.determinize(simulator, alphabet)), alphabet);
            const regex = minimal === null ? Regex.EMPTY : LanguageAnalyzer.toRegex(minimal);
            const jsRegex = toJsRegExp(Regex.toText(regex));
            for (const word of allStrings(['a', 'b'], 6)) {
                expect(jsRegex.test(word), `trial ${trial}, word "${word}", regex ${Regex.toText(regex)}`).toBe(simulator.run(word).accepted);
            }
        }
    });
});

describe('LanguageAnalyzer: edge cases', () => {
    it('reports an empty diagram', () => {
        const result = new LanguageAnalyzer(new AutomatonGraph()).analyze();
        expect(result.ok).toBe(false);
    });

    it('reports a missing start state', () => {
        const graph = build(['p'], [['p', 'p', 'a']], [], ['p']);
        expect(new LanguageAnalyzer(graph).analyze().error).toMatch(/start state/);
    });

    it('returns the empty language when there are no accept states', () => {
        const graph = build(['p'], [['p', 'p', 'a']], ['p'], []);
        const result = new LanguageAnalyzer(graph).analyze();
        expect(result.kind).toBe('empty');
        expect(result.text).toBe('L = ∅');
        expect(result.note).toMatch(/no accept states/i);
    });

    it('returns the empty language when no accept state is reachable', () => {
        const graph = build(['p', 'q'], [['p', 'p', 'a']], ['p'], ['q']);
        const result = new LanguageAnalyzer(graph).analyze();
        expect(result.kind).toBe('empty');
        expect(result.note).toMatch(/reached/);
    });
});

describe('NumberSet', () => {
    it('describes bounds, ranges and residues', () => {
        const v = { latex: 'n', text: 'n' };
        expect(NumberSet.fromValues([1, 2, 3]).describe(v).text).toBe('1 ≤ n ≤ 3');
        expect(NumberSet.fromValues([1, 3]).describe(v).text).toBe('n ∈ {1, 3}');
        expect(NumberSet.progression(1, 4).describe(v).text).toBe('n mod 4 = 1');
        expect(NumberSet.progression(3, 1).describe(v).text).toBe('n ≥ 3');
        expect(NumberSet.progression(0, 1).describe(v)).toBeNull();
        expect(NumberSet.single(1).union(NumberSet.progression(0, 2)).describe(v).text).toBe('(n = 1 or n mod 2 = 0)');
    });
});
