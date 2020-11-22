import * as Tree from './formula-tree.js';

function setMinus (setA, setB) {
  const diff = new Set();
  for (const el of setA) {
    if (!setB.has(el)) {
      diff.add(el);
    }
  }
  return diff;
}

function findCyclesFrom (node, path, cycles) {
  if (node === path[0]) {
    /* a new cycle */
    cycles.push(path.slice());
    /* end traversal */
    return;
  } else if (path.includes(node)) {
    /* in a cycle, but not one containing the origin */
    return;
  }

  path.push(node);
  for (const depOn of node.dependsOn) {
    findCyclesFrom(depOn, path, cycles);
  }
  path.pop();
}

function deriveDependOn (formulaNode, dependSet) {
  if (formulaNode instanceof Tree.Formula) {
    for (const node of formulaNode.args) {
      deriveDependOn(node, dependSet);
    }
  } else if (formulaNode instanceof CellNodeRef) {
    dependSet.add(formulaNode.cellNode);
  }
}

function evaluateFormula (formulaNode) {
  if (formulaNode instanceof Tree.Formula) {
    /* NOTE: the cache for the arguments might be outdated, e.g.
     *
     *     A
     *   /   \
     *  B     C
     *   \   /
     *     D
     *
     * A depends on B and C.
     * B depends on D.
     * C depends on D.
     *
     * If D is updated, this will trigger B.updateCache(), which will trigger
     * A.updateCache() *before* C's cache has been updated. However, we will
     * still eventually call C.updateCache(), which will trigger another call
     * to A.updateCache.
     *
     * We could determine a total order to only do one evaluation per node,
     * but this order would have to be recalculated for the whole graph when
     * it is updated. Plus, we expect the graph structure to be mostly
     * tree-like and shallow, so these extra calculations aren't too
     * expensive.
     */
    const args = formulaNode.args;
    const length = args.length;
    const argVals = new Array(length);
    for (let i = 0; i < length; i++) {
      const val = evaluateFormula(args[i]);
      if (val === undefined) {
        /* NOTE: this prevents us visiting the sibling nodes */
        return undefined;
      }
      argVals[i] = val;
    }
    return formulaNode.func(...argVals);
  }
  if (typeof formulaNode === 'number') {
    return formulaNode;
  }
  if (formulaNode instanceof CellNodeRef) {
    const cellNode = formulaNode.cellNode;
    if (cellNode === null) {
      return undefined;
    }
    return cellNode.cache;
  }
  console.error('Unexpected ' + formulaNode.constructor.name + ' type ' +
    'formulaNode');
  return undefined;
}

class CellNodeRef {
  constructor (cellNode, index, length) {
    this.cellNode = cellNode;
    this.index = index;
    this.length = length;
  }
}

class InvalidFormula {
  constructor (formulaText, parseError) {
    this.index = parseError.index;
    this.length = parseError.length;
    this.message = parseError.message;
    this.text = formulaText;
  }
}

class StaticFormula {
  constructor (formulaText, value) {
    this.text = formulaText;
    this.value = value;
  }
}

class DynamicFormula {
  constructor (formulaText) {
    this.text = formulaText;
  }
}

function isFormula (entry) {
  return (entry instanceof DynamicFormula ||
          entry instanceof StaticFormula ||
          entry instanceof InvalidFormula);
}

function isDynamic (value) {
  return (value instanceof Tree.Formula || value instanceof CellNodeRef);
}

class CellNode {
  constructor (name, value, dynamicCacheChangedCallback, inactiveCallback) {
    /* which nodes depend on our value */
    this.name = name;
    this.dependants = new Set();
    this.dependsOn = new Set();
    this.cycles = new Map();
    this.cache = undefined;
    this.value = undefined;
    this.isDynamic = undefined;
    this.inactiveCallback = inactiveCallback;
    this.dynamicCacheChangedCallback = dynamicCacheChangedCallback;
    this.initing = true;
    this.setValue(value);
    this.initing = false;
  }

  testInactive () {
    if (this.isFormula === false && this.dependants.size === 0 &&
        this.dependsOn.size === 0 && this.initing === false) {
      this.inactiveCallback(this);
    }
  }

  addDependant (depNode) {
    this.dependants.add(depNode);
  }

  removeDependant (depNode) {
    if (this.dependants.delete(depNode) === true) {
      this.testInactive();
    } else {
      throw new Error(depNode.name + ' is not a dependant of ' + this.name);
    }
  }

  removeCycle (cycle) {
    if (this.cycles.delete(cycle) !== true) {
      throw new Error(this.name + ' is missing the cycle ' +
        String(cycle.map(n => n.name)));
    }
  }

  addCycle (nextNode, cycle) {
    this.cycles.set(cycle, nextNode);
  }

  updateCache () {
    const prevCache = this.cache;
    const value = this.value;

    if (this.isDynamic === true) {
      if (this.cycles.size !== 0) {
        /* self reference */
        this.cache = undefined;
      } else {
        this.cache = evaluateFormula(this.value);
      }
    } else if (typeof value === 'number') {
      this.cache = value;
    } else if (value instanceof StaticFormula) {
      this.cache = value.value;
    } else if (value === null) {
      /* empty cell, can be safely ignored by some methods */
      this.cache = null;
    } else {
      /* strings, InvalidFormulas */
      this.cache = undefined;
    }
    /* NOTE: if we have a cycle, each element in the cycle will become
     * undefined, which breaks the cycles from continuing at this point */
    if (this.cache !== prevCache) {
      if (this.isDynamic === true) {
        this.dynamicCacheChangedCallback(this);
      }
      for (const dep of this.dependants) {
        dep.updateCache();
      }
    }
  }

  setValue (value) {
    const prevValue = this.value;
    if (value === prevValue) {
      /* NOTE: we could do comparison of Formula trees */
      return;
    }
    this.value = value;
    this.isDynamic = isDynamic(value);

    const newDependsOn = new Set();
    deriveDependOn(value, newDependsOn);

    const prevDependsOn = this.dependsOn;
    this.dependsOn = newDependsOn;

    const gainedDepsOn = setMinus(newDependsOn, prevDependsOn);
    const lostDepsOn = setMinus(prevDependsOn, newDependsOn);

    for (const lost of lostDepsOn) {
      if (lost !== null) {
        lost.removeDependant(this);
      }
    }
    for (const gained of gainedDepsOn) {
      if (gained !== null) {
        gained.addDependant(this);
      }
    }

    /* all cycles that travelled from *this* node to a lost node have now been
     * broken */
    this.cycles.forEach((nextNode, cycle) => {
      /* nextNode points to the node after *this* node in the cycle, so it
       * can be compared against the lost dependencies */
      if (lostDepsOn.has(nextNode)) {
        /* cycle is broken */
        for (const node of cycle) {
          /* when called on *this* node, method will delete the cycle from the
           * map we are iterating over, but this should be safe according to Map
           * forEach specification */
          node.removeCycle(cycle);
        }
      }
    });

    /* check for created cycles */
    for (const gained of gainedDepsOn) {
      if (gained === null) {
        continue;
      }
      const foundCycles = [];
      findCyclesFrom(gained, [this], foundCycles);
      /* these are new cycles */
      for (const cycle of foundCycles) {
        const cycleLength = cycle.length;
        let node = cycle[0];
        for (let i = 0; i < cycleLength; i++) {
          const nextNode = cycle[(i + 1) % cycleLength];
          node.addCycle(nextNode, cycle);
          node = nextNode;
        }
      }
    }

    this.updateCache([]);
    this.testInactive();
  }
}

const numberRe = /^\s*-?[0-9]+(\.[0-9]+)?\s*$/;
const formulaRe = /^\s*=/;

function columnToNum (column) {
  /* base-36, note that we are wasting the first 0-9 digits */
  return parseInt(column, 36);
}

class CellGraph {
  constructor (maxCol, maxRow, cellDisplayUpdateCallback) {
    this.activeCells = new Map();
    this.cellEntries = new Map();
    this.minRow = 1;
    this.maxRow = Number(maxRow);
    this.minCol = columnToNum('a');
    this.maxCol = columnToNum(maxCol);
    this.cellDisplayUpdateCallback = cellDisplayUpdateCallback;
  }

  cellInScope (cellCol, cellRow) {
    const col = columnToNum(cellCol);
    const row = Number(cellRow);
    return (row >= this.minRow && row <= this.maxRow &&
      col >= this.minCol && col <= this.maxCol);
  }

  dynamicCellCacheChangedCB (cellNode) {
    this.cellDisplayUpdateCallback(cellNode.name, cellNode.cache);
  }

  activeCellInactiveCB (cellNode) {
    /* drop as an active cell */
    this.activeCells.delete(cellNode.name);
    /* if empty cell drop completely since we haven't stored it in our
     * entry */
  }

  createActiveCell (cellName, value) {
    const cell = new CellNode(cellName, value,
      this.dynamicCellCacheChangedCB.bind(this),
      this.activeCellInactiveCB.bind(this));
    this.activeCells.set(cellName, cell);
    return cell;
  }

  getActiveCell (cellCol, cellRow) {
    if (!this.cellInScope(cellCol, cellRow)) {
      return null;
    }
    const cellName = cellCol + cellRow;
    let cell = this.activeCells.get(cellName);
    if (cell === undefined) {
      let value = this.cellEntries.get(cellName);
      if (value === undefined) {
        /* create an active cellNode with empty content, but don't store this in
         * our cellEntries */
        value = null;
      }
      /* currently isolated */
      cell = this.createActiveCell(cellName, value);
    }
    return cell;
  }

  convertFormulaTree (formulaNode) {
    if (formulaNode instanceof Tree.Formula) {
      const args = formulaNode.args;
      for (let i = 0; i < args.length; i++) {
        const arg = this.convertFormulaTree(args[i]);
        if (arg instanceof Array) {
          args.splice(i, 1, ...arg);
          i += (arg.length - 1);
        } else {
          args[i] = arg;
        }
      }
      /* fallthrough to return self */
    } else if (formulaNode instanceof Tree.Reference) {
      const cell = this.getActiveCell(formulaNode.refCol, formulaNode.refRow);
      return new CellNodeRef(cell, formulaNode.index, formulaNode.length);
    } else if (formulaNode instanceof Tree.ReferenceRange) {
      const rowStart = Number(formulaNode.rowStart);
      const rowEnd = Number(formulaNode.rowEnd);
      const col = formulaNode.refCol;
      const expanded = [];
      for (let row = rowStart; row <= rowEnd; row++) {
        const cell = this.getActiveCell(col, String(row));
        expanded.push(
          new CellNodeRef(cell, formulaNode.index, formulaNode.length));
      }
      return expanded;
    }
    return formulaNode;
  }

  displayValue (activeCell, cellEntry) {
    if (cellEntry instanceof DynamicFormula) {
      /* activeCell being undefined is unexpected since all DynamicFormula cells
       * should have a corresponding activeCell */
      return activeCell.cache;
    } else if (cellEntry instanceof InvalidFormula) {
      return undefined;
    } else if (cellEntry instanceof StaticFormula) {
      return cellEntry.value;
    } else if (cellEntry === null) {
      return '';
    } else {
      return cellEntry;
    }
  }

  setCellEntry (cellName, text) {
    let cellEntry;
    let cellValue = undefined;
    let activeCell = this.activeCells.get(cellName);
    let prevCellEntry = this.cellEntries.get(cellName);
    if (prevCellEntry === undefined) {
      prevCellEntry = null;
    }
    const prevDisplay = this.displayValue(activeCell, prevCellEntry);

    if (text.match(formulaRe) !== null) {
      const formulaText = text.replace(formulaRe, '').trim();
      if (isFormula(prevCellEntry) && prevCellEntry.text === formulaText) {
        /* no change */
        return;
      }

      let formula;
      let parseError = undefined;
      try {
        formula = Tree.parseFormula(formulaText);
      } catch (err) {
        if (err instanceof Tree.ParseError) {
          parseError = err;
        } else {
          throw err;
        }
      }

      if (parseError !== undefined) {
        cellEntry = new InvalidFormula(formulaText, parseError);
      } else {
        formula = this.convertFormulaTree(formula);
        /* our activeCell may have been created when we converted the
         * formula. In particular, if we create a self reference */
        activeCell = this.activeCells.get(cellName);
        if (isDynamic(formula)) {
          cellValue = formula;
          cellEntry = new DynamicFormula(formulaText);
          if (activeCell === undefined) {
            activeCell = this.createActiveCell(cellName, cellValue);
          }
        } else {
          cellEntry = new StaticFormula(formulaText, formula);
        }
      }
    } else if (text.match(numberRe) !== null) {
      /* loose unsupported precision */
      cellEntry = Number(text);
    } else {
      /* allow whitespace at the start, but not the end because it is usually
       * not visible */
      /* in particular, this will make whitespace-only entries empty */
      cellEntry = text.trimEnd();
      if (cellEntry === '') {
        cellEntry = null;
      }
    }

    if (activeCell !== undefined) {
      /* activeCell may become inactive if it is no longer a Formula and not
       * depended on. In which case it has been removed from the activeCells
       * map. Safe to still refer to activeCell in this.displayValue. */
      if (cellValue === undefined) {
        cellValue = cellEntry;
      }
      activeCell.setValue(cellValue);
    }

    if (cellEntry === null) {
      /* don't track empty cells */
      this.cellEntries.delete(cellName);
    } else {
      this.cellEntries.set(cellName, cellEntry);
    }

    const display = this.displayValue(activeCell, cellEntry);

    if (prevDisplay !== display) {
      /* NOTE: for DynamicFormula entries, setValue *may* change the cache of
       * the corresponding activeCell, which triggers the same callback.
       * However, it may not be called if the value of the value of its cache
       * does not change. E.g. it changes from a string value to a Formula with
       * undefined dependencies. In this case, the cache has stayed the same,
       * but the display has changed. It should be safe to call the callback
       * twice */
      this.cellDisplayUpdateCallback(cellName, display);
    }
  }
}

export { CellGraph };
