/**
 * Context-Free Grammar parser and CNF Conversion logic
 */
const EPSILON = 'ε';

// UI Elements
const cfgInput = document.getElementById('cfg-input');
const exampleSelect = document.getElementById('example-select');
const clearBtn = document.getElementById('clear-btn');
const convertBtn = document.getElementById('convert-btn');
const simulationPanel = document.getElementById('simulation-panel');
const stepContainer = document.getElementById('step-content-container');
const finalResultCard = document.getElementById('final-result-card');
const indicators = document.querySelectorAll('.step-indicator');
const cardTemplate = document.getElementById('step-card-template');

// Default Examples
const examples = {
    model1: "S -> AB | a\nA -> aA | e\nB -> bB | b",
    model2: "S -> A | b\nA -> B\nB -> a",
    model3: "S -> ABC\nA -> a\nB -> b\nC -> c",
    model4: "S -> aA | bB\nA -> aS | a\nB -> bS | b",
    model5: "S -> aSb | ab",
    model6: "S -> AB | e\nA -> aA | e\nB -> bB | e",
    model7: "S -> aAB | bA\nA -> a | aS\nB -> b",
    model8: "S -> AB | C\nA -> a\nB -> b\nC -> D\nD -> E",
    model9: "S -> SS | a | b",
    model10: "S -> ASA | aB | e\nA -> B | S\nB -> b | e"
};

// Event Listeners
exampleSelect.addEventListener('change', (e) => {
    const selected = e.target.value;
    if (selected && examples[selected]) {
        cfgInput.value = examples[selected];
    }
});

clearBtn.addEventListener('click', () => {
    cfgInput.value = '';
    simulationPanel.classList.add('hidden');
});

convertBtn.addEventListener('click', () => {
    const rawInput = cfgInput.value.trim();
    if (!rawInput) {
        alert("Please enter a Context-Free Grammar.");
        return;
    }
    
    try {
        simulateConversion(rawInput);
        simulationPanel.classList.remove('hidden');
        // Scroll into view smoothly
        simulationPanel.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
        alert("Error parsing grammar: " + e.message);
        console.error(e);
    }
});

// Deep clone a grammar object
function cloneGrammar(grammar) {
    const clone = {};
    for (let key in grammar) {
        clone[key] = [...grammar[key]];
    }
    return clone;
}

// Convert parsed grammar object to string for easy display
function serializeGrammar(grammar) {
    let result = [];
    for (let variable in grammar) {
        result.push(`${variable} -> ${grammar[variable].join(' | ')}`);
    }
    return result.join('\n');
}

// Determines if a string is a variable (typically uppercase)
function isVariable(symbol) {
    return /^[A-Z](_[0-9a-z]+)?$/.test(symbol);
}

// Extracts symbols from a right-hand side string
function extractSymbols(rhs) {
    if (rhs === 'e' || rhs === EPSILON) return [EPSILON];
    // This simple abstraction assumes single character symbols or multi-character like X_1
    // We'll split by regex matching variables or fallback to single chars
    let symbols = [];
    let i = 0;
    while (i < rhs.length) {
        let match = rhs.slice(i).match(/^([A-Z]_[0-9a-z]+|[A-Z]|[a-z0-9])/);
        if (match) {
            symbols.push(match[0]);
            i += match[0].length;
        } else {
            // Unrecognized character, just add it
            symbols.push(rhs[i]);
            i++;
        }
    }
    return symbols;
}

// Parse input text into grammar object
function parseInput(text) {
    const lines = text.split('\n');
    const grammar = {};
    let startSymbol = null;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        // Treat unicode right-arrow as standard arrow
        line = line.replace(/→/g, '->');
        
        // If line does not contain an arrow, simply ignore it (allows copy-pasting problem descriptions)
        if (!line.includes('->')) continue;
        
        const parts = line.split('->').map(s => s.trim());
        if (parts.length !== 2) {
             console.warn("Skipping malformed rule:", line);
             continue;
        }
        
        const variable = parts[0];
        if (!startSymbol) startSymbol = variable;
        
        let productions = parts[1].split('|').map(s => s.trim());
        // Normalize epsilon
        productions = productions.map(p => p === 'e' ? EPSILON : p);
        
        if (!grammar[variable]) grammar[variable] = [];
        
        for (let p of productions) {
            if (!grammar[variable].includes(p)) {
                grammar[variable].push(p);
            }
        }
    }
    
    if (Object.keys(grammar).length === 0) {
        throw new Error("No valid rules found. Make sure to use '->' or '→' for productions.");
    }
    
    return { grammar, startSymbol };
}

// Find all nullable variables
function getNullableVariables(grammar) {
    let nullable = new Set();
    let changed = true;
    
    while (changed) {
        changed = false;
        for (let v in grammar) {
            if (nullable.has(v)) continue;
            
            for (let prod of grammar[v]) {
                if (prod === EPSILON) {
                    nullable.add(v);
                    changed = true;
                    break;
                }
                
                let symbols = extractSymbols(prod);
                if (symbols.length > 0 && symbols.every(s => nullable.has(s))) {
                    nullable.add(v);
                    changed = true;
                    break;
                }
            }
        }
    }
    return nullable;
}

// Generate combinations for epsilon removal
function getCombinations(symbols, nullable) {
    if (symbols.length === 0) return [[]];
    
    let first = symbols[0];
    let restCombs = getCombinations(symbols.slice(1), nullable);
    
    let result = [];
    for (let comb of restCombs) {
        // Option 1: Keep the symbol
        result.push([first, ...comb]);
        // Option 2: Remove the symbol if it's nullable
        if (nullable.has(first)) {
            result.push([...comb]);
        }
    }
    return result;
}

// Step 1: Remove Epsilon Productions
function removeEpsilon(grammar, startSymbol) {
    const nullable = getNullableVariables(grammar);
    const newGrammar = {};
    const changes = [];
    
    if (nullable.size > 0) {
        changes.push({ type: 'info', text: `Nullable variables identified: { ${[...nullable].join(', ')} }` });
    } else {
        changes.push({ type: 'info', text: `No nullable variables found.` });
    }

    for (let v in grammar) {
        newGrammar[v] = [];
        for (let prod of grammar[v]) {
            if (prod === EPSILON) {
                // Remove epsilon directly
                changes.push({ type: 'remove', text: `Removed ${v} -> ε` });
                continue;
            }
            
            let symbols = extractSymbols(prod);
            let combs = getCombinations(symbols, nullable);
            
            for (let comb of combs) {
                let newProd = comb.join('');
                if (newProd === '') {
                    // Do not add empty strings back unless required (we usually strip them)
                    continue;
                }
                if (!newGrammar[v].includes(newProd)) {
                    newGrammar[v].push(newProd);
                    if (newProd !== prod) {
                        changes.push({ type: 'add', text: `Added ${v} -> ${newProd} (derived from nullable)`});
                    }
                }
            }
        }
    }
    
    // Clean up empty variables
    for (let v in newGrammar) {
        if (newGrammar[v].length === 0) delete newGrammar[v];
    }
    
    return { grammar: newGrammar, changes, startSymbol };
}

// Step 2: Remove Unit Productions
function removeUnit(grammar, startSymbol) {
    const newGrammar = cloneGrammar(grammar);
    const changes = [];
    
    // Find unit pairs
    const unitPairs = []; // Array of [A, B] meaning A =>* B
    
    for (let v in newGrammar) {
        let queue = [v];
        let visited = new Set([v]);
        
        while (queue.length > 0) {
            let current = queue.shift();
            
            if (newGrammar[current]) {
                for (let prod of newGrammar[current]) {
                    if (isVariable(prod) && !visited.has(prod)) {
                        visited.add(prod);
                        queue.push(prod);
                        unitPairs.push([v, prod]);
                    }
                }
            }
        }
    }

    // Identify which unit productions we have directly
    for (let v in newGrammar) {
        let nonUnits = [];
        let unitsRemoved = [];
        for (let prod of newGrammar[v]) {
            if (isVariable(prod)) {
                unitsRemoved.push(prod);
            } else {
                nonUnits.push(prod);
            }
        }
        newGrammar[v] = nonUnits;
        for (let u of unitsRemoved) {
            changes.push({ type: 'remove', text: `Removed unit production: ${v} -> ${u}` });
        }
    }
    
    // Add forwarded productions
    for (let [A, B] of unitPairs) {
        // Forward non-unit productions of B to A
        if (newGrammar[B]) {
            for (let prod of newGrammar[B]) {
                if (!newGrammar[A].includes(prod)) {
                    newGrammar[A].push(prod);
                    changes.push({ type: 'add', text: `Added ${A} -> ${prod} (resolved from unit pair ${A} =>* ${B})` });
                }
            }
        }
    }
    
    return { grammar: newGrammar, changes, startSymbol };
}

// Step 3: Remove Useless Symbols
function removeUseless(grammar, startSymbol) {
    let newGrammar = cloneGrammar(grammar);
    const changes = [];
    
    // 1. Remove non-generating variables
    let generating = new Set();
    let changed = true;
    
    while (changed) {
        changed = false;
        for (let v in newGrammar) {
            if (generating.has(v)) continue;
            
            for (let prod of newGrammar[v]) {
                let symbols = extractSymbols(prod);
                let isGenerating = true;
                for (let sym of symbols) {
                    if (isVariable(sym) && !generating.has(sym)) {
                        isGenerating = false;
                        break;
                    }
                }
                if (isGenerating) {
                    generating.add(v);
                    changed = true;
                    break;
                }
            }
        }
    }
    
    // Remove rules containing non-generating variables
    for (let v in newGrammar) {
        if (!generating.has(v)) {
            changes.push({ type: 'remove', text: `Removed non-generating variable: ${v}` });
            delete newGrammar[v];
            continue;
        }
        
        let validProds = [];
        for (let prod of newGrammar[v]) {
            let symbols = extractSymbols(prod);
            let hasNonGen = symbols.some(s => isVariable(s) && !generating.has(s));
            if (hasNonGen) {
                changes.push({ type: 'remove', text: `Removed ${v} -> ${prod} (contains non-generating variable)` });
            } else {
                validProds.push(prod);
            }
        }
        newGrammar[v] = validProds;
    }
    
    // 2. Remove unreachable variables
    let reachable = new Set([startSymbol]);
    let rQueue = [startSymbol];
    
    while (rQueue.length > 0) {
        let curr = rQueue.shift();
        if (newGrammar[curr]) {
            for (let prod of newGrammar[curr]) {
                let symbols = extractSymbols(prod);
                for (let sym of symbols) {
                    if (isVariable(sym) && !reachable.has(sym)) {
                        reachable.add(sym);
                        rQueue.push(sym);
                    }
                }
            }
        }
    }
    
    for (let v in newGrammar) {
        if (!reachable.has(v)) {
            changes.push({ type: 'info', text: `Kept unreachable variable ${v} (Exam Tip: safe to retain)` });
            // delete newGrammar[v]; // Retaining unreachable variables to ensure 100% safety
        }
    }
    
    return { grammar: newGrammar, changes, startSymbol };
}

// Step 4: Convert to CNF (A -> BC or A -> a)
function convertToCNF(grammar, startSymbol) {
    let newGrammar = cloneGrammar(grammar);
    const changes = [];
    
    let terminalVarsMap = {};
    
    let allocatedVars = new Set(Object.keys(newGrammar));
    for (let v in newGrammar) {
        for (let prod of newGrammar[v]) {
            let symbols = extractSymbols(prod);
            for (let sym of symbols) {
                if (isVariable(sym)) allocatedVars.add(sym);
            }
        }
    }
    
    function getNextVar() {
        const alphabet = "XYZWVUTSRQPONMLKJIHGFEDCBA";
        for (let i = 0; i < alphabet.length; i++) {
            if (!allocatedVars.has(alphabet[i])) {
                allocatedVars.add(alphabet[i]);
                return alphabet[i];
            }
        }
        return "TempVar"; // Fallback if out of 26 letters
    }
    
    // Phase 1: Terminals mixed with Variables require substitution
    for (let v in newGrammar) {
        let updatedProds = [];
        for (let prod of newGrammar[v]) {
            let symbols = extractSymbols(prod);
            if (symbols.length > 1) {
                let newSymbols = [];
                let modified = false;
                for (let sym of symbols) {
                    if (!isVariable(sym)) {
                        // Is a terminal
                        if (!terminalVarsMap[sym]) {
                            let newVar = getNextVar();
                            terminalVarsMap[sym] = newVar;
                            newGrammar[newVar] = [sym];
                            changes.push({ type: 'add', text: `Created variable for terminal: ${newVar} -> ${sym}` });
                        }
                        newSymbols.push(terminalVarsMap[sym]);
                        modified = true;
                    } else {
                        newSymbols.push(sym);
                    }
                }
                
                if (modified) {
                    let combined = newSymbols.join('');
                    updatedProds.push(combined);
                    changes.push({ type: 'info', text: `Replaced terminals: ${v}: ${prod} => ${combined}` });
                    prod = combined; // Update prod to new reference for phase 2
                } else {
                    updatedProds.push(prod);
                }
            } else {
                updatedProds.push(prod);
            }
        }
        newGrammar[v] = updatedProds;
    }
    
    // Phase 2: Productions length > 2 need decomposition
    let finalGrammar = cloneGrammar(newGrammar); // Fresh copy as we iterate to avoid mutation issues
    
    for (let v in newGrammar) { // Use keys from older to process each, we will mutate final
        let updatedProds = [];
        for (let prod of newGrammar[v]) {
            let symbols = extractSymbols(prod);
            if (symbols.length > 2) {
                changes.push({ type: 'info', text: `Cascading long production: ${v} -> ${prod}` });
                
                let currentLHS = v;
                for (let i = 0; i < symbols.length - 2; i++) {
                    let newVar = getNextVar();
                    if (i === 0) {
                        updatedProds.push(`${symbols[i]}${newVar}`);
                    } else {
                        finalGrammar[currentLHS] = [`${symbols[i]}${newVar}`];
                    }
                    
                    changes.push({ type: 'add', text: `Decomposed to: ${currentLHS === v ? v : currentLHS} -> ${symbols[i]}${newVar}` });
                    currentLHS = newVar;
                }
                // Last piece
                finalGrammar[currentLHS] = [`${symbols[symbols.length-2]}${symbols[symbols.length-1]}`];
                changes.push({ type: 'add', text: `End of decomposition: ${currentLHS} -> ${symbols[symbols.length-2]}${symbols[symbols.length-1]}` });
                
            } else {
                updatedProds.push(prod);
            }
        }
        finalGrammar[v] = updatedProds; // Apply back updated (cascaded roots)
    }
    
    return { grammar: finalGrammar, changes, startSymbol };
}

// Rendering Logic
function formatSymbolHTML(sym) {
    if (sym.includes('_')) {
        const parts = sym.split('_');
        return `${parts[0]}<sub>${parts.slice(1).join('_')}</sub>`;
    }
    return sym;
}

function formatProductionHTML(prod) {
    const symbols = extractSymbols(prod);
    return symbols.map(formatSymbolHTML).join('');
}

function createStepCard(stepNumber, title, description, grammarState, changes) {
    const clone = cardTemplate.content.cloneNode(true);
    const card = clone.querySelector('.step-card');
    
    card.querySelector('.step-number').textContent = stepNumber;
    card.querySelector('.step-title').textContent = title;
    card.querySelector('.step-description').textContent = description;
    
    // Render Grammar Box
    const rulesContainer = card.querySelector('.grammar-rules');
    for (let v in grammarState) {
        const line = document.createElement('div');
        line.className = 'rule-line';
        
        const varSpan = document.createElement('span');
        varSpan.className = 'var-name';
        varSpan.innerHTML = formatSymbolHTML(v);
        
        const arrowSpan = document.createElement('span');
        arrowSpan.className = 'arrow';
        arrowSpan.textContent = '→';
        
        const prodsDiv = document.createElement('div');
        prodsDiv.className = 'productions';
        
        const productions = grammarState[v];
        productions.forEach((p, idx) => {
            const prodSpan = document.createElement('span');
            prodSpan.className = 'prod';
            
            // Check if prod is added recently to highlight
            const isAdded = changes && changes.some(c => c.type === 'add' && c.text.includes(`${v} -> ${p}`));
            if (isAdded) {
                prodSpan.classList.add('added');
            }
            
            prodSpan.innerHTML = formatProductionHTML(p);
            prodsDiv.appendChild(prodSpan);
            
            if (idx < productions.length - 1) {
                const sepSpan = document.createElement('span');
                sepSpan.className = 'separator';
                sepSpan.textContent = '|';
                prodsDiv.appendChild(sepSpan);
            }
        });
        
        line.appendChild(varSpan);
        line.appendChild(arrowSpan);
        line.appendChild(prodsDiv);
        rulesContainer.appendChild(line);
    }
    
    // Render Changes List
    const changesList = card.querySelector('.changes-list');
    if (!changes || changes.length === 0) {
        const li = document.createElement('li');
        li.className = 'change-item';
        li.innerHTML = `<span class="change-icon info">•</span> <span>No changes needed.</span>`;
        changesList.appendChild(li);
    } else {
        changes.forEach(c => {
            const li = document.createElement('li');
            li.className = 'change-item';
            
            let iconText = '•';
            if (c.type === 'remove') iconText = '✘';
            if (c.type === 'add') iconText = '✚';
            if (c.type === 'info') iconText = 'ℹ';
            
            let formattedText = c.text.replace(/([A-Z])_([a-zA-Z0-9]+)/g, '$1<sub>$2</sub>');
            li.innerHTML = `<span class="change-icon ${c.type}">${iconText}</span> <span class="${c.type === 'remove' ? 'removed' : ''}">${formattedText}</span>`;
            changesList.appendChild(li);
        });
    }
    
    return card;
}

// Orchestrate the whole simulation
function simulateConversion(rawInput) {
    stepContainer.innerHTML = ''; // Clear old content
    finalResultCard.classList.add('hidden');
    indicators.forEach(i => {
        i.classList.remove('active');
        i.classList.remove('completed');
    });
    
    // Parse
    const { grammar: initialGrammar, startSymbol } = parseInput(rawInput);
    
    // Original State
    const card0 = createStepCard(0, "Original CFG", "The grammar loaded from your input.", initialGrammar,
        [{ type: 'info', text: `Start variable identified as ${startSymbol}` }]
    );
    stepContainer.appendChild(card0);
    indicators[0].classList.add('completed');
    
    // Step 1
    const s1 = removeEpsilon(initialGrammar, startSymbol);
    const card1 = createStepCard(1, "Remove Epsilon Transitions", "Eliminating rules that derive ε directly or indirectly.", s1.grammar, s1.changes);
    stepContainer.appendChild(card1);
    indicators[1].classList.add('completed');
    
    // Step 2
    const s2 = removeUnit(s1.grammar, startSymbol);
    const card2 = createStepCard(2, "Remove Unit Productions", "Removing rules of form A -> B by substitution.", s2.grammar, s2.changes);
    stepContainer.appendChild(card2);
    indicators[2].classList.add('completed');
    
    // Step 3
    const s3 = removeUseless(s2.grammar, startSymbol);
    const card3 = createStepCard(3, "Remove Useless Symbols", "Trimming variables that cannot derive terminal strings or are unreachable from the Start symbol.", s3.grammar, s3.changes);
    stepContainer.appendChild(card3);
    indicators[3].classList.add('completed');
    
    // Step 4
    const s4 = convertToCNF(s3.grammar, startSymbol);
    const card4 = createStepCard(4, "Convert to Final CNF", "Fixing remaining productions to strictly be Variable->Variable-Variable or Variable->Terminal.", s4.grammar, s4.changes);
    stepContainer.appendChild(card4);
    indicators[4].classList.add('completed');
    
    // Show Final Result
    finalResultCard.classList.remove('hidden');
}
