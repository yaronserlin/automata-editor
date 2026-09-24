/**
 * Runs input strings through an AutomatonGraph as a finite automaton (DFA or
 * NFA, including epsilon transitions) and records every intermediate step, so
 * the UI can replay the run one symbol at a time.
 *
 * This module is DOM-free, so it can be unit tested in plain Node.
 */
export class AutomatonSimulator {
    /** @type {Set<string>} Label tokens that mean "epsilon" (an empty-string transition). */
    static EPSILON_TOKENS = new Set(['\\epsilon', '\\varepsilon', 'ε', 'ϵ', '\\lambda', 'λ', '\\Lambda', 'Λ']);

    /**
     * Splits a transition label into the symbols it accepts. A label lists one or
     * more symbols separated by commas or line breaks ("a, b" or "a\nb"). Math
     * delimiters ($...$), braces, and \text{...}/\mathtt{...}-style wrappers are
     * ignored, so "\texttt{a}" and "{a}" both mean the symbol "a".
     * @param {string} label
     * @returns {{symbols: Set<string>, hasEpsilon: boolean}}
     */
    static parseLabel(label) {
        const symbols = new Set();
        let hasEpsilon = false;

        String(label ?? '')
            .split(/[,\n]/)
            .map(token => AutomatonSimulator.normalizeToken(token))
            .filter(token => token.length > 0)
            .forEach(token => {
                if (AutomatonSimulator.EPSILON_TOKENS.has(token)) {
                    hasEpsilon = true;
                } else {
                    symbols.add(token);
                }
            });

        return { symbols, hasEpsilon };
    }

    /**
     * @param {string} token
     * @returns {string} The token with math delimiters, formatting wrappers, and braces stripped.
     */
    static normalizeToken(token) {
        let result = token.trim().replace(/^\$+|\$+$/g, '').trim();
        result = result.replace(/\\(?:text|texttt|mathtt|mathrm|mathit|mathbf|mathsf)\s*\{([^}]*)\}/g, '$1');
        result = result.replace(/[{}]/g, '').trim();
        return result;
    }

    /**
     * Splits the user's test input into symbols. Input with spaces or commas is split
     * on them (so multi-character symbols such as "10" or "\sigma" can be tested);
     * otherwise every character is one symbol ("abba" -> a, b, b, a). A lone "ε"
     * or "\epsilon" means the empty string.
     * @param {string} input
     * @returns {string[]}
     */
    static tokenizeInput(input) {
        const trimmed = String(input ?? '').trim();
        if (trimmed.length === 0 || AutomatonSimulator.EPSILON_TOKENS.has(trimmed)) return [];
        if (/[\s,]/.test(trimmed)) {
            return trimmed.split(/[\s,]+/).map(token => AutomatonSimulator.normalizeToken(token)).filter(Boolean);
        }
        return [...trimmed];
    }

    /**
     * @param {import('./AutomatonGraph.js').AutomatonGraph} graph
     */
    constructor(graph) {
        this.graph = graph;
        /** @type {Map<string, {symbols: Set<string>, hasEpsilon: boolean}>} */
        this.parsedLabels = new Map(graph.edges.map(edge => [edge.id, AutomatonSimulator.parseLabel(edge.label)]));
    }

    /**
     * @returns {Set<string>} Every non-epsilon symbol used on any transition.
     */
    get alphabet() {
        const alphabet = new Set();
        this.parsedLabels.forEach(parsed => parsed.symbols.forEach(symbol => alphabet.add(symbol)));
        return alphabet;
    }

    /**
     * @returns {string[]} Ids of every state marked as a start state.
     */
    get startStateIds() {
        return this.graph.nodes.filter(node => node.isStart).map(node => node.id);
    }

    /**
     * @returns {boolean} Whether the diagram is a DFA-shaped automaton: exactly one start
     *   state, no epsilon transitions, and no state with two transitions on the same symbol.
     *   (Missing transitions are allowed; they reject.)
     */
    isDeterministic() {
        if (this.startStateIds.length !== 1) return false;
        const seen = new Set();
        for (const edge of this.graph.edges) {
            const parsed = this.parsedLabels.get(edge.id);
            if (parsed.hasEpsilon) return false;
            for (const symbol of parsed.symbols) {
                const key = `${edge.sourceId}\u0000${symbol}`;
                if (seen.has(key)) return false;
                seen.add(key);
            }
        }
        return true;
    }

    /**
     * Expands a set of states with everything reachable through epsilon transitions.
     * @param {Iterable<string>} stateIds
     * @returns {{stateIds: Set<string>, edgeIds: Set<string>}} The closure and the epsilon edges followed.
     */
    epsilonClosure(stateIds) {
        const closure = new Set(stateIds);
        const edgeIds = new Set();
        const pending = [...closure];

        while (pending.length > 0) {
            const current = pending.pop();
            for (const edge of this.graph.edges) {
                if (edge.sourceId !== current || !this.parsedLabels.get(edge.id).hasEpsilon) continue;
                edgeIds.add(edge.id);
                if (!closure.has(edge.targetId)) {
                    closure.add(edge.targetId);
                    pending.push(edge.targetId);
                }
            }
        }
        return { stateIds: closure, edgeIds };
    }

    /**
     * Consumes one symbol from a set of active states, then follows epsilon transitions.
     * @param {Set<string>} stateIds
     * @param {string} symbol
     * @returns {{stateIds: Set<string>, edgeIds: Set<string>}} The next active states and every edge taken.
     */
    step(stateIds, symbol) {
        const moved = new Set();
        const edgeIds = new Set();
        for (const edge of this.graph.edges) {
            if (!stateIds.has(edge.sourceId)) continue;
            if (!this.parsedLabels.get(edge.id).symbols.has(symbol)) continue;
            moved.add(edge.targetId);
            edgeIds.add(edge.id);
        }
        const closure = this.epsilonClosure(moved);
        closure.edgeIds.forEach(id => edgeIds.add(id));
        return { stateIds: closure.stateIds, edgeIds };
    }

    /**
     * @param {Set<string>} stateIds
     * @returns {boolean} Whether any of the given states is an accept state.
     */
    containsAcceptState(stateIds) {
        return this.graph.nodes.some(node => node.isAccept && stateIds.has(node.id));
    }

    /**
     * Runs a full input through the automaton, recording every step.
     *
     * Step 0 is the starting configuration (the start states plus their epsilon
     * closure); step i is the configuration after consuming symbol i. A run stops
     * early when no state is left active - the input is then rejected.
     *
     * @param {string|string[]} input - Raw input text, or already-tokenized symbols.
     * @returns {{
     *   ok: boolean,
     *   error?: string,
     *   symbols: string[],
     *   steps: Array<{consumed: number, symbol: string|null, stateIds: Set<string>, edgeIds: Set<string>}>,
     *   accepted: boolean,
     *   stuckAt: number|null,
     *   unknownSymbols: string[]
     * }}
     */
    run(input) {
        const symbols = Array.isArray(input) ? input : AutomatonSimulator.tokenizeInput(input);
        const empty = { symbols, steps: [], accepted: false, stuckAt: null, unknownSymbols: [] };

        if (this.graph.nodes.length === 0) {
            return { ...empty, ok: false, error: 'Add some states first.' };
        }
        const starts = this.startStateIds;
        if (starts.length === 0) {
            return { ...empty, ok: false, error: 'No start state. Select a state and tick "Start Node".' };
        }

        const alphabet = this.alphabet;
        const unknownSymbols = [...new Set(symbols.filter(symbol => !alphabet.has(symbol)))];

        const initial = this.epsilonClosure(starts);
        const steps = [{ consumed: 0, symbol: null, stateIds: initial.stateIds, edgeIds: initial.edgeIds }];
        let current = initial.stateIds;
        let stuckAt = null;

        for (let index = 0; index < symbols.length; index++) {
            const next = this.step(current, symbols[index]);
            steps.push({ consumed: index + 1, symbol: symbols[index], stateIds: next.stateIds, edgeIds: next.edgeIds });
            current = next.stateIds;
            if (current.size === 0) {
                stuckAt = index;
                break;
            }
        }

        const finishedInput = stuckAt === null;
        return {
            ok: true,
            symbols,
            steps,
            accepted: finishedInput && this.containsAcceptState(current),
            stuckAt,
            unknownSymbols
        };
    }
}
