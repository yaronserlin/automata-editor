import { describe, it, expect } from 'vitest';
import { AutomatonGraph } from '../js/core/AutomatonGraph.js';
import { AutomatonSimulator } from '../js/core/AutomatonSimulator.js';

/**
 * Builds a DFA over {a, b} that accepts strings ending in "b".
 */
function buildEndsInB() {
    const graph = new AutomatonGraph();
    const q0 = graph.addNode(0, 0);
    const q1 = graph.addNode(100, 0);
    q0.isStart = true;
    q1.isAccept = true;
    graph.addEdge(q0.id, q0.id, 'a');
    graph.addEdge(q0.id, q1.id, 'b');
    graph.addEdge(q1.id, q1.id, 'b');
    graph.addEdge(q1.id, q0.id, 'a');
    return { graph, q0, q1 };
}

describe('AutomatonSimulator.parseLabel', () => {
    it('splits on commas and line breaks and trims', () => {
        const parsed = AutomatonSimulator.parseLabel('a, b\nc');
        expect([...parsed.symbols]).toEqual(['a', 'b', 'c']);
        expect(parsed.hasEpsilon).toBe(false);
    });

    it('recognizes every epsilon spelling', () => {
        for (const label of ['\\epsilon', '\\varepsilon', 'ε', '\\lambda', 'λ', '$\\epsilon$']) {
            expect(AutomatonSimulator.parseLabel(label).hasEpsilon).toBe(true);
        }
    });

    it('mixes symbols and epsilon on one label', () => {
        const parsed = AutomatonSimulator.parseLabel('0, \\epsilon');
        expect([...parsed.symbols]).toEqual(['0']);
        expect(parsed.hasEpsilon).toBe(true);
    });

    it('strips math delimiters, braces, and text wrappers', () => {
        expect([...AutomatonSimulator.parseLabel('$a$, {b}, \\texttt{c}').symbols]).toEqual(['a', 'b', 'c']);
    });

    it('ignores empty tokens', () => {
        expect(AutomatonSimulator.parseLabel(' , ,').symbols.size).toBe(0);
        expect(AutomatonSimulator.parseLabel('').symbols.size).toBe(0);
    });
});

describe('AutomatonSimulator.tokenizeInput', () => {
    it('splits plain input into characters', () => {
        expect(AutomatonSimulator.tokenizeInput('abba')).toEqual(['a', 'b', 'b', 'a']);
    });

    it('splits on spaces or commas for multi-character symbols', () => {
        expect(AutomatonSimulator.tokenizeInput('10 01, 1')).toEqual(['10', '01', '1']);
    });

    it('treats empty input and epsilon as the empty string', () => {
        expect(AutomatonSimulator.tokenizeInput('')).toEqual([]);
        expect(AutomatonSimulator.tokenizeInput('  ')).toEqual([]);
        expect(AutomatonSimulator.tokenizeInput('ε')).toEqual([]);
        expect(AutomatonSimulator.tokenizeInput('\\epsilon')).toEqual([]);
    });
});

describe('AutomatonSimulator.run on a DFA', () => {
    it('accepts and rejects correctly', () => {
        const { graph } = buildEndsInB();
        const simulator = new AutomatonSimulator(graph);
        expect(simulator.run('ab').accepted).toBe(true);
        expect(simulator.run('abba').accepted).toBe(false);
        expect(simulator.run('bbb').accepted).toBe(true);
        expect(simulator.run('').accepted).toBe(false);
    });

    it('records one step per symbol plus the starting configuration', () => {
        const { graph, q0, q1 } = buildEndsInB();
        const result = new AutomatonSimulator(graph).run('ab');
        expect(result.steps).toHaveLength(3);
        expect([...result.steps[0].stateIds]).toEqual([q0.id]);
        expect(result.steps[0].symbol).toBeNull();
        expect([...result.steps[1].stateIds]).toEqual([q0.id]);
        expect(result.steps[1].symbol).toBe('a');
        expect([...result.steps[2].stateIds]).toEqual([q1.id]);
        expect(result.steps[2].edgeIds.size).toBe(1);
    });

    it('reports the diagram as deterministic', () => {
        const { graph } = buildEndsInB();
        expect(new AutomatonSimulator(graph).isDeterministic()).toBe(true);
    });

    it('accepts the empty string when the start state is accepting', () => {
        const { graph, q0 } = buildEndsInB();
        q0.isAccept = true;
        expect(new AutomatonSimulator(graph).run('').accepted).toBe(true);
    });

    it('stops and rejects when no transition matches', () => {
        const { graph } = buildEndsInB();
        const result = new AutomatonSimulator(graph).run('abcb');
        expect(result.accepted).toBe(false);
        expect(result.stuckAt).toBe(2);
        expect(result.steps).toHaveLength(4);
        expect(result.steps[3].stateIds.size).toBe(0);
        expect(result.unknownSymbols).toEqual(['c']);
    });
});

describe('AutomatonSimulator.run on an NFA', () => {
    it('tracks several active states at once', () => {
        // Accepts strings over {0,1} whose second-to-last symbol is 1.
        const graph = new AutomatonGraph();
        const q0 = graph.addNode(0, 0);
        const q1 = graph.addNode(100, 0);
        const q2 = graph.addNode(200, 0);
        q0.isStart = true;
        q2.isAccept = true;
        graph.addEdge(q0.id, q0.id, '0, 1');
        graph.addEdge(q0.id, q1.id, '1');
        graph.addEdge(q1.id, q2.id, '0\n1');

        const simulator = new AutomatonSimulator(graph);
        expect(simulator.isDeterministic()).toBe(false);
        expect(simulator.run('0110').accepted).toBe(true);
        expect(simulator.run('0101').accepted).toBe(false);
        expect(simulator.run('11').accepted).toBe(true);

        const steps = simulator.run('01').steps;
        expect(new Set(steps[2].stateIds)).toEqual(new Set([q0.id, q1.id]));
    });

    it('follows epsilon transitions, including chains and cycles', () => {
        const graph = new AutomatonGraph();
        const q0 = graph.addNode(0, 0);
        const q1 = graph.addNode(100, 0);
        const q2 = graph.addNode(200, 0);
        q0.isStart = true;
        q2.isAccept = true;
        graph.addEdge(q0.id, q1.id);          // default label is \epsilon
        graph.addEdge(q1.id, q0.id, 'ε');     // epsilon cycle must not loop forever
        graph.addEdge(q1.id, q2.id, 'a');
        graph.addEdge(q2.id, q0.id, '\\epsilon');

        const simulator = new AutomatonSimulator(graph);
        const initial = simulator.run('').steps[0];
        expect(initial.stateIds).toEqual(new Set([q0.id, q1.id]));
        expect(simulator.run('').accepted).toBe(false);
        expect(simulator.run('a').accepted).toBe(true);
        expect(simulator.run('aa').accepted).toBe(true);
        expect(simulator.run('a').steps[1].stateIds).toEqual(new Set([q0.id, q1.id, q2.id]));
    });

    it('supports several start states', () => {
        const graph = new AutomatonGraph();
        const q0 = graph.addNode(0, 0);
        const q1 = graph.addNode(100, 0);
        q0.isStart = true;
        q1.isStart = true;
        q1.isAccept = true;
        expect(new AutomatonSimulator(graph).run('').accepted).toBe(true);
        expect(new AutomatonSimulator(graph).isDeterministic()).toBe(false);
    });
});

describe('AutomatonSimulator.run errors', () => {
    it('explains a missing start state', () => {
        const graph = new AutomatonGraph();
        graph.addNode(0, 0);
        const result = new AutomatonSimulator(graph).run('a');
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/start state/i);
    });

    it('explains an empty diagram', () => {
        const result = new AutomatonSimulator(new AutomatonGraph()).run('a');
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/states/i);
    });
});
