import { AutomatonSimulator } from './AutomatonSimulator.js';

/**
 * Works out the language an automaton accepts and writes it as math.
 *
 * The diagram (DFA or NFA, with or without epsilon transitions) is first turned
 * into an equivalent minimal DFA (subset construction, then trimming and
 * minimization). Then:
 *
 * - If every accepted word has the shape a1^n1 a2^n2 ... ak^nk for a fixed order
 *   of distinct letters (a "block pattern", e.g. a^n b^m c^k), the language is
 *   written in set-builder notation with the conditions on the exponents:
 *   bounds (1 <= n <= 4), linear relations (m = 2n) and modular conditions
 *   (k mod 4 = 1).
 * - Otherwise it is written as a regular expression, found by state elimination.
 *
 * This module is DOM-free, so it can be unit tested in plain Node.
 */
export class LanguageAnalyzer {
    /** Subset construction gives up past this many DFA states. */
    static MAX_DFA_STATES = 400;
    /** Block-pattern analysis gives up past this many raw exponent terms. */
    static MAX_RAW_TERMS = 3000;
    /** Set-builder output falls back to a regular expression past this many sets in the union. */
    static MAX_PATTERN_TERMS = 6;
    /** A set-builder part with at most this many words is listed word by word instead. */
    static MAX_LISTED_WORDS = 3;

    static VARIABLES = [
        { latex: 'n', text: 'n' },
        { latex: 'm', text: 'm' },
        { latex: 'k', text: 'k' },
        { latex: '\\ell', text: 'ℓ' },
        { latex: 'p', text: 'p' },
        { latex: 'q', text: 'q' },
        { latex: 'r', text: 'r' },
        { latex: 's', text: 's' },
        { latex: 't', text: 't' }
    ];

    /**
     * @param {import('./AutomatonGraph.js').AutomatonGraph} graph
     */
    constructor(graph) {
        this.graph = graph;
    }

    /**
     * @returns {{
     *   ok: boolean,
     *   error?: string,
     *   kind?: 'empty'|'pattern'|'regex',
     *   latex?: string,
     *   text?: string,
     *   alphabet?: string[],
     *   note?: string,
     *   dfaStates?: number
     * }}
     */
    analyze() {
        if (this.graph.nodes.length === 0) return { ok: false, error: 'Add some states first.' };
        const simulator = new AutomatonSimulator(this.graph);
        if (simulator.startStateIds.length === 0) {
            return { ok: false, error: 'No start state. Select a state and tick "Start Node".' };
        }
        const alphabet = LanguageAnalyzer.sortSymbols([...simulator.alphabet]);

        const dfa = LanguageAnalyzer.determinize(simulator, alphabet);
        if (dfa === null) {
            return { ok: false, error: `Too many states after determinizing (over ${LanguageAnalyzer.MAX_DFA_STATES}); the language is not shown.` };
        }
        const minimal = LanguageAnalyzer.minimize(LanguageAnalyzer.trim(dfa), alphabet);

        if (minimal === null) {
            const hasAccept = this.graph.nodes.some(node => node.isAccept);
            return {
                ok: true,
                kind: 'empty',
                latex: 'L = \\varnothing',
                text: 'L = ∅',
                alphabet,
                note: hasAccept
                    ? 'No accept state can be reached from the start, so no string is accepted.'
                    : 'There are no accept states, so no string is accepted.'
            };
        }

        const pattern = LanguageAnalyzer.describeAsPattern(minimal);
        if (pattern && pattern.terms.length <= LanguageAnalyzer.MAX_PATTERN_TERMS) {
            return {
                ok: true,
                kind: 'pattern',
                latex: `L = ${pattern.terms.map(term => term.latex).join(' \\cup ')}`,
                text: `L = ${pattern.terms.map(term => term.text).join(' ∪ ')}`,
                alphabet,
                dfaStates: minimal.size
            };
        }

        const regex = LanguageAnalyzer.toRegex(minimal);
        return {
            ok: true,
            kind: 'regex',
            latex: `L = ${Regex.toLatex(regex)}`,
            text: `L = ${Regex.toText(regex)}`,
            alphabet,
            note: pattern ? 'The set-builder form had too many parts, so a regular expression is shown instead.' : undefined,
            dfaStates: minimal.size
        };
    }

    /**
     * @param {string[]} symbols
     * @returns {string[]} Symbols in natural order (a < b, 2 < 10).
     */
    static sortSymbols(symbols) {
        return symbols.sort((first, second) => first.localeCompare(second, 'en', { numeric: true }));
    }

    // ---------- DFA construction ----------

    /**
     * Subset construction. Missing transitions stay missing (a partial DFA).
     * @param {AutomatonSimulator} simulator
     * @param {string[]} alphabet
     * @returns {{size: number, start: number, accept: boolean[], delta: Array<Map<string, number>>}|null}
     */
    static determinize(simulator, alphabet) {
        const keyOf = stateIds => [...stateIds].sort().join('\u0000');
        const initial = simulator.epsilonClosure(simulator.startStateIds).stateIds;
        const sets = [initial];
        const indexByKey = new Map([[keyOf(initial), 0]]);
        const delta = [];
        const accept = [];

        for (let index = 0; index < sets.length; index++) {
            const current = sets[index];
            accept.push(simulator.containsAcceptState(current));
            const row = new Map();
            for (const symbol of alphabet) {
                const next = simulator.step(current, symbol).stateIds;
                if (next.size === 0) continue;
                const key = keyOf(next);
                if (!indexByKey.has(key)) {
                    if (sets.length >= LanguageAnalyzer.MAX_DFA_STATES) return null;
                    indexByKey.set(key, sets.length);
                    sets.push(next);
                }
                row.set(symbol, indexByKey.get(key));
            }
            delta.push(row);
        }
        return { size: sets.length, start: 0, accept, delta };
    }

    /**
     * Keeps only states that are reachable (all of them, after subset construction)
     * and from which an accept state can be reached.
     * @returns {{size: number, start: number, accept: boolean[], delta: Array<Map<string, number>>}|null}
     *   Null when the language is empty.
     */
    static trim(dfa) {
        const reverse = Array.from({ length: dfa.size }, () => []);
        dfa.delta.forEach((row, source) => row.forEach(target => reverse[target].push(source)));
        const useful = new Set();
        const pending = [];
        dfa.accept.forEach((isAccept, state) => {
            if (isAccept) {
                useful.add(state);
                pending.push(state);
            }
        });
        while (pending.length > 0) {
            const state = pending.pop();
            for (const source of reverse[state]) {
                if (!useful.has(source)) {
                    useful.add(source);
                    pending.push(source);
                }
            }
        }
        if (!useful.has(dfa.start)) return null;

        const kept = [...useful].sort((first, second) => first - second);
        const newIndex = new Map(kept.map((state, index) => [state, index]));
        return {
            size: kept.length,
            start: newIndex.get(dfa.start),
            accept: kept.map(state => dfa.accept[state]),
            delta: kept.map(state => {
                const row = new Map();
                dfa.delta[state].forEach((target, symbol) => {
                    if (newIndex.has(target)) row.set(symbol, newIndex.get(target));
                });
                return row;
            })
        };
    }

    /**
     * Moore partition refinement on a trimmed partial DFA (a missing transition
     * goes to an implicit dead state, which no trimmed state is equivalent to).
     * States are renumbered in breadth-first order from the start.
     * @returns {{size: number, start: number, accept: boolean[], delta: Array<Map<string, number>>}|null}
     */
    static minimize(dfa, alphabet) {
        if (dfa === null) return null;
        let blockOf = dfa.accept.map(isAccept => (isAccept ? 1 : 0));
        let blockCount = new Set(blockOf).size;

        for (;;) {
            const signatures = new Map();
            const next = dfa.delta.map((row, state) => {
                const signature = [blockOf[state], ...alphabet.map(symbol => (row.has(symbol) ? blockOf[row.get(symbol)] : -1))].join(',');
                if (!signatures.has(signature)) signatures.set(signature, signatures.size);
                return signatures.get(signature);
            });
            blockOf = next;
            if (signatures.size === blockCount) break;
            blockCount = signatures.size;
        }

        // Renumber blocks in BFS order so output is stable.
        const order = new Map();
        const queue = [blockOf[dfa.start]];
        order.set(blockOf[dfa.start], 0);
        const representative = new Map();
        blockOf.forEach((block, state) => {
            if (!representative.has(block)) representative.set(block, state);
        });
        for (let index = 0; index < queue.length; index++) {
            const row = dfa.delta[representative.get(queue[index])];
            for (const symbol of alphabet) {
                if (!row.has(symbol)) continue;
                const block = blockOf[row.get(symbol)];
                if (!order.has(block)) {
                    order.set(block, order.size);
                    queue.push(block);
                }
            }
        }

        const size = order.size;
        const accept = new Array(size);
        const delta = new Array(size);
        order.forEach((index, block) => {
            const state = representative.get(block);
            accept[index] = dfa.accept[state];
            const row = new Map();
            for (const symbol of alphabet) {
                if (dfa.delta[state].has(symbol)) row.set(symbol, order.get(blockOf[dfa.delta[state].get(symbol)]));
            }
            delta[index] = row;
        });
        return { size, start: 0, accept, delta, alphabet };
    }

    // ---------- Block patterns ----------

    /**
     * Finds an order of distinct letters a1..ak such that every accepted word lies
     * in a1* a2* ... ak*, or null when there is none.
     * @returns {string[]|null}
     */
    static blockOrder(dfa) {
        // lettersAfter[q]: every letter on some path leaving q.
        const lettersAfter = Array.from({ length: dfa.size }, () => new Set());
        let changed = true;
        while (changed) {
            changed = false;
            dfa.delta.forEach((row, state) => {
                row.forEach((target, symbol) => {
                    const before = lettersAfter[state].size;
                    lettersAfter[state].add(symbol);
                    lettersAfter[target].forEach(letter => lettersAfter[state].add(letter));
                    if (lettersAfter[state].size !== before) changed = true;
                });
            });
        }

        const letters = new Set();
        const mustPrecede = new Map();
        dfa.delta.forEach(row => {
            row.forEach((target, symbol) => {
                letters.add(symbol);
                lettersAfter[target].forEach(later => {
                    if (later === symbol) return;
                    if (!mustPrecede.has(symbol)) mustPrecede.set(symbol, new Set());
                    mustPrecede.get(symbol).add(later);
                });
            });
        });

        // Kahn's algorithm, breaking ties by natural symbol order.
        const indegree = new Map([...letters].map(letter => [letter, 0]));
        mustPrecede.forEach(laters => laters.forEach(later => indegree.set(later, indegree.get(later) + 1)));
        const order = [];
        const ready = LanguageAnalyzer.sortSymbols([...letters].filter(letter => indegree.get(letter) === 0));
        while (ready.length > 0) {
            const letter = ready.shift();
            order.push(letter);
            for (const later of mustPrecede.get(letter) ?? []) {
                indegree.set(later, indegree.get(later) - 1);
                if (indegree.get(later) === 0) {
                    ready.push(later);
                    LanguageAnalyzer.sortSymbols(ready);
                }
            }
        }
        return order.length === letters.size ? order : null;
    }

    /**
     * Describes the language in set-builder notation when it is a block pattern.
     * @returns {{terms: Array<{latex: string, text: string}>}|null}
     */
    static describeAsPattern(dfa) {
        const letters = LanguageAnalyzer.blockOrder(dfa);
        if (letters === null) return null;

        // Each accepting path a1^n1 ... ak^nk runs through k unary "lassos"; for a
        // fixed path the exponent of each block is a single value or an arithmetic
        // progression, so the language is a finite union of products of those.
        const lassoCache = new Map();
        const lasso = (state, letter) => {
            const key = `${state}\u0000${letter}`;
            if (lassoCache.has(key)) return lassoCache.get(key);
            const sequence = [state];
            const seenAt = new Map([[state, 0]]);
            let cycleStart = -1;
            let current = state;
            for (;;) {
                const next = dfa.delta[current].get(letter);
                if (next === undefined) break;
                if (seenAt.has(next)) {
                    cycleStart = seenAt.get(next);
                    break;
                }
                seenAt.set(next, sequence.length);
                sequence.push(next);
                current = next;
            }
            const period = cycleStart >= 0 ? sequence.length - cycleStart : 0;
            const entries = sequence.map((reached, count) => ({
                state: reached,
                set: count >= cycleStart && cycleStart >= 0
                    ? NumberSet.progression(count, period)
                    : NumberSet.single(count)
            }));
            lassoCache.set(key, entries);
            return entries;
        };

        const rawTerms = [];
        let overflow = false;
        const walk = (blockIndex, state, sets) => {
            if (overflow) return;
            if (blockIndex === letters.length) {
                if (dfa.accept[state]) {
                    rawTerms.push(sets);
                    if (rawTerms.length > LanguageAnalyzer.MAX_RAW_TERMS) overflow = true;
                }
                return;
            }
            for (const entry of lasso(state, letters[blockIndex])) {
                walk(blockIndex + 1, entry.state, [...sets, entry.set]);
            }
        };
        walk(0, dfa.start, []);
        if (overflow) return null;

        const merged = LanguageAnalyzer.mergeTerms(rawTerms);
        const described = LanguageAnalyzer.findRelations(merged);
        return { terms: LanguageAnalyzer.renderTerms(letters, described) };
    }

    /**
     * Repeatedly unions terms that differ in exactly one coordinate.
     * @param {NumberSet[][]} terms
     * @returns {NumberSet[][]}
     */
    static mergeTerms(terms) {
        let current = terms;
        let changed = true;
        while (changed && current.length > 1) {
            changed = false;
            const width = current[0].length;
            for (let coordinate = 0; coordinate < width; coordinate++) {
                const groups = new Map();
                for (const term of current) {
                    const key = term.map((set, index) => (index === coordinate ? '*' : set.key)).join('|');
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(term);
                }
                if (groups.size === current.length) continue;
                changed = true;
                current = [...groups.values()].map(group => {
                    if (group.length === 1) return group[0];
                    const union = group.slice(1).reduce((acc, term) => acc.union(term[coordinate]), group[0][coordinate]);
                    return group[0].map((set, index) => (index === coordinate ? union : set));
                });
                if (current.length === 1) break;
            }
        }
        return current;
    }

    /**
     * Groups terms that agree everywhere except on several single-valued
     * coordinates, and tries to express those as one free variable plus linear
     * relations (m = 2n, k = n + 1).
     * @param {NumberSet[][]} terms
     * @returns {Array<Array<{set: NumberSet}|{linear: {of: number, factor: number, offset: number}}>>}
     */
    static findRelations(terms) {
        const plain = term => term.map(set => ({ set }));
        if (terms.length < 2) return terms.map(plain);

        const groups = new Map();
        for (const term of terms) {
            const key = term.map(set => (set.singleValue() !== null ? 'C' : set.key)).join('|');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(term);
        }

        const result = [];
        for (const group of groups.values()) {
            const relation = group.length >= 2 ? LanguageAnalyzer.fitRelation(group) : null;
            if (relation) result.push(relation);
            else group.forEach(term => result.push(plain(term)));
        }
        return result;
    }

    /**
     * @param {NumberSet[][]} group Terms with the same shape (same non-constant coordinates).
     */
    static fitRelation(group) {
        const width = group[0].length;
        const values = group.map(term => term.map(set => set.singleValue()));
        const varying = [];
        for (let index = 0; index < width; index++) {
            if (values[0][index] === null) continue;
            if (values.some(row => row[index] !== values[0][index])) varying.push(index);
        }
        if (varying.length < 2) return null;

        for (const free of varying) {
            const freeValues = values.map(row => row[free]);
            if (new Set(freeValues).size !== freeValues.length) continue;
            const relations = new Map();
            let fits = true;
            for (const dependent of varying) {
                if (dependent === free) continue;
                const [first, second] = [values[0], values[1]];
                const factor = (second[dependent] - first[dependent]) / (second[free] - first[free]);
                const offset = first[dependent] - factor * first[free];
                if (!Number.isInteger(factor) || factor < 1 || !Number.isInteger(offset)) {
                    fits = false;
                    break;
                }
                if (values.some(row => row[dependent] !== factor * row[free] + offset)) {
                    fits = false;
                    break;
                }
                relations.set(dependent, { of: free, factor, offset });
            }
            if (!fits) continue;
            return group[0].map((set, index) => {
                if (index === free) return { set: NumberSet.fromValues(freeValues) };
                if (relations.has(index)) return { linear: relations.get(index) };
                return { set };
            });
        }
        return null;
    }

    /**
     * @param {string[]} letters
     * @param {Array<Array<{set?: NumberSet, linear?: {of: number, factor: number, offset: number}}>>} terms
     * @returns {Array<{latex: string, text: string}>}
     */
    static renderTerms(letters, terms) {
        const words = [];
        const sets = [];

        for (const term of terms) {
            const expanded = LanguageAnalyzer.expandSmallTerm(term);
            if (expanded) {
                words.push(...expanded);
                continue;
            }

            const variableOf = new Map();
            term.forEach((entry, index) => {
                const isVariable = entry.linear || entry.set.singleValue() === null;
                if (isVariable) variableOf.set(index, LanguageAnalyzer.variable(variableOf.size));
            });

            const latexWord = [];
            const textWord = [];
            const latexConditions = [];
            const textConditions = [];
            const unconstrained = [];

            term.forEach((entry, index) => {
                const letter = letters[index];
                if (!variableOf.has(index)) {
                    const count = entry.set.singleValue();
                    if (count === 0) return;
                    latexWord.push(Symbols.latexPower(letter, count === 1 ? null : String(count)));
                    textWord.push(Symbols.textPower(letter, count === 1 ? null : String(count)));
                    return;
                }
                const variable = variableOf.get(index);
                latexWord.push(Symbols.latexPower(letter, variable.latex));
                textWord.push(Symbols.textPower(letter, variable.text));

                if (entry.linear) {
                    const base = variableOf.get(entry.linear.of);
                    latexConditions.push(`${variable.latex} = ${LanguageAnalyzer.linearExpression(entry.linear, base.latex)}`);
                    textConditions.push(`${variable.text} = ${LanguageAnalyzer.linearExpression(entry.linear, base.text)}`);
                    return;
                }
                const conditions = entry.set.describe(variable);
                if (conditions === null) {
                    unconstrained.push(variable);
                    return;
                }
                latexConditions.push(conditions.latex);
                textConditions.push(conditions.text);
            });

            if (unconstrained.length > 0) {
                latexConditions.push(`${unconstrained.map(variable => variable.latex).join(', ')} \\ge 0`);
                textConditions.push(`${unconstrained.map(variable => variable.text).join(', ')} ≥ 0`);
            }

            sets.push({
                // Each condition is one group, so a narrow screen wraps only between conditions.
                latex: `\\{\\, ${latexWord.join(' ')} \\mid ${latexConditions.map(condition => `{${condition}}`).join(',\\ \\allowbreak ')} \\,\\}`,
                text: `{ ${textWord.join(' ')} | ${textConditions.join(', ')} }`
            });
        }

        const result = [];
        if (words.length > 0) {
            words.sort((first, second) => first.reduce((sum, count) => sum + count, 0) - second.reduce((sum, count) => sum + count, 0));
            const latexWords = words.map(word => LanguageAnalyzer.constantWord(letters, word, 'latex'));
            const textWords = words.map(word => LanguageAnalyzer.constantWord(letters, word, 'text'));
            result.push({ latex: `\\{ ${latexWords.join(', ')} \\}`, text: `{ ${textWords.join(', ')} }` });
        }
        return [...result, ...sets];
    }

    /**
     * A term with only a few words ({b, ab}) reads better as a list than as
     * set-builder notation.
     * @returns {number[][]|null} The exponent vectors, or null to keep set-builder form.
     */
    static expandSmallTerm(term) {
        if (term.some(entry => entry.linear || !entry.set.isFinite)) return null;
        const choices = term.map(entry => entry.set.prefix.flatMap((member, index) => (member ? [index] : [])));
        const count = choices.reduce((product, values) => product * values.length, 1);
        if (count > LanguageAnalyzer.MAX_LISTED_WORDS) return null;
        return choices.reduce((vectors, values) => vectors.flatMap(vector => values.map(value => [...vector, value])), [[]]);
    }

    static constantWord(letters, counts, format) {
        const parts = [];
        counts.forEach((count, index) => {
            if (count === 0) return;
            const exponent = count === 1 ? null : String(count);
            parts.push(format === 'latex' ? Symbols.latexPower(letters[index], exponent) : Symbols.textPower(letters[index], exponent));
        });
        if (parts.length === 0) return format === 'latex' ? '\\varepsilon' : 'ε';
        return parts.join(format === 'latex' ? ' ' : '');
    }

    static variable(index) {
        if (index < LanguageAnalyzer.VARIABLES.length) return LanguageAnalyzer.VARIABLES[index];
        return { latex: `n_{${index + 1}}`, text: `n${index + 1}` };
    }

    static linearExpression({ factor, offset }, base) {
        let expression = factor === 1 ? base : `${factor}${base}`;
        if (offset > 0) expression += ` + ${offset}`;
        if (offset < 0) expression += ` - ${-offset}`;
        return expression;
    }

    // ---------- Regular expressions ----------

    /**
     * State elimination over a generalized NFA built from the DFA.
     * @returns {RegexNode}
     */
    static toRegex(dfa) {
        const size = dfa.size;
        const start = size;
        const final = size + 1;
        /** @type {Map<number, Map<number, RegexNode>>} */
        const edges = new Map();
        const setEdge = (from, to, regex) => {
            if (!edges.has(from)) edges.set(from, new Map());
            const row = edges.get(from);
            row.set(to, row.has(to) ? Regex.union([row.get(to), regex]) : regex);
        };

        setEdge(start, dfa.start, Regex.EPSILON);
        dfa.delta.forEach((row, source) => {
            row.forEach((target, symbol) => setEdge(source, target, Regex.symbol(symbol)));
            if (dfa.accept[source]) setEdge(source, final, Regex.EPSILON);
        });

        const remaining = new Set(Array.from({ length: size }, (_, index) => index));
        while (remaining.size > 0) {
            // Eliminate the state with the fewest in*out paths first: it keeps the result short.
            let best = null;
            let bestCost = Infinity;
            for (const state of remaining) {
                let incoming = 0;
                edges.forEach((row, from) => {
                    if (from !== state && row.has(state)) incoming++;
                });
                const outgoing = [...(edges.get(state)?.keys() ?? [])].filter(to => to !== state).length;
                const cost = incoming * outgoing;
                if (cost < bestCost || (cost === bestCost && state > best)) {
                    best = state;
                    bestCost = cost;
                }
            }

            const row = edges.get(best) ?? new Map();
            const loop = row.has(best) ? Regex.star(row.get(best)) : Regex.EPSILON;
            const incoming = [];
            edges.forEach((fromRow, from) => {
                if (from !== best && fromRow.has(best)) incoming.push([from, fromRow.get(best)]);
            });
            for (const [from, into] of incoming) {
                for (const [to, out] of row) {
                    if (to === best) continue;
                    setEdge(from, to, Regex.concat([into, loop, out]));
                }
                edges.get(from).delete(best);
            }
            edges.delete(best);
            remaining.delete(best);
        }
        return edges.get(start)?.get(final) ?? Regex.EMPTY;
    }
}

/**
 * A set of natural numbers that is eventually periodic: explicit membership
 * below `threshold`, then a repeating pattern of length `period`.
 * Every set coming out of a unary DFA run has this shape.
 */
export class NumberSet {
    /**
     * @param {number} threshold
     * @param {number} period
     * @param {boolean[]} prefix Membership of 0..threshold-1.
     * @param {boolean[]} cycle Membership of threshold+j, for j in 0..period-1.
     */
    constructor(threshold, period, prefix, cycle) {
        this.threshold = threshold;
        this.period = period;
        this.prefix = prefix;
        this.cycle = cycle;
        this.normalize();
        this.key = `${this.threshold}:${this.period}:${this.prefix.map(Number).join('')}:${this.cycle.map(Number).join('')}`;
    }

    static single(value) {
        return new NumberSet(value + 1, 1, Array.from({ length: value + 1 }, (_, index) => index === value), [false]);
    }

    /** {start, start + step, start + 2*step, ...} */
    static progression(start, step) {
        return new NumberSet(start, step, new Array(start).fill(false), Array.from({ length: step }, (_, index) => index === 0));
    }

    static fromValues(values) {
        const max = Math.max(...values);
        const members = new Set(values);
        return new NumberSet(max + 1, 1, Array.from({ length: max + 1 }, (_, index) => members.has(index)), [false]);
    }

    has(value) {
        if (value < this.threshold) return this.prefix[value];
        return this.cycle[(value - this.threshold) % this.period];
    }

    /** @param {NumberSet} other */
    union(other) {
        const threshold = Math.max(this.threshold, other.threshold);
        const period = lcm(this.period, other.period);
        const prefix = Array.from({ length: threshold }, (_, index) => this.has(index) || other.has(index));
        const cycle = Array.from({ length: period }, (_, index) => this.has(threshold + index) || other.has(threshold + index));
        return new NumberSet(threshold, period, prefix, cycle);
    }

    normalize() {
        // Smallest period that still describes the repeating part.
        for (let divisor = 1; divisor < this.period; divisor++) {
            if (this.period % divisor !== 0) continue;
            if (this.cycle.every((member, index) => member === this.cycle[index % divisor])) {
                this.cycle = this.cycle.slice(0, divisor);
                this.period = divisor;
                break;
            }
        }
        // Smallest threshold: pull prefix values into the cycle while they follow it.
        while (this.threshold > 0 && this.prefix[this.threshold - 1] === this.cycle[this.period - 1]) {
            this.cycle = [this.cycle[this.period - 1], ...this.cycle.slice(0, this.period - 1)];
            this.threshold--;
            this.prefix = this.prefix.slice(0, this.threshold);
        }
    }

    get isFinite() {
        return this.cycle.every(member => !member);
    }

    /** @returns {number|null} The only member, when the set has exactly one. */
    singleValue() {
        if (!this.isFinite) return null;
        const members = this.prefix.flatMap((member, index) => (member ? [index] : []));
        return members.length === 1 ? members[0] : null;
    }

    /**
     * Writes membership as conditions on a variable.
     * @param {{latex: string, text: string}} variable
     * @returns {{latex: string, text: string}|null} Null when every natural number is a member.
     */
    describe(variable) {
        const v = variable;
        const members = limit => Array.from({ length: limit }, (_, index) => index).filter(index => this.has(index));

        if (this.isFinite) return NumberSet.describeFinite(members(this.threshold), v);

        if (this.threshold === 0 && this.period === 1) return null;

        const residues = [];
        for (let offset = 0; offset < this.period; offset++) {
            if (this.cycle[offset]) residues.push((this.threshold + offset) % this.period);
        }
        residues.sort((first, second) => first - second);

        // Lower bound: the first value from which the periodic rule holds with no gaps.
        let bound = 0;
        for (let value = 0; value < this.threshold; value++) {
            const matchesRule = residues.includes(value % this.period);
            if (matchesRule && !this.has(value)) bound = value + 1;
        }
        while (bound < this.threshold + this.period && !this.has(bound)) bound++;
        // Members the rule does not cover: those below the bound, and (below the
        // threshold) those outside the listed residues.
        const exceptions = members(Math.max(bound, this.threshold))
            .filter(value => value < bound || (this.period > 1 && !residues.includes(value % this.period)));

        const latexParts = [];
        const textParts = [];
        if (this.period > 1) {
            if (residues.length === 1) {
                latexParts.push(`${v.latex} \\bmod ${this.period} = ${residues[0]}`);
                textParts.push(`${v.text} mod ${this.period} = ${residues[0]}`);
            } else if (residues.length === this.period - 1 && this.period > 2) {
                const missing = Array.from({ length: this.period }, (_, index) => index).find(index => !residues.includes(index));
                latexParts.push(`${v.latex} \\bmod ${this.period} \\ne ${missing}`);
                textParts.push(`${v.text} mod ${this.period} ≠ ${missing}`);
            } else {
                latexParts.push(`${v.latex} \\bmod ${this.period} \\in \\{${residues.join(', ')}\\}`);
                textParts.push(`${v.text} mod ${this.period} ∈ {${residues.join(', ')}}`);
            }
        }
        const smallestInRule = this.period === 1 ? 0 : residues[0];
        if (bound > 0 && !(this.period > 1 && bound <= smallestInRule)) {
            latexParts.push(`${v.latex} \\ge ${bound}`);
            textParts.push(`${v.text} ≥ ${bound}`);
        }

        let latex = latexParts.join(',\\ ');
        let text = textParts.join(', ');
        if (exceptions.length > 0) {
            const finite = NumberSet.describeFinite(exceptions, v);
            latex = `(${finite.latex} \\text{ or } ${latex})`;
            text = `(${finite.text} or ${text})`;
        }
        return { latex, text };
    }

    static describeFinite(values, v) {
        if (values.length === 1) return { latex: `${v.latex} = ${values[0]}`, text: `${v.text} = ${values[0]}` };
        const first = values[0];
        const last = values[values.length - 1];
        if (last - first + 1 === values.length) {
            if (first === 0) return { latex: `${v.latex} \\le ${last}`, text: `${v.text} ≤ ${last}` };
            return { latex: `${first} \\le ${v.latex} \\le ${last}`, text: `${first} ≤ ${v.text} ≤ ${last}` };
        }
        return { latex: `${v.latex} \\in \\{${values.join(', ')}\\}`, text: `${v.text} ∈ {${values.join(', ')}}` };
    }
}

function gcd(first, second) {
    return second === 0 ? first : gcd(second, first % second);
}

function lcm(first, second) {
    return (first / gcd(first, second)) * second;
}

/**
 * @typedef {{type: 'empty'}|{type: 'epsilon'}|{type: 'symbol', symbol: string}
 *   |{type: 'concat', parts: RegexNode[]}|{type: 'union', parts: RegexNode[]}
 *   |{type: 'star', inner: RegexNode}} RegexNode
 */

/**
 * Regular-expression trees with simplifying constructors: unions are flattened
 * and deduplicated, ∅ and redundant ε are dropped, nested stars collapse.
 */
export class Regex {
    static EMPTY = Object.freeze({ type: 'empty', key: '∅' });
    static EPSILON = Object.freeze({ type: 'epsilon', key: 'ε' });

    static symbol(symbol) {
        return { type: 'symbol', symbol, key: `s(${symbol})` };
    }

    static nullable(node) {
        switch (node.type) {
            case 'epsilon':
            case 'star':
                return true;
            case 'union':
                return node.parts.some(Regex.nullable);
            case 'concat':
                return node.parts.every(Regex.nullable);
            default:
                return false;
        }
    }

    static union(parts) {
        const flat = [];
        const seen = new Set();
        const add = part => {
            if (part.type === 'union') return part.parts.forEach(add);
            if (part.type === 'empty' || seen.has(part.key)) return;
            seen.add(part.key);
            flat.push(part);
        };
        parts.forEach(add);
        let result = flat;
        if (result.some(part => part.type === 'epsilon') && result.some(part => part.type !== 'epsilon' && Regex.nullable(part))) {
            result = result.filter(part => part.type !== 'epsilon');
        }
        // ε ∪ X X*  =  X*
        if (result.some(part => part.type === 'epsilon')) {
            for (let index = 0; index < result.length; index++) {
                const part = result[index];
                if (part.type !== 'concat' || part.parts.length !== 2) continue;
                const [head, tail] = part.parts;
                if (tail.type === 'star' && tail.inner.key === head.key) {
                    result = result.filter(other => other.type !== 'epsilon');
                    result[result.indexOf(part)] = tail;
                    return Regex.union(result);
                }
            }
        }
        // Put ε last, the way it is usually written.
        result.sort((first, second) => (first.type === 'epsilon') - (second.type === 'epsilon'));
        if (result.length === 0) return Regex.EMPTY;
        if (result.length === 1) return result[0];
        return { type: 'union', parts: result, key: `u(${result.map(part => part.key).join(',')})` };
    }

    static concat(parts) {
        const flat = [];
        for (const part of parts) {
            if (part.type === 'empty') return Regex.EMPTY;
            if (part.type === 'epsilon') continue;
            const pieces = part.type === 'concat' ? part.parts : [part];
            for (const piece of pieces) {
                const previous = flat[flat.length - 1];
                // X* X*  =  X*
                if (previous && previous.type === 'star' && piece.key === previous.key) continue;
                flat.push(piece);
            }
        }
        if (flat.length === 0) return Regex.EPSILON;
        if (flat.length === 1) return flat[0];
        return { type: 'concat', parts: flat, key: `c(${flat.map(part => part.key).join(',')})` };
    }

    static star(inner) {
        if (inner.type === 'empty' || inner.type === 'epsilon') return Regex.EPSILON;
        if (inner.type === 'star') return inner;
        if (inner.type === 'union') {
            // (ε ∪ X ∪ Y*)*  =  (X ∪ Y)*
            const parts = inner.parts.filter(part => part.type !== 'epsilon').map(part => (part.type === 'star' ? part.inner : part));
            const simplified = Regex.union(parts);
            if (simplified.key !== inner.key) return Regex.star(simplified);
        }
        if (inner.type === 'concat' && inner.parts.every(Regex.nullable)) {
            // (X* Y*)*  =  (X ∪ Y)*
            return Regex.star(Regex.union(inner.parts));
        }
        return { type: 'star', inner, key: `*(${inner.key})` };
    }

    static toLatex(node, context = 0) {
        switch (node.type) {
            case 'empty':
                return '\\varnothing';
            case 'epsilon':
                return '\\varepsilon';
            case 'symbol':
                return Symbols.latex(node.symbol);
            case 'union': {
                const body = node.parts.map(part => Regex.toLatex(part, 0)).join(' \\cup ');
                return context > 0 ? `(${body})` : body;
            }
            case 'concat': {
                const body = node.parts.map(part => Regex.toLatex(part, 1)).join(' ');
                return context > 1 ? `(${body})` : body;
            }
            case 'star': {
                const inner = Regex.toLatex(node.inner, 2);
                return `{${inner}}^{*}`;
            }
            default:
                return '';
        }
    }

    static toText(node, context = 0) {
        switch (node.type) {
            case 'empty':
                return '∅';
            case 'epsilon':
                return 'ε';
            case 'symbol':
                return node.symbol;
            case 'union': {
                const body = node.parts.map(part => Regex.toText(part, 0)).join(' ∪ ');
                return context > 0 ? `(${body})` : body;
            }
            case 'concat': {
                const separator = Regex.hasLongSymbol(node) ? ' ' : '';
                const body = node.parts.map(part => Regex.toText(part, 1)).join(separator);
                return context > 1 ? `(${body})` : body;
            }
            case 'star':
                return `${Regex.toText(node.inner, 2)}*`;
            default:
                return '';
        }
    }

    static hasLongSymbol(node) {
        if (node.type === 'symbol') return [...node.symbol].length > 1;
        if (node.type === 'star') return Regex.hasLongSymbol(node.inner);
        if (node.parts) return node.parts.some(Regex.hasLongSymbol);
        return false;
    }
}

/**
 * Formats alphabet symbols for KaTeX and for plain text.
 */
export class Symbols {
    static latex(symbol) {
        if (/^[A-Za-z0-9]$/.test(symbol)) return symbol;
        if (/^\\[A-Za-z]+$/.test(symbol)) return symbol;
        const escaped = [...symbol].map(character => {
            if ('#$%&_{}'.includes(character)) return `\\${character}`;
            if (character === '\\') return '\\textbackslash{}';
            if (character === '~') return '\\textasciitilde{}';
            if (character === '^') return '\\textasciicircum{}';
            return character;
        }).join('');
        return `\\text{${escaped}}`;
    }

    static latexPower(symbol, exponent) {
        const base = Symbols.latex(symbol);
        if (exponent === null) return base;
        return /^[A-Za-z0-9]$/.test(symbol) ? `${base}^{${exponent}}` : `{${base}}^{${exponent}}`;
    }

    static textPower(symbol, exponent) {
        if (exponent === null) return symbol;
        return [...symbol].length > 1 ? `(${symbol})^${exponent}` : `${symbol}^${exponent}`;
    }
}
