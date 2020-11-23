import * as Tree from '../modules/formula-tree.js';

const negate = Tree.unaryOperatorFunctions['-'];
const add = Tree.binaryOperatorFunctions['+'];
const minus = Tree.binaryOperatorFunctions['-'];
const multiply = Tree.binaryOperatorFunctions['*'];
const divide = Tree.binaryOperatorFunctions['/'];
const sum = Tree.namedFunctions['sum'];
const avg = Tree.namedFunctions['avg'];

describe('operator arithmetic', () => {
  test.each([
    ['2 + 3', 2 + 3],
    ['11 + -7', 11 + -7],
    ['-3 + 8', -3 + 8],
    ['-2 + -9', -2 + -9],
    ['4 - 7', 4 - 7],
    ['6 - -3', 6 - -3],
    ['-1 - 4', -1 - 4],
    ['-3 - -7', -3 - -7],
    ['2 * 3', 2 * 3],
    ['-5 * 4', -5 * 4],
    ['2.5 * -12', 2.5 * -12],
    ['-3.2 * -5', -3.2 * -5],
    ['5 / 2', 5 / 2],
    ['-3 / 4', -3 / 4],
    ['12 / -4', 12 / -4],
    ['-4 / -5', -4 / -5]
  ])('basic: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toBe(res);
  });

  test.each([
    /* - and + have same priority, left to right */
    ['2 - 3 + 4', 2 - 3 + 4],
    ['2 + 3 - 4', 2 + 3 - 4],
    /* unary operator does not change this */
    ['-2 - 3 + 4', -2 - 3 + 4],
    ['-2 + 3 - 4', -2 + 3 - 4],
    ['2 - -3 + 4', 2 - -3 + 4],
    ['2 + -3 - 4', 2 + -3 - 4],
    ['2 - 3 + -4', 2 - 3 + -4],
    ['2 + 3 - -4', 2 + 3 - -4],
    /* / and * have same priority, left to right */
    ['3 / 2 * 4', 3 / 2 * 4],
    ['3 * 2 / 4', 3 * 2 / 4],
    /* unary operator does not change this */
    ['-3 / 2 * 4', -3 / 2 * 4],
    ['-3 * 2 / 4', -3 * 2 / 4],
    ['3 / -2 * 4', 3 / -2 * 4],
    ['3 * -2 / 4', 3 * -2 / 4],
    ['3 / 2 * -4', 3 / 2 * -4],
    ['3 * 2 / -4', 3 * 2 / -4],
    /* / and * have higher priority than - and + */
    ['2 + 3 * 4', 2 + 3 * 4],
    ['2 - 3 * 4', 2 - 3 * 4],
    ['2 + 3 / 4', 2 + 3 / 4],
    ['2 - 3 / 4', 2 - 3 / 4],
    /* change order */
    ['3 * 4 + 2', 3 * 4 + 2],
    ['3 * 4 - 2', 3 * 4 - 2],
    ['3 / 4 + 2', 3 / 4 + 2],
    ['3 / 4 - 2', 3 / 4 - 2],
    /* some complex combinations */
    ['3 / -4 / 2 * -9 / -2', 3 / -4 / 2 * -9 / -2],
    ['1 + -3 * 5 / 2 * 4 - -3', 1 + -3 * 5 / 2 * 4 - -3],
    ['-2 - 3 * -5 + 3 / -2 - -7 * 3', -2 - 3 * -5 + 3 / -2 - -7 * 3]
  ])('ordering: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toBe(res);
  });

  test.each([
    /* negate */
    ['-(7 * 4)', -(7 * 4)],
    ['-(7 / 4)', -(7 / 4)],
    ['-(7 + 4)', -(7 + 4)],
    ['-(7 - 4)', -(7 - 4)],
    /* change order */
    ['(7 + 4) * 5', (7 + 4) * 5],
    ['(7 - 4) * 5', (7 - 4) * 5],
    ['(7 + 4) / 5', (7 + 4) / 5],
    ['(7 - 4) / 5', (7 - 4) / 5],
    ['5 * (7 + 4)', 5 * (7 + 4)],
    ['5 * (7 - 4)', 5 * (7 - 4)],
    ['5 / (7 + 4)', 5 / (7 + 4)],
    ['5 / (7 - 4)', 5 / (7 - 4)],
    /* with unary */
    ['(7 + 4) * -5', (7 + 4) * -5],
    ['(7 - 4) * -5', (7 - 4) * -5],
    ['(7 + 4) / -5', (7 + 4) / -5],
    ['(7 - 4) / -5', (7 - 4) / -5],
    ['-5 * (7 + 4)', -5 * (7 + 4)],
    ['-5 * (7 - 4)', -5 * (7 - 4)],
    ['-5 / (7 + 4)', -5 / (7 + 4)],
    ['-5 / (7 - 4)', -5 / (7 - 4)],
    /* some complex examples */
    ['(-3 + -5 / (9 / -(3 * 5 - 5))) * 4',
      (-3 + -5 / (9 / -(3 * 5 - 5))) * 4],
    ['4 * (4 + 9 * (3 + -(7 + 3) / 2) - -3)',
      4 * (4 + 9 * (3 + -(7 + 3) / 2) - -3)]
  ])('brackets: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toBe(res);
  });

  test.each([
    ['4+-5', 4 + -5],
    ['4 +- 5', 4 + -5],
    ['4 + - 5', 4 + -5],
    ['4--5', 4 - -5],
    ['4- -5', 4 - -5],
    ['4 -- 5', 4 - -5],
    ['4 - - 5', 4 - -5],
    ['4*-5', 4 * -5],
    ['4* -5', 4 * -5],
    ['4 *- 5', 4 * -5],
    ['4 * - 5', 4 * -5],
    ['4/-5', 4 / -5],
    ['4/ -5', 4 / -5],
    ['4 /- 5', 4 / -5],
    ['4 / - 5', 4 / -5],
    [' \t 4 \n *\n - \t  7\t \n', 4 * -7]
  ])('whitespace: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toBe(res);
  });
});

describe('named functions', () => {
  test.each([
    ['sum(4.5, -2, 3)', 5.5],
    ['sum()', 0],
    ['-sum(4.5, -2, 3)', -5.5],
    ['2 * sum(4.5, -2, 1 - -2) + 7', 18],
    ['3 + sum(9 / 2, -2 * 2 + 6 / 3, 2 + 1) - 2', 6.5],
    ['sum(2 + (5 / 2), (1 + 1) * -1, 9 / (1 + 2))', 5.5],
    ['  SUM ( 4.5  , -2 , 3 )  ', 5.5],
    ['SUM(4.5,-2,3)  ', 5.5]
  ])('sum: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toBe(res);
  });

  test.each([
    ['avg(4.5, -2, 3)', 5.5 / 3],
    ['-avg(4.5, -2, 3)', -5.5 / 3],
    ['2 * avg(4.5, -2, 1 - -2) + 7', 11 / 3 + 7],
    ['3 + avg(9 / 2, -2 * 2 + 6 / 3, 2 + 1) - 2', 5.5 / 3 + 1],
    ['avg(2 + (5 / 2), (1 + 1) * -1, 9 / (1 + 2))', 5.5 / 3],
    ['  AVG ( 4.5  , -2 , 3 )  ', 5.5 / 3],
    ['AVG(4.5,-2,3)', 5.5 / 3]
  ])('avg: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toBe(res);
  });

  test('empty avg', () => {
    /* would be undefined so we have kept the function */
    expect(Tree.parseFormula(' avg  () ')).toStrictEqual(
      new Tree.Formula(avg, [], 1, 7, true));
  });

  test.each([
    ['sum(avg(2, 7, -8, 9), 2, sum(1, 2))', 7.5],
    ['avg(sum(2, -4, 9), 3, avg(3, 5), -2)', 3]
  ])('mixed: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toBe(res);
  });
});

describe('cell references', () => {
  test.each([
    ['a46', new Tree.Reference('a', '46', 0, 3)],
    ['  Bc199  ', new Tree.Reference('bc', '199', 2, 5)]
  ])('alone: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toStrictEqual(res);
  });

  function a46RefAtIndex (index, width=3) {
    return new Tree.Reference('a', '46', index, width);
  }
  test.each([
    ['-a46', new Tree.Formula(negate, [a46RefAtIndex(1)], 0, 4, false)],
    ['7 + a46', new Tree.Formula(add, [7, a46RefAtIndex(4)], 0, 7, false)],
    ['7 - a46', new Tree.Formula(minus, [7, a46RefAtIndex(4)], 0, 7, false)],
    ['7 * a46', new Tree.Formula(multiply, [7, a46RefAtIndex(4)], 0, 7, false)],
    ['7 / a46', new Tree.Formula(divide, [7, a46RefAtIndex(4)], 0, 7, false)]
  ])('with operator: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toStrictEqual(res);
  });

  function c9RefAtIndex (index, width=2) {
    return new Tree.Reference('c', '9', index, width);
  }
  test.each([
    ['c9 + a46', new Tree.Formula(add,
      [c9RefAtIndex(0), a46RefAtIndex(5)], 0, 8, false)],
    ['c9 - a46', new Tree.Formula(minus,
      [c9RefAtIndex(0), a46RefAtIndex(5)], 0, 8, false)],
    ['c9 * a46', new Tree.Formula(multiply,
      [c9RefAtIndex(0), a46RefAtIndex(5)], 0, 8, false)],
    ['c9 / a46', new Tree.Formula(divide,
      [c9RefAtIndex(0), a46RefAtIndex(5)], 0, 8, false)]
  ])('with ref: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toStrictEqual(res);
  });

  test.each([
    ['sum(c9, a46)', new Tree.Formula(sum,
      [c9RefAtIndex(4), a46RefAtIndex(8)], 0, 12, true)],
    ['avg(c9, a46)', new Tree.Formula(avg,
      [c9RefAtIndex(4), a46RefAtIndex(8)], 0, 12, true)]
  ])('with function: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toStrictEqual(res);
  });

  test.each([
    ['3 - sum (c9, avg(a46, 2, 3 * -5), - c9 / 2)',
      new Tree.Formula(minus,
        [
          3,
          new Tree.Formula(sum,
            [
              c9RefAtIndex(9),
              new Tree.Formula(avg, [a46RefAtIndex(17), 2, -15], 13, 19, true),
              new Tree.Formula(divide,
                [
                  new Tree.Formula(negate, [c9RefAtIndex(36)], 34, 4, false),
                  2
                ], 34, 8, false)
            ], 4, 39, true)
        ], 0, 43, false)
    ],
    [' 9 / c9 + c9 * (c9) / (-a46 +  2)  ',
      new Tree.Formula(add,
        [
          new Tree.Formula(divide, [9, c9RefAtIndex(5)], 1, 6, false),
          new Tree.Formula(divide,
            [
              new Tree.Formula(multiply,
                /* brackets around the second c9 make it wider */
                [c9RefAtIndex(10), c9RefAtIndex(15, 4)], 10, 9, false),
              new Tree.Formula(add,
                [
                  new Tree.Formula(negate, [a46RefAtIndex(24)], 23, 4, false),
                  2
                ], 22, 11, false)
            ], 10, 23, false)
        ], 1, 32, false)
    ]
  ])('complex: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toStrictEqual(res);
  });
});

describe('cell ranges', () => {
  /* these are only valid within function arguments */
  test.each([
    ['avg(a4:a50)', new Tree.Formula(avg,
      [new Tree.ReferenceRange('a', '4', '50', 4, 6)], 0, 11, true)],
    [' sum ( Ab17:aB119 ) ', new Tree.Formula(sum,
      [new Tree.ReferenceRange('ab', '17', '119', 7, 10)], 1, 18, true)],
    ['sum(a3:a9, b2:b7)', new Tree.Formula(sum,
      [
        new Tree.ReferenceRange('a', '3', '9', 4, 5),
        new Tree.ReferenceRange('b', '2', '7', 11, 5),
      ], 0, 17, true)]
  ])('with functions: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toStrictEqual(res);
  });

  test.each([
    ['avg(a9, c16:c19, -3 + 2, b7)', new Tree.Formula(avg,
      [
        new Tree.Reference('a', '9', 4, 2),
        new Tree.ReferenceRange('c', '16', '19', 8, 7),
        -1, new Tree.Reference('b', '7', 25, 2)
      ], 0, 28, true)]
  ])('with refs and numbers: %s', (input, res) => {
    expect(Tree.parseFormula(input)).toStrictEqual(res);
  });
});

describe('parse Errors', () => {
  test.each([
    /* empty formula */
    ['', '', [/empty formula/i]],
    /* unknown function */
    ['3 + MyFunc (a3:a6) * 7', 'MyFunc', [/unknown/i, /function/i]],
    /* incorrect ranges */
    ['3 + avg ( a4:c9) * 7', 'a4:c9', [/mismatch/i, /columns/i, /cell-range/i]],
    ['3 + avg ( a9:a9) * 7', 'a9:a9', [/cell-range/i, /same row/i]],
    ['3 +avg ( a9:a2) * 7', 'a9:a2', [/cell-range/i, /end row/i, /start row/i]],
    /* incorrect brackets */
    ['3 + avg ( a4:c9 * 7', 'avg (', [/missing/i, /closing bracket/i]],
    ['3 + ( 7 * 8 + 9', '(', [/missing/i, /closing bracket/i]],
    ['3 + 7 * 8 ) + 9', ')', [/unmatched/i, /closing bracket/i]],
    /* separator outside of arguments */
    ['3 + 7 * 8, 9', ',', [/separator/i, /not allowed/i]],
    /* range outside of arguments */
    ['3 + a4:a90 + 9', 'a4:a90', [/cell-range/i, /not allowed/i]],
    /* range in singleton */
    ['3 + avg(7, (a4:a90), 9)', 'a4:a90', [/cell-range/i, /not allowed/i]],
    /* unrecognised text */
    ['3 + word * (9 + 8)', 'word * (9 + 8)', [/unrecognised/i]],
    /* missing operator */
    /* missing operator */
    ['3 + ( 4 5)', '4 5', [/missing operator/i]],
    ['3 + (4 + 3 a6 5)', '3 a6', [/missing operator/i]],
    ['3 + (5 sum(2,3 ) 9 + 8)', '5 sum(2,3 )', [/missing operator/i]],
    /* unary operators */
    ['3 + (3 + 4 + -)', '-',
      [/unary operator/i, /"-"/, /missing an argument/i]],
    ['3 + (3 + 4 + - * 9)', '- *',
      [/unary operator/i, /"-"/, /incorrect first argument/i]],
    /* don't allow double unary */
    ['3 + (3 + 4 + - -9)', '- -',
      [/unary operator/i, /"-"/, /incorrect first argument/i]],
    /* binary operators */
    ['3 + (3 + 4 *)', '*',
      [/binary operator/i, /"\*"/, /missing a second argument/i]],
    ['3 + (3 + 4 /)', '/',
      [/binary operator/i, /"\/"/, /missing a second argument/i]],
    ['3 * (3 * 4 +)', '+',
      [/binary operator/i, /"\+"/, /missing a second argument/i]],
    ['3 * (3 * 4 -)', '-',
      [/binary operator/i, /"-"/, /missing a second argument/i]],
    ['3 - (* 3 - 4)', '*',
      [/binary operator/i, /"\*"/, /missing a first argument/i]],
    ['3 - (/ 3 - 4)', '/',
      [/binary operator/i, /"\/"/, /missing a first argument/i]],
    ['3 / (+ 3 / 4)', '+',
      [/binary operator/i, /"\+"/, /missing a first argument/i]],
    /* multiplication and division are parsed first */
    ['3 + * 7', '+ *',
      [/binary operator/i, /"\*"/, /incorrect first argument/i]],
    ['3 + / 7', '+ /',
      [/binary operator/i, /"\/"/, /incorrect first argument/i]],
    ['3 *+ 7', '*+',
      [/binary operator/i, /"\*"/, /incorrect second argument/i]],
    ['3 /  + 7', '/  +',
      [/binary operator/i, /"\/"/, /incorrect second argument/i]],
    ['3 ++ 7', '++',
      [/binary operator/i, /"\+"/, /incorrect second argument/i]],
    ['3 - + 7', '- +',
      [/binary operator/i, /"-"/, /incorrect second argument/i]],
    ['3 ( +) 7', '+',
      [/binary operator/i, /"\+"/, /missing a first argument/i]],
    ['3 (- ) 7', '-',
      [/unary operator/i, /"-"/, /missing an argument/i]],
    ['3 ( * ) 7', '*',
      [/binary operator/i, /"\*"/, /missing a first argument/i]],
    ['3 (/) 7', '/',
      [/binary operator/i, /"\/"/, /missing a first argument/i]],
    /* empty arguments */
    ['3 + avg( ,a4:a9)', ',', [/empty argument/i]],
    ['3 + avg (a4:a9 ,)', ',', [/empty argument/i]],
    ['3 + avg (a4:a9 ,  )', ',', [/empty argument/i]],
    ['3 + avg (4 , \t , 8)', ', \t ,', [/empty argument/i]],
    /* empty brackets */
    ['3 + 7 * () * 9', '()', [/empty brackets/i]],
    ['3 + 7 * (  ) * 9', '(  )', [/empty brackets/i]],
    /* test correct capture when nested */
    ['3 + sum (a4, (9 + (avg(8, (7), (3 ++ 4))))))', '++',
      [/binary operator/i, /"\+"/, /incorrect second argument/i]]
  ])('parsing Error: %s', (input, errorRegion, errorMessageParts) => {
    let error;
    try {
      Tree.parseFormula(input);
    } catch (e) {
      if (e instanceof Tree.ParseError) {
        error = e;
      } else {
        throw e;
      }
    }
    expect(error).toBeDefined();

    for (const msgPart of errorMessageParts) {
      expect(error.message).toMatch(msgPart);
    }

    expect(
      input.slice(error.index, error.index + error.length)).toBe(errorRegion);
  });
});
