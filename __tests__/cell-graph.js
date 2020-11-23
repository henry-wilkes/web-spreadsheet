import { CellGraph } from '../modules/cell-graph.js';

function doCellEntries(graph, ...entries) {
  expect(entries.length % 2).toBe(0);
  for (let i = 0; i < (entries.length / 2); i++) {
    const nodeName = entries[2 * i];
    const entry = entries[(2 * i) + 1];
    graph.setCellEntry(nodeName, entry);
  }
}

describe('cell-graph display', () => {
  function runChangeTest (entries, changes) {
    
    const displayChanges = new Map();
    const graph = new CellGraph('z', '50', displayUpdated);

    function displayUpdated (cellName, displayValue) {
      let changes = displayChanges.get(cellName);
      if (changes === undefined) {
        if (displayValue === '') {
          /* since every cell starts as empty, don't count this */
          return;
        }
        changes = [displayValue];
      } else {
        if (changes[changes.length - 1] === displayValue) {
          return;
        }
        changes.push(displayValue);
      }
      displayChanges.set(cellName, changes);
    }

    changes = new Map(changes);
    doCellEntries(graph, ...entries);
    expect(displayChanges).toStrictEqual(changes);
  }

  test.each([
    [['a4', '7'], [['a4', [7]]]],
    [['a4', 'word'], [['a4', ['word']]]],
    [['a4', '  word'], [['a4', ['  word']]]],
    [['a4', '  word  '], [['a4', ['  word']]]],
    [['a4', '7*7'], [['a4', ['7*7']]]],
    [['a4', '=7*7'], [['a4', [49]]]],
    /* no change since initially empty */
    [['a4', '  '], []],
    /* invalid formula */
    [['a4', '=7 7'], [['a4', [undefined]]]],
    /* ref out of scope */
    [['a4', '=a51'], [['a4', [undefined]]]],
    [['a4', '=sum(a40:a51)'], [['a4', [undefined]]]],
    /* self ref */
    [['a4', '=a4'], [['a4', [undefined]]]],
    [['a4', '=sum(a1:a5)'], [['a4', [undefined]]]],
    /* empty formula */
    [['a4', '='], [['a4', [undefined]]]]
  ])('Setting single node once: %s', runChangeTest);

  test.each([
    [['a4', '7', 'a4', '  7 '], [['a4', [7]]]],
    [['a4', 'word', 'a4', 'word '], [['a4', ['word']]]],
    [['a4', '49', 'a4', '=7*7'], [['a4', [49]]]],
    [['a4', '=7 7', 'a4', '=7*7'], [['a4', [undefined, 49]]]],
    [['a4', '=sum(a4:a6)', 'a4', '=sum(a5:a6)'], [['a4', [undefined, 0]]]]
  ])('Setting single node twice: %s', runChangeTest);

  test.each([
    [['a4', '7', 'a5', '=a4'], [['a4', [7]], ['a5', [7]]]],
    [['a5', '=a4', 'a4', '7'], [['a4', [7]], ['a5', [undefined, 7]]]],
    [['a5', '=a4 + 7', 'a4', '7'], [['a4', [7]], ['a5', [undefined, 14]]]],
    [['a5', '=a4 + 2*a4', 'a4', '7'], [['a4', [7]], ['a5', [undefined, 21]]]],
    [['a4', '7', 'a5', '=sum(a4, 2)', 'a4', '5'],
      [['a4', [7, 5]], ['a5', [9, 7]]]],
    [['a4', 'word', 'a5', '=a4'], [['a4', ['word']], ['a5', [undefined]]]],
    [['a4', '=7*2', 'a5', '=a4+2'], [['a4', [14]], ['a5', [16]]]]
  ])('Setting two nodes: %s', runChangeTest);

  test.each([
    [['a4', '=avg(b1:b3)', 'b1', '10', 'b2', '0', 'b3', '-1'],
      [['a4', [undefined, 10, 5, 3]], ['b1', [10]], ['b2', [0]], ['b3', [-1]]]],
    [['a4', '=b1+2', 'b1', '=b2*2', 'b2', '3', 'b2', '2'],
      [['a4', [undefined, 8, 6]], ['b1', [undefined, 6, 4]], ['b2', [3, 2]]]],
    [['b2', '3', 'a4', '=b1+2', 'b1', '=b2*2', 'b2', '2'],
      [['a4', [undefined, 8, 6]], ['b1', [6, 4]], ['b2', [3, 2]]]]
  ])('Setting multiple: %s', runChangeTest);
});

/* NOTE: relies on internal logic */
function getActiveNode (graph, name) {
  const node = graph.activeCells.get(name);
  expect(node).toBeDefined();
  return node;
}

describe('dependancies', () => {
  test('diamond dependancy', () => {
    const graph = new CellGraph('z', '50', () => {});

    doCellEntries(graph, 'a1', '5', 'a2', '=a1',
      'a3', '=(a1 + 1) * (a1 / (3 + a1))', 'a4', '=a2 + (a2 * -a3)');

    const a1 = getActiveNode(graph, 'a1');
    const a2 = getActiveNode(graph, 'a2');
    const a3 = getActiveNode(graph, 'a3');
    const a4 = getActiveNode(graph, 'a4');

    expect(a1.dependsOn).toStrictEqual(new Set([]));
    expect(a1.dependants).toStrictEqual(new Set([a2, a3]));

    expect(a2.dependsOn).toStrictEqual(new Set([a1]));
    expect(a2.dependants).toStrictEqual(new Set([a4]));

    expect(a3.dependsOn).toStrictEqual(new Set([a1]));
    expect(a3.dependants).toStrictEqual(new Set([a4]));

    expect(a4.dependsOn).toStrictEqual(new Set([a2, a3]));
    expect(a4.dependants).toStrictEqual(new Set([]));
  });
});

function getAllCycles (node) {
  const cycles = [];
  for (const cycle of node.cycles.keys()) {
    cycles.push(cycle);
  }
  return cycles;
}

expect.extend({
  toHaveCycles (node, cmpCycles) {
    let nodeCycles = getAllCycles(node);
    let errMsg;
    if (nodeCycles.length !== cmpCycles.length) {
      errMsg = 'number of cycles do not match';
    } else {
      for (let c = 0; c < cmpCycles.length; c++) {
        const cycle = nodeCycles[c];
        const cmpCycle = cmpCycles[c];

        if (cycle.length !== cmpCycle.length) {
          errMsg = String(c) + 'th cycle lengths do not match';
        } else {
          /* NOTE: any shifted cycle would be fine, but this is awkward to test.
           * Generally: the first node that notices the loop through its
           * setValue will be at the start of the loop. */
          const length = cycle.length;
          for (let i = 0; i < length; i++) {
            if (cycle[i] !== cmpCycle[i]) {
              errMsg = String(c) + 'th cycle, ' + String(i) +
                'th nodes do not match';
              break;
            }
          }
        }
      }
    }
    if (errMsg !== undefined) {
      nodeCycles = nodeCycles.map(c => '[' + (c.map(n => n.name).join()) + ']');
      cmpCycles = cmpCycles.map(c => '[' + c.map(n => n.name).join() + ']');
      console.log(nodeCycles);
      return {
        pass: false,
        message: () => (errMsg + ':\n  ' + String(nodeCycles) +
          '\nvs expected\n  ' + String(cmpCycles))
      };
    } else {
      return {
        pass: true,
        message: () => ('Cycles are equal')
      };
    }
  }
});

describe('dependancy cycles', () => {
  let graph;

  beforeEach(() => {
    graph = new CellGraph('z', '50', () => {});
  });

  test('self ref', () => {
    /* a2 refs itself */
    doCellEntries(graph, 'a1', '5', 'a2', '=a1 + a2', 'a3', '=a2 + 1');

    const a1 = getActiveNode(graph, 'a1');
    const a2 = getActiveNode(graph, 'a2');
    const a3 = getActiveNode(graph, 'a3');

    expect(a1).toHaveCycles([]);
    /* cycle starts with itself and only contains itself */
    expect(a2).toHaveCycles([[a2]]);
    expect(a3).toHaveCycles([]);

    expect(a1.cache).toBe(5);
    expect(a2.cache).toBe(undefined);
    expect(a3.cache).toBe(undefined);

    /* break cycle */
    doCellEntries(graph, 'a2', '=a1+2');

    expect(a1).toHaveCycles([]);
    /* cycle starts with itself and only contains itself */
    expect(a2).toHaveCycles([]);
    expect(a3).toHaveCycles([]);

    expect(a1.cache).toBe(5);
    expect(a2.cache).toBe(7);
    expect(a3.cache).toBe(8);

    /* reform */
    doCellEntries(graph, 'a2', '=a1*a2');

    expect(a1).toHaveCycles([]);
    /* cycle starts with itself and only contains itself */
    expect(a2).toHaveCycles([[a2]]);
    expect(a3).toHaveCycles([]);

    expect(a1.cache).toBe(5);
    expect(a2.cache).toBe(undefined);
    expect(a3.cache).toBe(undefined);
  });

  test('dual ref', () => {
    /* a2 and a3 ref each other */
    doCellEntries(graph, 'a1', '7', 'a2', '=a3 + a1', 'a3', '=a2 + 1',
      'a4', '=a3 / 3');

    const a1 = getActiveNode(graph, 'a1');
    const a2 = getActiveNode(graph, 'a2');
    const a3 = getActiveNode(graph, 'a3');
    const a4 = getActiveNode(graph, 'a4');

    expect(a1).toHaveCycles([]);
    /* cycle starts with itself and only contains itself */
    expect(a2).toHaveCycles([[a3, a2]]);
    expect(a3).toHaveCycles([[a3, a2]]);
    expect(a4).toHaveCycles([]);

    expect(a1.cache).toBe(7);
    expect(a2.cache).toBe(undefined);
    expect(a3.cache).toBe(undefined);
    expect(a4.cache).toBe(undefined);

    /* break the cycle through a2 */
    doCellEntries(graph, 'a2', '=a1 * 2');

    expect(a1).toHaveCycles([]);
    /* cycle starts with itself and only contains itself */
    expect(a2).toHaveCycles([]);
    expect(a3).toHaveCycles([]);
    expect(a4).toHaveCycles([]);

    expect(a1.cache).toBe(7);
    expect(a2.cache).toBe(14);
    expect(a3.cache).toBe(15);
    expect(a4.cache).toBe(5);
  });

  test('triple ref', () => {
    /* a1 and a3 ref selves through a2 */
    doCellEntries(graph, 'a1', '=a2', 'a2', '=a1 / -a3', 'a3', '=2 * (a2 - 1)');

    const a1 = getActiveNode(graph, 'a1');
    const a2 = getActiveNode(graph, 'a2');
    const a3 = getActiveNode(graph, 'a3');

    expect(a1).toHaveCycles([[a2, a1]]);
    /* cycle starts with itself and only contains itself */
    expect(a2).toHaveCycles([[a2, a1], [a3, a2]]);
    expect(a3).toHaveCycles([[a3, a2]]);

    expect(a1.cache).toBe(undefined);
    expect(a2.cache).toBe(undefined);
    expect(a3.cache).toBe(undefined);

    /* break one cycle */
    doCellEntries(graph, 'a1', 'word');

    /* a2 still part of a cycle with a3 cycles */
    expect(a1).toHaveCycles([]);
    expect(a2).toHaveCycles([[a3, a2]]);
    expect(a3).toHaveCycles([[a3, a2]]);

    /* a1 cache still undefined because it is a word */
    expect(a1.cache).toBe(undefined);
    expect(a2.cache).toBe(undefined);
    expect(a3.cache).toBe(undefined);
  });

  test('longer triple ref', () => {
    /* a1 and a4 ref selves through a2 -> a3 */
    doCellEntries(graph, 'a1', '=a2', 'a2', '=-a3', 'a3', '=-sum(a1, a4)',
      'a4', '=a2 * 2');

    const a1 = getActiveNode(graph, 'a1');
    const a2 = getActiveNode(graph, 'a2');
    const a3 = getActiveNode(graph, 'a3');
    const a4 = getActiveNode(graph, 'a4');

    /* break all cycles */
    doCellEntries(graph, 'a3', '=2+2');
    expect(a1).toHaveCycles([]);
    expect(a2).toHaveCycles([]);
    expect(a3).toHaveCycles([]);
    expect(a4).toHaveCycles([]);

    expect(a1.cache).toBe(-4);
    expect(a2.cache).toBe(-4);
    expect(a3.cache).toBe(4);
    expect(a4.cache).toBe(-8);

    /* reform */
    doCellEntries(graph, 'a3', '=-sum(a1, a4)');

    expect(a1).toHaveCycles([[a3, a1, a2]]);
    expect(a2).toHaveCycles([[a3, a1, a2], [a3, a4, a2]]);
    expect(a3).toHaveCycles([[a3, a1, a2], [a3, a4, a2]]);
    expect(a4).toHaveCycles([[a3, a4, a2]]);

    expect(a1.cache).toBe(undefined);
    expect(a2.cache).toBe(undefined);
    expect(a3.cache).toBe(undefined);
    expect(a4.cache).toBe(undefined);

    /* break from different node */
    doCellEntries(graph, 'a2', '=2');

    expect(a1).toHaveCycles([]);
    expect(a2).toHaveCycles([]);
    expect(a3).toHaveCycles([]);
    expect(a4).toHaveCycles([]);

    expect(a1.cache).toBe(2);
    expect(a2.cache).toBe(2);
    expect(a3.cache).toBe(-6);
    expect(a4.cache).toBe(4);

    /* reform */
    doCellEntries(graph, 'a2', '=-a3');

    expect(a1).toHaveCycles([[a2, a3, a1]]);
    expect(a2).toHaveCycles([[a2, a3, a1], [a2, a3, a4]]);
    expect(a3).toHaveCycles([[a2, a3, a1], [a2, a3, a4]]);
    expect(a4).toHaveCycles([[a2, a3, a4]]);

    expect(a1.cache).toBe(undefined);
    expect(a2.cache).toBe(undefined);
    expect(a3.cache).toBe(undefined);
    expect(a4.cache).toBe(undefined);

    /* loose one loop, gain another */
    doCellEntries(graph, 'a3', '=a2 + a4');

    expect(a1).toHaveCycles([]);
    expect(a2).toHaveCycles([[a2, a3, a4], [a3, a2]]);
    expect(a3).toHaveCycles([[a2, a3, a4], [a3, a2]]);
    expect(a4).toHaveCycles([[a2, a3, a4]]);

    expect(a1.cache).toBe(undefined);
    expect(a2.cache).toBe(undefined);
    expect(a3.cache).toBe(undefined);
    expect(a4.cache).toBe(undefined);
  });
});

expect.extend({
  toHaveEntries (graph, entries) {
    expect(entries.length % 2).toBe(0);
    for (let i = 0; i < (entries.length / 2); i++) {
      const nodeName = entries[2 * i];
      const want = entries[(2 * i) + 1];
      let entry = graph.getCellEntry(nodeName);
      if (entry !== null) {
        entry = entry.text;
      }
      if (entry !== want) {
        return {
          pass: false,
          message: () => ('For ' + nodeName + ' expect ' + want + ' but got ' +
            entry)
        };
      }
    }
    return { pass: true, message: () => 'Entries match' };
  }
});

expect.extend({
  toHaveDependencies (graph, entries) {
    expect(entries.length % 2).toBe(0);
    for (let i = 0; i < (entries.length / 2); i++) {
      const nodeName = entries[2 * i];
      const want = entries[(2 * i) + 1];
      let entry = graph.getCellEntry(nodeName);
      if (entry === null || entry.dependsOn === undefined) {
        entry = [];
      } else {
        entry = entry.dependsOn;
      }
      if (entry.length !== want.length) {
        return {
          pass: false,
          message: () => ('For ' + nodeName + ' expected ' +
            String(want.length) + ' dependancies, but got ' +
            String(entry.length) + '. Have: ' + entry.join(', '))
        };
      }

      for (const dep of want) {
        if (!entry.some(d => (d === dep))) {
          return {
            pass: false,
            message: () => ('Expected ' + nodeName + ' to depend on ' + dep +
              ', but found none. Have: ' + entry.join(', '))
          };
        }
      }
    }
    return { pass: true, message: () => 'DependsOn match' };
  }
});

expect.extend({
  toHaveErrors (graph, entries) {
    expect(entries.length % 3).toBe(0);
    for (let i = 0; i < (entries.length / 3); i++) {
      const nodeName = entries[3 * i];
      const wantMessages = entries[(3 * i) + 1];
      const wantParts = entries[(3 * i) + 2];
      const entry = graph.getCellEntry(nodeName);
      if (entry === null || entry.errorRegions === undefined ||
          entry.errorMessages === undefined) {
        return {
          pass: false,
          message: () => ('For ' + nodeName + ' expected an error but got ' +
            'the valid entry: ' + ((entry === null) ? 'null' : entry.text))
        };
      }
      if (entry.errorMessages.length !== wantMessages.length) {
        return {
          pass: false,
          message: () => ('For ' + nodeName + ' expected ' +
            String(wantMessages.length) + ' error messages, but got ' +
            String(entry.errorMessages.length) + '. Have: ' +
            entry.errorMessages.join(', '))
        };
      }
      for (const msg of wantMessages) {
        if (!entry.errorMessages.some(e => (e.match(msg) !== null))) {
          return {
            pass: false,
            message: () => ('For ' + nodeName + ' no error message contains "' +
              msg.source + '". Have: ' + entry.errorMessages.join(', '))
          };
        }
      }
      const parts = [];
      for (const region of entry.errorRegions) {
        parts.push(
          entry.text.slice(region.index, region.index + region.length));
      }

      if (parts.length !== wantParts.length) {
        return {
          pass: false,
          message: () => ('For ' + nodeName + ' expected ' +
            String(wantParts.length) + ' error regions, but got ' +
            String(parts.length) + '. Have: ' + parts.join(', '))
        };
      }

      for (let p = 0; p < parts.length; p++) {
        if (wantParts[p] !== parts[p]) {
          return {
            pass: false,
            message: () => ('For ' + nodeName + ' expected ' + String(p) +
              'th error region to be "' + wantParts[p] + '", but got "' +
              parts[p] + '" instead. Have: ' + parts.join(', '))
          };
        }
      }
    }
    return { pass: true, message: () => 'Errors match' };
  }
});

describe('cell-graph get entries', () => {
  let graph;

  beforeEach(() => {
    graph = new CellGraph('z', '50', () => {});
  });

  test.each([
    [['a3', '7'], ['a3', '7']],
    [['a3', 'word'], ['a3', 'word']],
    [['a3', '  7  '], ['a3', '7']],
    [['a3', 'word  '], ['a3', 'word']],
    [['a3', '  '], ['a3', null]],
    [['a3', ' = 3 *  7'], ['a3', '=3 *  7']],
    [['a3', ' = a2 + 9', 'a2', '5'], ['a3', '=a2 + 9', 'a2', '5']]
  ])('valid entry: %s', (entries, fetch) => {
    doCellEntries(graph, ...entries);
    expect(graph).toHaveEntries(fetch);
  });

  test.each([
    /* invalid formula */
    [['a3', '= 2 a1'], ['a3', [/missing operator/i], ['2 a1']]],
    [['a3', '= 3 * funcy(5 + a3)'], ['a3', [/unknown function/i], ['funcy']]],
    /* empty dependency */
    [['a3', '=a1'], ['a3', [/empty.*a1/i], ['a1']]],
    [['a3', '= 2 + a1'], ['a3', [/empty.*a1/i], ['a1']]],
    /* dependency out of range */
    [['a3', '= sum(a49:a51)'],
      ['a3', [/out of scope.*a51 \(a49:a51\)/i], ['a49:a51']]],
    [['a3', '= sum(a50, 3 + (a51))'],
      ['a3', [/out of scope.*a51/i], ['(a51)']]],
    /* self dependency */
    [['a3', '= sum(a1, a3)'], ['a3', [/self-dependency.*a3/i], ['a3']]],
    [['a3', '= sum(a1:a4)'],
      ['a3', [/self-dependency.*a3 \(a1:a4\)/i], ['a1:a4']]],
    /* depends on undefined */
    [['a3', '= 5 + a2', 'a2', '=a2'],
      ['a3', [/is undetermined.*a2/i], ['a2']]],
    [['a3', '= sum(b1:b5)', 'b1', '=avg()'],
      ['a3', [/is undetermined.*b1 \(b1:b5\)/i], ['b1:b5']]],
    /* function cannot be evaluated */
    [['a3', '= 5 + 4 * (avg() + 9)'],
      ['a3', [/function evaluation is not defined.*avg/i], ['avg()']]],
    [['a3', '= 5 + 4 * (avg(b1:b4) + 9)'],
      ['a3', [/function evaluation is not defined.*avg/i], ['avg(b1:b4)']]],
    /* several */
    [['a3', '= a3 + b4'],
      ['a3', [/self-dependency.*a3/i, /empty.*b4/i], ['a3', 'b4']]],
    [['a3', '= sum(b1:b4) + 3 * b4', 'b4', '=-b4'],
      ['a3', [/is undetermined.*b4 \(b4, b1:b4\)/i], ['b1:b4', 'b4']]],
    [['a3', '= sum(b1:b4) + 3 * b4', 'b4', '=-a3'],
      ['a3', [/self-dependency.*b4 \(b4, b1:b4\)/i], ['b1:b4', 'b4']]]
  ])('invalid entries: %s', (entries, fetch) => {
    doCellEntries(graph, ...entries);
    expect(graph).toHaveErrors(fetch);
  });

  test.each([
    [['a3', '7'], ['a3', []]],
    [['a3', '  '], ['a3', []]],
    [['a3', ' word '], ['a3', []]],
    [['a3', '= 3 * 5'], ['a3', []]],
    [['a3', '= 3 * * 5'], ['a3', []]],
    [['a3', '= a2 + a4'], ['a3', ['a2', 'a4']]],
    [['a3', '= sum(b2:b4, a7)'], ['a3', ['b2', 'b3', 'b4', 'a7']]],
    [['a3', '= sum(b1, a3)'], ['a3', ['b1', 'a3']]],
    [['a3', '= sum(b1:b2, b1) + b1'], ['a3', ['b1', 'b2']]],
    /* don't depend on out of scope */
    [['a3', '= sum(b1) + b51'], ['a3', ['b1']]],
    [['a3', '= -sum(b49:b51) * 7'], ['a3', ['b49', 'b50']]]
  ])('dependencies: %s', (entries, dependencies) => {
    doCellEntries(graph, ...entries);
    expect(graph).toHaveDependencies(dependencies);
  });
});
