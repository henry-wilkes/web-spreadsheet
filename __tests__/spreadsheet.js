import { SpreadSheetApp } from '../modules/spreadsheet.js';

describe('spreadsheet response', () => {
  let spreadsheet;
  let root;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    root = document.getElementById('root');
    spreadsheet = new SpreadSheetApp(root, 26, 50);
  });

  expect.extend({
    toHaveClass (el, className) {
      if (el.classList.contains(className) === true) {
        return {
          pass: true,
          message: () => ('Has ' + className + ' class')
        };
      }
      return {
        pass: false,
        message: () => ('Is missing ' + className + ' class')
      };
    }
  });

  expect.extend({
    toHaveText (el, text) {
      if (el.textContent === text) {
        return {
          pass: true,
          message: () => ('Has textContent "' + text + '"')
        };
      }
      return {
        pass: false,
        message: () => ('Has textContent "' + el.textContent +
          '" rather than "' + text + '"')
      };
    }
  });

  function appendUserEntry (text) {
    const textNode = document.createTextNode(text);
    spreadsheet.userEntry.appendChild(textNode);
    spreadsheet.userEntry.dispatchEvent(new Event('input'));
  }

  function setUserEntry (text) {
    spreadsheet.userEntry.textContent = '';
    appendUserEntry(text);
  }

  function doKeyDown (key, modifiers) {
    const ev = new KeyboardEvent('keydown', {
        key: key,
        ctrlKey: modifiers.includes('Control'),
        shiftKey: modifiers.includes('Shift'),
        bubbles: true
      });
    spreadsheet.userEntry.dispatchEvent(ev);
  }

  function getCell (cellName) {
    const cell = spreadsheet.cellEls.get(cellName);
    expect(cell).toBeDefined();
    return cell;
  }

  test('initial', () => {
    expect(document.activeElement).toBe(spreadsheet.userEntry);
    expect(spreadsheet.userEntry).toHaveText('');
    const a1 = getCell('a1').cell;
    expect(a1).toHaveClass('selected');
  });

  test.each([
    ['56.7', 'number', '56.7', true],
    [' -56.7  ', 'number', '-56.7', true],
    ['Title', null, 'Title', true],
    ['Title ', null, 'Title', true],
    ['=5 * -2 ', 'special-value', '-10', false],
    ['=5 * -2 8', 'special-value', '???', false]
  ])('select-set-enter: %s', (cellEntry, className, cellDisp, liveUpdate) => {
    const b2 = getCell('b2');
    expect(b2.cell).not.toHaveClass('selected');

    /* select */
    b2.cell.click();

    expect(b2.cell).toHaveClass('selected');
    if (className !== null) {
      expect(b2.cell).not.toHaveClass(className);
    }
    expect(b2.text).toHaveText('');

    /* set */
    setUserEntry(cellEntry);

    expect(spreadsheet.userEntry).toHaveText(cellEntry);
    expect(b2.text).toHaveText(liveUpdate ? cellDisp : '');
    if (className !== null) {
      if (liveUpdate) {
        expect(b2.cell).toHaveClass(className);
      } else {
        expect(b2.cell).not.toHaveClass(className);
      }
    }

    /* enter */
    doKeyDown('Enter', []);

    expect(b2.text).toHaveText(cellDisp);
    if (className !== null) {
      expect(b2.cell).toHaveClass(className);
    }
  });

  test('dependants', () => {
    const a3 = getCell('a3');
    const d9 = getCell('d9');
    const b13 = getCell('b13');

    expect(a3.cell).not.toHaveClass('depended-on');
    expect(d9.cell).not.toHaveClass('depended-on');
    expect(b13.cell).not.toHaveClass('depended-on');

    /* set d9 (depends on a3) */
    d9.cell.click();
    setUserEntry('= a3 + 2');
    doKeyDown('Enter', ['Control']);

    expect(a3.text).toHaveText('');
    /* error since empty */
    expect(d9.text).toHaveText('???');
    expect(b13.text).toHaveText('');

    /* when selected, the depended on are highlighted */
    expect(d9.cell).toHaveClass('selected');
    expect(a3.cell).toHaveClass('depended-on');
    expect(d9.cell).not.toHaveClass('depended-on');
    expect(b13.cell).not.toHaveClass('depended-on');

    /* set b13 (depends on d9) */
    b13.cell.click();
    setUserEntry('= 3 * d9');
    doKeyDown('Enter', ['Control']);

    expect(a3.text).toHaveText('');
    /* error since empty */
    expect(d9.text).toHaveText('???');
    expect(b13.text).toHaveText('???');

    expect(b13.cell).toHaveClass('selected');
    expect(a3.cell).not.toHaveClass('depended-on');
    expect(d9.cell).toHaveClass('depended-on');
    expect(b13.cell).not.toHaveClass('depended-on');

    /* set a3 (depends on none) */
    a3.cell.click();

    expect(a3.cell).toHaveClass('selected');
    expect(a3.cell).not.toHaveClass('depended-on');
    expect(d9.cell).not.toHaveClass('depended-on');
    expect(b13.cell).not.toHaveClass('depended-on');

    appendUserEntry('2');
    /* live update */
    expect(a3.text).toHaveText('2');
    expect(d9.text).toHaveText('4');
    expect(b13.text).toHaveText('12');

    appendUserEntry('3');
    expect(a3.text).toHaveText('23');
    expect(d9.text).toHaveText('25');
    expect(b13.text).toHaveText('75');

    appendUserEntry('w');
    expect(a3.text).toHaveText('23w');
    expect(d9.text).toHaveText('???');
    expect(b13.text).toHaveText('???');

    expect(a3.cell).toHaveClass('selected');
    expect(a3.cell).not.toHaveClass('depended-on');
    expect(d9.cell).not.toHaveClass('depended-on');
    expect(b13.cell).not.toHaveClass('depended-on');
  });

  test.each([
    ['ArrowUp', 'b2', 'b1'],
    ['ArrowUp', 'b1', 'b1'],
    ['ArrowDown', 'b49', 'b50'],
    ['ArrowDown', 'b50', 'b50'],
    ['ArrowRight', 'b2', 'c2'],
    ['ArrowRight', 'z2', 'z2'],
    ['ArrowLeft', 'b2', 'a2'],
    ['ArrowLeft', 'a2', 'a2']
  ])('Navigate: %s %s', (key, start, end) => {
    const startCell = getCell(start).cell;
    const endCell = getCell(end).cell;
    expect(startCell).not.toHaveClass('selected');
    expect(endCell).not.toHaveClass('selected');

    /* select */
    startCell.click();
    expect(startCell).toHaveClass('selected');
    if (startCell !== endCell) {
      expect(endCell).not.toHaveClass('selected');
    }

    /* navigate */
    doKeyDown(key, ['Control']);

    expect(endCell).toHaveClass('selected');
    if (startCell !== endCell) {
      expect(startCell).not.toHaveClass('selected');
    }
  });

  test('Enter key', () => {
    const c2 = getCell('c2');
    const c3 = getCell('c3');

    expect(c2.cell).not.toHaveClass('selected');
    expect(c3.cell).not.toHaveClass('selected');

    expect(c2.text).toHaveText('');
    expect(c3.text).toHaveText('');
    expect(spreadsheet.userEntry).toHaveText('');

    c2.cell.click();

    expect(c2.cell).toHaveClass('selected');
    expect(c3.cell).not.toHaveClass('selected');

    expect(c2.text).toHaveText('');
    expect(c3.text).toHaveText('');
    expect(spreadsheet.userEntry).toHaveText('');

    appendUserEntry('testing ');

    /* remain in cell, but update if using modifier */
    doKeyDown('Enter', ['Control']);

    expect(c2.cell).toHaveClass('selected');
    expect(c3.cell).not.toHaveClass('selected');

    expect(c2.text).toHaveText('testing');
    expect(c3.text).toHaveText('');
    expect(spreadsheet.userEntry).toHaveText('testing');

    appendUserEntry(' 123');

    doKeyDown('Enter', ['Shift']);

    expect(c2.cell).toHaveClass('selected');
    expect(c3.cell).not.toHaveClass('selected');

    expect(c2.text).toHaveText('testing 123');
    expect(c3.text).toHaveText('');
    expect(spreadsheet.userEntry).toHaveText('testing 123');

    setUserEntry('= 123 + 2');

    /* next cell if no modifier */
    doKeyDown('Enter', []);

    expect(c2.cell).not.toHaveClass('selected');
    expect(c3.cell).toHaveClass('selected');

    expect(c2.text).toHaveText('125');
    expect(c3.text).toHaveText('');
    expect(spreadsheet.userEntry).toHaveText('');
  });

  test.each([
    ['35', '35'],
    ['Title', 'Title'],
    ['Title ', 'Title'],
    ['=2 * 3', '=2 * 3'],
    ['  = 2 + 4  ', '=2 + 4'],
    /* with errors */
    ['= 3 + d3', '=3 + d3'],
    ['= 4 5 ', '=4 5']
  ])('Showing entry %s', (entry, returnEntry) => {
    const d2 = getCell('d2').cell;

    d2.click();
    expect(d2).toHaveClass('selected');
    expect(spreadsheet.userEntry).toHaveText('');

    setUserEntry(entry);
    doKeyDown('Enter', []);

    expect(d2).not.toHaveClass('selected');
    expect(spreadsheet.userEntry).toHaveText('');

    /* return */
    d2.click();
    expect(d2).toHaveClass('selected');
    expect(spreadsheet.userEntry).toHaveText(returnEntry);

    /* text is fully selected on re-entry */
    const selection = window.getSelection();
    expect(selection.anchorNode).toBe(spreadsheet.userEntry);
    expect(selection.focusNode).toBe(spreadsheet.userEntry);
    expect(selection.rangeCount).toBe(1);
    expect(selection.toString()).toBe(returnEntry);
  });

  test('Commit on leave', () => {
    const e4 = getCell('e4');
    const otherCell = getCell('a1').cell;
    let display = '';

    function reSelect () {
      e4.cell.click();
      expect(e4.cell).toHaveClass('selected');
      expect(e4.text).toHaveText(display);
    }

    /* Enter key */
    reSelect();
    setUserEntry('= 4 + 5');
    /* not updated yet, since formula */
    expect(e4.text).toHaveText(display);
    doKeyDown('Enter', []);
    display = '9';

    expect(e4.cell).not.toHaveClass('selected');
    expect(e4.text).toHaveText(display);

    reSelect();

    /* arrow key away */
    setUserEntry('= 4 5');
    expect(e4.text).toHaveText(display);
    doKeyDown('ArrowRight', ['Control']);
    display = '???';

    expect(e4.cell).not.toHaveClass('selected');
    expect(e4.text).toHaveText(display);

    reSelect();

    /* click away */
    setUserEntry('= 4 * 5');
    expect(e4.text).toHaveText(display);
    otherCell.click();
    display = '20';

    expect(e4.cell).not.toHaveClass('selected');
    expect(e4.text).toHaveText(display);

    reSelect();

    /* click same */
    setUserEntry('=avg(5, 4)');
    expect(e4.text).toHaveText(display);
    e4.cell.click();
    display = '4.5';

    /* still selected, but display is updated */
    expect(e4.cell).toHaveClass('selected');
    expect(e4.text).toHaveText(display);

    reSelect();

    /* unfocus entry */
    setUserEntry('= 4 - 5');
    expect(e4.text).toHaveText(display);
    spreadsheet.userEntry.blur();
    display = '-1';

    /* still selected, but not focussed */
    expect(e4.cell).toHaveClass('selected');
    expect(e4.text).toHaveText(display);

    reSelect();

    /* Control + Enter */
    setUserEntry('= 5 / 4');
    expect(e4.text).toHaveText(display);
    doKeyDown('Enter', ['Control']);
    display = '1.25';

    /* still selected */
    expect(e4.cell).toHaveClass('selected');
    expect(e4.text).toHaveText(display);
  });

  test.each([
    /* syntax errors */
    ['= 2  + 3 b5 + 5', ['=2  + ', '3 b5', ' + 5'], [/missing operator/i]],
    [' =3 +  word', ['=3 +  ', 'word'], [/unrecognised/i]],
    ['=avg(a4:b4', ['=', 'avg(', 'a4:b4'], [/missing.*closing bracket/i]],
    ['= ', [null, '='], [/empty/i]],
    /* calc errors */
    ['= avg(a51, b2)', ['=avg(', 'a51', ', b2)'], [/out of scope/i]],
    ['=7 + b3 - 2', ['=7 + ', 'b3', ' - 2'], [/empty/i]],
    /* same error in two places */
    ['=sum(f3, 5, f1:f5)', ['=sum(', 'f3', ', 5, ', 'f1:f5', ')'],
      [/self-dependency/i]],
    /* multiple errors */
    [
      ' =  sum(avg(f9:f13, g9:g13), 89) + b7 / (f3 * -aa2)',
      [
        '=sum(', 'avg(f9:f13, g9:g13)', ', 89) + ', 'b7', ' / (', 'f3', ' * -',
        'aa2', ')'
      ], [
        /function evaluation is not defined/i, /empty/i, /self-dependency/i,
        /out of scope/i
      ]
    ]
  ])('formula errors %s', (entry, parts, errorMessages) => {
    /* *parts* alternates between non-error -> error -> non-error -> etc
     * If one is null, it is skipped */
    const f3 = getCell('f3');

    f3.cell.click();

    expect(f3.text).toHaveText('');
    expect(spreadsheet.userEntry).toHaveText('');

    setUserEntry(entry);
    doKeyDown('Enter', ['Control']);

    expect(f3.text).toHaveText('???');
    const nonNullParts = parts.filter(p => p !== null);
    expect(spreadsheet.userEntry).toHaveText(nonNullParts.join(''));

    const entryParts = spreadsheet.userEntry.childNodes;

    expect(entryParts.length).toBe(nonNullParts.length);

    let c = 0;
    let nonError = true;
    for (const part of parts) {
      if (part !== null) {
        const partEl = entryParts[c];
        if (nonError) {
          /* plain text */
          expect(partEl).toBeInstanceOf(Text);
        } else {
          expect(partEl).toBeInstanceOf(HTMLSpanElement);
          expect(partEl).toHaveClass('entry-inline-error');
        }
        expect(partEl).toHaveText(part);
        c++;
      }
      nonError = !nonError;
    }

    const messageEls = spreadsheet.entryErrorArea.childNodes;

    expect(messageEls.length).toBe(errorMessages.length);

    for (const msgMatch of errorMessages) {
      let numMatch = 0;
      for (const messageEl of messageEls) {
        if (messageEl.textContent.match(msgMatch)) {
          numMatch++;
        }
      }
      expect(numMatch).toBe(1);
    }
  });
});
