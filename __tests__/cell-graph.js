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
    [['a4', '=sum(a4:a6)', 'a4', '=sum(a5:a6)'], [['a4', [undefined, 0]]]],
  ])('Setting single node twice: %s', runChangeTest);

  test.each([
    [['a4', '7', 'a5', '=a4'], [['a4', [7]], ['a5', [7]]]],
    [['a5', '=a4', 'a4', '7'], [['a4', [7]], ['a5', [null, 7]]]],
    [['a5', '=a4 + 7', 'a4', '7'], [['a4', [7]], ['a5', [undefined, 14]]]],
    [['a5', '=a4 + 2*a4', 'a4', '7'], [['a4', [7]], ['a5', [undefined, 21]]]],
    [['a4', '7', 'a5', '=sum(a4, 2)', 'a4', '5'],
      [['a4', [7, 5]], ['a5', [9, 7]]]],
    [['a4', 'word', 'a5', '=a4'], [['a4', ['word']], ['a5', [undefined]]]],
    [['a4', '=7*2', 'a5', '=a4+2'], [['a4', [14]], ['a5', [16]]]],
  ])('Setting two nodes: %s', runChangeTest);

  test.each([
    [['a4', '=avg(b1:b3)', 'b1', '10', 'b2', '0', 'b3', '-1'],
      [['a4', [undefined, 10, 5, 3]], ['b1', [10]], ['b2', [0]], ['b3', [-1]]]],
    [['a4', '=b1+2', 'b1', '=b2*2', 'b2', '3', 'b2', '2'],
      [['a4', [undefined, 8, 6]], ['b1', [undefined, 6, 4]], ['b2', [3, 2]]]],
    [['b2', '3', 'a4', '=b1+2', 'b1', '=b2*2', 'b2', '2'],
      [['a4', [undefined, 8, 6]], ['b1', [6, 4]], ['b2', [3, 2]]]],
  ])('Setting multiple: %s', runChangeTest);
});

/* NOTE: relies on internal logic */
function getActiveNode(graph, name) {
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

function getAllCycles(node) {
  const cycles = [];
  for (const cycle of node.cycles.keys()) {
    cycles.push(cycle);
  }
  return cycles;
}

expect.extend({
  toHaveCycles(node, cmpCycles) {
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
