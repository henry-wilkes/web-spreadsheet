class ParseError {
  constructor (index, length, message) {
    this.index = index;
    this.length = length;
    this.message = message;
  }
}

/* basic functions
 * these must return undefined if *any* of the expected arguments are
 * undefined */
function isNum (num) {
  return (typeof num === 'number');
}

function negate (arg) {
  if (isNum(arg)) {
    return -arg;
  }
  return undefined;
}

const unaryOperatorFunctions = {
  '-': negate
};

function add (arg1, arg2) {
  if (isNum(arg1) && isNum(arg2)) {
    return arg1 + arg2;
  }
  return undefined;
}

function minus (arg1, arg2) {
  if (isNum(arg1) && isNum(arg2)) {
    return arg1 - arg2;
  }
  return undefined;
}

function multiply (arg1, arg2) {
  if (isNum(arg1) && isNum(arg2)) {
    return arg1 * arg2;
  }
  return undefined;
}

function divide (arg1, arg2) {
  /* how should we handle divide by 0? */
  if (isNum(arg1) && isNum(arg2)) {
    return arg1 / arg2;
  }
  return undefined;
}

const binaryOperatorFunctions = {
  '*': multiply,
  '/': divide,
  '+': add,
  '-': minus
};

function sum (...args) {
  let tot = 0;
  for (const arg of args) {
    if (isNum(arg)) {
      tot += arg;
    } else if (arg !== null) {
      return undefined;
    }
    /* null is ignored */
  }
  return tot;
}

function avg (...args) {
  let count = 0;
  let tot = 0;
  for (const arg of args) {
    if (isNum(arg)) {
      tot += arg;
      count++;
    } else if (arg !== null) {
      return undefined;
    }
    /* null is ignored */
  }
  if (count === 0) {
    return undefined;
  }
  return tot / count;
}

const namedFunctions = {
  'sum': sum,
  'avg': avg
};

function coverLength (firstEl, secondEl) {
  return secondEl.index - firstEl.index + secondEl.length;
}

function haveIndexAndLength (el) {
  return (el.length !== undefined && el.index !== undefined);
}

class RawNumber {
  constructor (number, index, length) {
    this.number = number;
    this.index = index;
    this.length = length;
  }
}

class RawSymbol {
  constructor (text, index) {
    this.text = text;
    this.index = index;
    this.length = text.length;
  }
}

class Formula {
  /* if one argument is undefined, the function should also return undefined */
  constructor (func, args, index, length, allowNull) {
    this.func = func;
    this.args = args;
    this.index = index;
    this.length = length;
    this.allowNull = allowNull;
  }

  static numOrNew (func, args, index, length, allowNull) {
    if (args.every(arg => (arg instanceof RawNumber))) {
      const val = func(...args.map(arg => arg.number));
      /* val may be undefined, e.g. avg(), in which case we want to preserve
       * the function that created it */
      if (typeof val === 'number') {
        return new RawNumber(val, index, length);
      }
    }
    return new this(func, args, index, length, allowNull);
  }

  static fromString (funcName, funcIndex, content, contentIndex) {
    /* length is the function plus its content plus the final bracket */
    const length = contentIndex - funcIndex + content.length + 1;
    /* allow mixed cases */
    const func = namedFunctions[funcName.toLowerCase()];
    if (func === undefined) {
      throw new ParseError(funcIndex, funcName.length, 'Unknown function');
    }

    /* all supported functions accept an arbitrary number of arguments, so we
     * don't need to check the number */
    /* both allow null */
    const args = parseArguments(content, contentIndex);

    return this.numOrNew(func, args, funcIndex, length, true);
  }
}

class Reference {
  constructor (refCol, refRow, index, length) {
    this.refCol = refCol;
    this.refRow = refRow;
    this.index = index;
    this.length = length;
  }

  static fromString (text, index) {
    const length = text.length;
    const match = this.regex.exec(text);
    if (match === null || match.length !== 3) {
      /* shouldn't happen in practice since the global refRe is checked before
       * calling this */
      throw new ParseError(index, length, 'Unknown cell format');
    }
    /* allow mixed cases */
    return new this(match[1].toLowerCase(), match[2], index, length);
  }
}
/* static property */
Reference.regex = /^([a-zA-Z]+)([0-9]+)$/;

class ReferenceRange {
  constructor (refCol, rowStart, rowEnd, index, length) {
    this.refCol = refCol;
    this.rowStart = rowStart;
    this.rowEnd = rowEnd;
    this.index = index;
    this.length = length;
  }

  static fromString (text, index) {
    const length = text.length;
    const match = this.regex.exec(text);
    if (match === null || match.length !== 5) {
      /* shouldn't happen in practice since the global refRe is checked before
       * calling this */
      throw new ParseError(index, length, 'Unknown cell-range format');
    }
    /* allow mixed cases */
    const refCol1 = match[1].toLowerCase();
    const rowStart = match[2];
    const refCol2 = match[3].toLowerCase();
    const rowEnd = match[4];

    if (refCol1 !== refCol2) {
      throw new ParseError(index, length, 'Mismatched columns in cell-range');
    }

    const startNum = Number(rowStart);
    const endNum = Number(rowEnd);
    if (startNum === endNum) {
      /* consider this a user error since they could use a cell reference */
      throw new ParseError(index, length,
        'Cell-range starts and ends at the same row');
    } else if (startNum > endNum) {
      throw new ParseError(index, length,
        'Cell-range end row before the start row');
    }

    return new this(refCol1, rowStart, rowEnd, index, length);
  }
}
/* static property */
ReferenceRange.regex = /^([a-zA-Z]+)([0-9]+):([a-zA-Z]+)([0-9]+)$/;

class TextMarker {
  constructor (text, startIndex) {
    this.text = text;
    this.index = startIndex;
  }

  shiftBy (num) {
    this.text = this.text.slice(num);
    this.index += num;
  }

  startsWith (regex) {
    const match = regex.exec(this.text);
    if (match !== null) {
      return match[0];
    }
    return null;
  }
}

const whitespaceRe = /^\s+/;
const functionSingletonRe = /^([a-zA-Z][a-zA-Z0-9_]*)?\s*\(/;
const numberRe = /^[0-9]+(\.[0-9]+)?/;
const operatorRe = /^[-+*/]/;
const separatorRe = /^,/;
const refRangeRe = /^[a-zA-Z]+[0-9]+:[a-zA-Z]+[0-9]+/;
const refRe = /^[a-zA-Z]+[0-9]+/;
const closingBracketRe = /^\)/;

function parseContent (text, startIndex, allowSep, allowRange) {
  const elements = [];

  const marker = new TextMarker(text, startIndex);

  while (true) {
    const whitespace = marker.startsWith(whitespaceRe);
    if (whitespace !== null) {
      marker.shiftBy(whitespace.length);
    }
    if (marker.text.length === 0) {
      break;
    }

    let el = null;
    /* check first */
    const funcMatch = functionSingletonRe.exec(marker.text);
    if (funcMatch !== null) {
      /* NOTE: unlike the other conditionals, we are using an array of strings,
       * rather than a single string */
      const funcName = funcMatch[1];
      /* the starting index just after the bracket */
      const start = funcMatch[0].length;
      const textLength = marker.text.length;
      /* index after the closing bracket */
      let end = start;
      let count = 1;
      do {
        if (end >= textLength) {
          /* include func name in error */
          throw new ParseError(marker.index, start, 'Missing closing bracket');
        }
        const ch = marker.text[end];
        if (ch === ')') {
          count--;
        } else if (ch === '(') {
          count++;
        }
        end++;
      } while (count !== 0);
      /* between the brackets */
      const content = marker.text.slice(start, end - 1);
      if (funcName === undefined) {
        el = parseSingleton(content, marker.index + start);
      } else {
        el = Formula.fromString(funcName, marker.index, content,
          marker.index + start);
      }
      /* shift past the content + closing bracket */
      marker.shiftBy(end);
    } else {
      let match;
      if ((match = marker.startsWith(numberRe)) !== null) {
        el = new RawNumber(Number(match), marker.index, match.length);
      } else if ((match = marker.startsWith(operatorRe)) !== null) {
        el = new RawSymbol(match, marker.index);
      } else if ((match = marker.startsWith(separatorRe)) !== null) {
        if (allowSep !== true) {
          throw new ParseError(marker.index, match.length,
            'Separators not allowed');
        }
        el = new RawSymbol(match, marker.index);
      } else if ((match = marker.startsWith(refRangeRe)) !== null) {
        /* check before refRe since it is a sub-expression of this one */
        if (allowRange !== true) {
          throw new ParseError(marker.index, match.length,
            'Cell-ranges not allowed');
        }
        el = ReferenceRange.fromString(match, marker.index);
      } else if ((match = marker.startsWith(refRe)) !== null) {
        el = Reference.fromString(match, marker.index);
      } else if ((match = marker.startsWith(closingBracketRe)) !== null) {
        throw new ParseError(marker.index, match.length,
          'Unmatched closing bracket');
      }

      if (match !== null) {
        marker.shiftBy(match.length);
      }
    }

    if (el !== null) {
      elements.push(el);
      continue;
    }

    /* cover the rest of the text */
    throw new ParseError(marker.index, marker.text.length, 'Unrecognised text');
  }

  return elements;
}

function findNext (elements, start) {
  for (let i = start + 1; i < elements.length; i++) {
    /* skip null */
    if (elements[i] === null) {
      continue;
    }
    return i;
  }
  return -1;
}

function findPrev (elements, start) {
  for (let i = start - 1; i >= 0; i--) {
    /* skip null */
    if (elements[i] === null) {
      continue;
    }
    return i;
  }
  return -1;
}

function isOpArg (arg) {
  /* NOTE: don't accept a ReferenceRange */
  return (arg instanceof RawNumber || arg instanceof Reference ||
    arg instanceof Formula);
}

function operatorError (opType, symbol, problem) {
  return new ParseError(symbol.index, symbol.length, opType +
    ' operator "' + symbol.text + '" ' + problem);
}

function operatorWrongArgError (opType, symbol, argNum, wrongArg) {
  /* want index and length to cover both the operator and the wrong argument */
  let index;
  let length;
  if (!haveIndexAndLength(wrongArg)) {
    index = symbol.index;
    length = symbol.length;
  } else if (symbol.index < wrongArg.index) {
    index = symbol.index;
    length = coverLength(symbol, wrongArg);
  } else {
    index = wrongArg.index;
    length = coverLength(wrongArg, symbol);
  }
  return new ParseError(index, length, 'Incorrect ' + argNum +
    ' argument for the ' + opType + ' operator "' + symbol.text + '"');
}

function replaceUnaryRawSymbols (elements, opSet) {
  /* fixed length */
  const len = elements.length;

  for (let i = 0; i < len; i++) {
    const el = elements[i];
    if (el instanceof RawSymbol && opSet.includes(el.text)) {
      /* if we have a previous operator argument, then consider it a binary
       * operator instead */
      const prev = findPrev(elements, i);
      if (prev !== -1 && isOpArg(elements[prev])) {
        continue;
      }

      const next = findNext(elements, i);
      if (next === -1) {
        throw operatorError('Unary', el, 'missing an argument');
      }
      const nextEl = elements[next];
      if (!isOpArg(nextEl)) {
        throw operatorWrongArgError('Unary', el, 'first', nextEl);
      }
      /* replace and preserve length */
      const func = unaryOperatorFunctions[el.text];
      if (func === undefined) {
        /* not expected */
        throw operatorError('Unary', el, 'not handled');
      }
      /* cover the operator plus argument */
      const length = coverLength(el, nextEl);
      elements[i] = Formula.numOrNew(func, [nextEl], el.index, length, false);
      elements[next] = null;
    }
  }
}

function replaceBinaryRawSymbols (elements, opSet) {
  /* fixed length */
  const len = elements.length;

  for (let i = 0; i < len; i++) {
    const el = elements[i];
    if (el instanceof RawSymbol && opSet.includes(el.text)) {
      const prev = findPrev(elements, i);
      const next = findNext(elements, i);
      if (prev === -1) {
        throw operatorError('Binary', el, 'missing a first argument');
      }
      if (next === -1) {
        throw operatorError('Binary', el, 'missing a second argument');
      }
      const prevEl = elements[prev];
      const nextEl = elements[next];
      if (!isOpArg(prevEl)) {
        throw operatorWrongArgError('Binary', el, 'first', prevEl);
      }
      if (!isOpArg(nextEl)) {
        throw operatorWrongArgError('Binary', el, 'second', nextEl);
      }
      const func = binaryOperatorFunctions[el.text];
      if (func === undefined) {
        /* not expected */
        throw operatorError('Binary', el, 'not handled');
      }
      /* cover the operator plus arguments */
      const length = coverLength(prevEl, nextEl);
      /* replace and preserve length */
      elements[i] = Formula.numOrNew(
        func, [prevEl, nextEl], prevEl.index, length, false);
      elements[prev] = null;
      elements[next] = null;
    }
  }
}

function replaceOperatorRawSymbols (elements, startIndex, textLength) {
  let prevEl = elements[0];
  for (let i = 1; i < elements.length; i++) {
    const el = elements[i];
    if (!(el instanceof RawSymbol) && !(prevEl instanceof RawSymbol)) {
      let length;
      let index;
      if (haveIndexAndLength(prevEl) && haveIndexAndLength(el)) {
        length = coverLength(prevEl, el);
        index = prevEl.index;
      } else {
        length = textLength;
        index = startIndex;
      }
      throw new ParseError(index, length, 'Missing operator');
    }
    prevEl = el;
  }

  replaceUnaryRawSymbols(elements, ['-']);
  replaceBinaryRawSymbols(elements, ['/', '*']);
  replaceBinaryRawSymbols(elements, ['+', '-']);

  const noNull = elements.filter(e => e !== null);
  if (noNull.length !== 1) {
    /* unexpected */
    if (noNull.length !== 0) {
      throw new ParseError(startIndex, textLength, 'Unhandled symbols');
    }
    throw new ParseError(startIndex, textLength, 'No elements found');
  }
  return noNull[0];
}

function replaceRawNumbers (element) {
  if (element instanceof Formula) {
    element.args = element.args.map(arg => replaceRawNumbers(arg));
  } else if (element instanceof RawNumber) {
    /* loose metadata */
    return element.number;
  }
  return element;
}

function parseArguments (text, startIndex) {
  /* point to after the content */
  const contentEnd = startIndex + text.length;
  const elements = parseContent(text, startIndex, true, true);
  const args = [];
  let argElements = [];

  /* outside scope */
  let prevSep = null;
  for (const el of elements) {
    if (el instanceof RawSymbol && el.text === ',') {
      if (argElements.length === 0) {
        if (prevSep === null) {
          /* first separator */
          throw new ParseError(el.index, el.length, 'Empty argument');
        } else {
          const length = coverLength(prevSep, el);
          throw new ParseError(prevSep.index, length, 'Empty argument');
        }
      }
      prevSep = el;
      /* after the last separator or beginning, before the current */
      const length = el.index - startIndex;
      args.push(replaceOperatorRawSymbols(argElements, startIndex, length));
      argElements = [];
      /* point to after this separator */
      startIndex = el.index + el.length;
    } else {
      argElements.push(el);
      prevSep = null;
    }
  }
  /* ends in a separator */
  if (prevSep !== null) {
    throw new ParseError(prevSep.index, prevSep.length, 'Empty argument');
  }

  /* content after the last separator, can be empty if no arguments */
  if (argElements.length !== 0) {
    const length = contentEnd - startIndex;
    args.push(replaceOperatorRawSymbols(argElements, startIndex, length));
  }

  return args;
}

function parseSingleton (text, startIndex) {
  const length = text.length;
  const elements = parseContent(text, startIndex, false, false);
  if (elements.length === 0) {
    /* reduce start index by 1 and increase length by 2 to capture the
     * enclosing brackets */
    throw new ParseError(startIndex - 1, length + 2, 'Empty Brackets');
  }
  const el = replaceOperatorRawSymbols(elements, startIndex, length);
  if (haveIndexAndLength(el)) {
    /* stretch the element to include the containing brackets */
    el.index--;
    el.length += 2;
  }
  return el;
}

function parseFormula (text) {
  const length = text.length;
  const elements = parseContent(text, 0, false, false);
  if (elements.length === 0) {
    throw new ParseError(0, length, 'Empty Formula');
  }
  const element = replaceOperatorRawSymbols(elements, 0, length);
  return replaceRawNumbers(element);
}

export {
  parseFormula, ParseError,
  Formula, Reference, ReferenceRange,
  namedFunctions, unaryOperatorFunctions, binaryOperatorFunctions
};
