import { CellGraph } from './cell-graph.js';

function getColumnLetters (numColumns) {
  const colLetters = Array(numColumns);

  const aCode = 'a'.charCodeAt();
  const zCode = 'z'.charCodeAt();
  const colCode = [];

  for (let c = 0; c < numColumns; c++) {
    let i = colCode.length - 1;
    while (i >= 0 && colCode[i] === zCode) {
      colCode[i] = aCode;
      i--;
    }
    if (i < 0) {
      colCode.unshift(aCode);
    } else {
      colCode[i]++;
    }
    colLetters[c] = String.fromCharCode(...colCode);
  }

  return colLetters;
}

function formatNumber (number) {
  let format = String(number);
  if (format.length <= 8) {
    return format;
  }
  /* get most precise we can */
  for (let precision = 8; precision >= 2; precision--) {
    format = number.toPrecision(precision).replace(
      /\.0+(e.*)?$/, '$1'
    ).replace(
      /(^-?[0-9]+\.[0-9]*[1-9])0+(e.*)?$/, '$1$2');
    if (format.length <= 8) {
      return format;
    }
  }
  return format;
}

const formulaRe = /^\s*=/;

class SpreadSheetApp {
  constructor (root, numColumns, numRows) {
    /* data setup */
    this.graph = new CellGraph(numColumns, numRows,
      this.cellDisplayValueChanged.bind(this));

    /* double direction map
     * Cell Elements should never be destroyed/replaced */
    this.cellEls = new Map();
    this.cellNames = new Map();

    this.colLetters = getColumnLetters(numColumns);
    this.numRows = numRows;

    this.selected = null;
    this.selectedCol = undefined;
    this.selectedRow = undefined;
    this.selectedCellName = null;
    this.dependsOn = [];

    this.inputCommited = false;
    this.inputText = '';

    root.classList.add('app-window');
    root.appendChild(this.createTableArea(numColumns, numRows));
    root.appendChild(this.createEntryArea());

    this.selectCoordCell(0, 1);
    root.addEventListener('keyup', this.arrowKeyPress.bind(this));
  }

  applyEntry () {
    if (this.inputCommited === false) {
      this.inputComitted = true;
      if (this.selectedCellName !== null) {
        this.graph.setCellEntry(this.selectedCellName, this.inputText);
      }
    }
  }

  selectCell (cellEl, cellName, cellCol, cellRow) {
    /* make sure we set the entry before we select the next cell */
    this.applyEntry();

    const prevSelected = this.selected;
    this.selected = cellEl;
    this.selectedCol = cellCol;
    this.selectedRow = cellRow;
    this.selectedCellName = cellName;

    for (const depEl of this.dependsOn) {
      depEl.classList.remove('depended-on');
    }
    this.dependsOn = [];

    if (prevSelected !== null) {
      prevSelected.classList.remove('selected');
    }
    if (cellEl === null) {
      this.setCurrentEntry(null);
    } else {
      const entry = this.graph.getCellEntry(cellName);
      if (entry !== null && entry.dependsOn !== undefined) {
        for (const dep of entry.dependsOn) {
          const els = this.cellEls.get(dep);
          if (els !== undefined) {
            const depCell = els.cell;
            depCell.classList.add('depended-on');
            this.dependsOn.push(depCell);
          }
        }
      }
      cellEl.classList.add('selected');
      this.setCurrentEntry(entry);
      this.userEntry.focus();
      const range = document.createRange();
      range.selectNodeContents(this.userEntry);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (prevSelected === null) {
      /* re-enable the input */
      this.userEntry.removeAttribute('disabled');
    }
    if (cellEl === null) {
      this.userEntry.setAttribute('disabled', 'disabled');
    }
  }

  selectCellFromElement (cellEl) {
    if (cellEl === null) {
      this.selectCell(null, null, undefined, undefined);
    }
    const cellName = this.cellNames.get(cellEl);
    if (cellName === undefined) {
      /* cellEl is not actually a cell element */
      return;
    }

    this.selectCell(cellEl, cellName.cellName, cellName.col, cellName.row);
  }

  selectCoordCell (cellCol, cellRow) {
    /* if selectedCol/Row are undefined, this is still safe since the bound
     * checks will fail */
    if (cellCol >= 0 && cellCol < this.colLetters.length &&
        cellRow >= 1 && cellRow <= this.numRows) {
      const cellName = this.colLetters[cellCol] + String(cellRow);
      const cellEl = this.cellEls.get(cellName);
      if (cellEl === undefined) {
        console.error('Spreadsheet is missing the cell ', cellName);
        return;
      }
      this.selectCell(cellEl.cell, cellName, cellCol, cellRow);
    }
  }

  selectRelativeCell (cellColShift, cellRowShift) {
    this.selectCoordCell(this.selectedCol + cellColShift,
      this.selectedRow + cellRowShift);
  }

  arrowKeyPress (ev) {
    if (ev.getModifierState('Control') === true) {
      let shiftRow = 0;
      let shiftCol = 0;
      switch (ev.key) {
        case 'ArrowUp':
          shiftRow = -1;
          break;
        case 'ArrowDown':
          shiftRow = 1;
          break;
        case 'ArrowRight':
          shiftCol = 1;
          break;
        case 'ArrowLeft':
          shiftCol = -1;
          break;
      }
      if (shiftRow !== 0 || shiftCol !== 0) {
        this.selectRelativeCell(shiftCol, shiftRow);
        ev.preventDefault();
      }
    }
  }

  cellDisplayValueChanged (cellName, displayValue, isSpecialValue) {
    const els = this.cellEls.get(cellName);
    if (els === undefined) {
      console.error('Spreadsheet is missing the cell ', cellName);
      return;
    }

    const { cell, text } = els;

    if (displayValue === undefined) {
      cell.classList.remove('number');
      cell.classList.add('undetermined');
      text.textContent = '???';
    } else if (typeof displayValue === 'number') {
      cell.classList.remove('undetermined');
      cell.classList.add('number');
      text.textContent = formatNumber(displayValue);
    } else {
      cell.classList.remove('undetermined');
      cell.classList.remove('number');
      text.textContent = displayValue;
    }
    if (isSpecialValue === true) {
      cell.classList.add('special-value');
    } else {
      cell.classList.remove('special-value');
    }
  }

  childClicked (ev) {
    this.selectCellFromElement(ev.target);
  }

  createTableArea () {
    const area = document.createElement('div');
    area.classList.add('table-area');

    const table = document.createElement('table');
    table.classList.add('table');
    area.appendChild(table);

    table.addEventListener('click', this.childClicked.bind(this));

    const tableHead = document.createElement('thead');
    const tableBody = document.createElement('tbody');
    table.appendChild(tableHead);
    table.appendChild(tableBody);

    for (let r = 0; r <= this.numRows; r++) {
      const row = document.createElement('tr');
      const rowHeader = document.createElement('th');
      rowHeader.setAttribute('scope', 'row');
      if (r === 0) {
        rowHeader.classList.add('corner-header');
      } else {
        const text = document.createTextNode(String(r));
        rowHeader.appendChild(text);
        rowHeader.classList.add('row-header');
      }
      row.appendChild(rowHeader);

      for (let c = 0; c < this.colLetters.length; c++) {
        const colName = this.colLetters[c];
        let cell;
        if (r === 0) {
          cell = document.createElement('th');
          cell.setAttribute('scope', 'col');
          cell.classList.add('column-header');
          const text = document.createTextNode(colName.toUpperCase());
          cell.appendChild(text);
        } else {
          const cellName = colName + String(r);
          cell = document.createElement('td');
          cell.classList.add('cell');
          const text = document.createTextNode('');
          cell.appendChild(text);
          this.cellEls.set(cellName, { cell: cell, text: text });
          this.cellNames.set(cell, { cellName: cellName, col: c, row: r });
        }
        row.appendChild(cell);
      }

      if (r === 0) {
        tableHead.appendChild(row);
      } else {
        tableBody.appendChild(row);
      }
    }

    return area;
  }

  appendErrorMessage (message) {
    const errorMessage = document.createElement('div');
    errorMessage.classList.add('entry-error-message');
    errorMessage.appendChild(document.createTextNode(message));
    this.entryErrorArea.appendChild(errorMessage);
  }

  appendNormalEntryNode (text) {
    this.userEntry.appendChild(document.createTextNode(text));
  }

  appendErrorEntryNode (text) {
    const errorNode = document.createElement('span');
    errorNode.classList.add('entry-inline-error');
    errorNode.appendChild(document.createTextNode(text));
    this.userEntry.appendChild(errorNode);
  }

  setCurrentEntry (entryInfo) {
    /* clear */
    this.userEntry.textContent = '';
    this.entryErrorArea.textContent = '';
    if (entryInfo === null) {
      this.inputText = '';
      return;
    }

    const text = entryInfo.text;

    const errorRegions = entryInfo.errorRegions;
    if (errorRegions === undefined || errorRegions.length === 0) {
      this.appendNormalEntryNode(text);
    } else {
      let start = errorRegions[0].index;
      let end = start + errorRegions[0].length;
      let firstIndex;
      let prevEnd;
      if (start === 0) {
        this.appendErrorEntryNode(text.slice(start, end));
        prevEnd = end;
        firstIndex = 1;
      } else {
        prevEnd = 0;
        firstIndex = 0;
      }

      /* alternate */
      for (let i = firstIndex; i < errorRegions.length; i++) {
        const region = errorRegions[i];
        start = region.index;
        end = region.index + region.length;
        this.appendNormalEntryNode(text.slice(prevEnd, start));
        this.appendErrorEntryNode(text.slice(start, end));
        prevEnd = end;
      }

      if (prevEnd < text.length) {
        this.appendNormalEntryNode(text.slice(prevEnd, text.length));
      }
    }
    this.inputText = text;
    if (entryInfo.errorMessages !== undefined) {
      for (const message of entryInfo.errorMessages) {
        this.appendErrorMessage(message);
      }
    }
  }

  entryInput (ev) {
    if (this.selected === null) {
      return;
    }
    const text = this.userEntry.textContent;
    this.inputText = text;
    this.inputCommited = false;
    if (text.match(formulaRe) === null) {
      /* live update if not a formula */
      this.applyEntry();
    }
  }

  entryEnterKeyDown (ev) {
    if (ev.key === 'Enter') {
      ev.preventDefault();
    }
  }

  entryEnterKey (ev) {
    if (ev.key === 'Enter') {
      if (ev.getModifierState('Shift') === false &&
          ev.getModifierState('Control') === false) {
        this.selectRelativeCell(0, 1);
      } else {
        this.selectRelativeCell(0, 0);
      }
      ev.preventDefault();
    }
  }

  entryBlur (ev) {
    this.selectRelativeCell(0, 0);
  }

  createEntryArea () {
    const area = document.createElement('div');
    area.classList.add('entry-area');

    const userEntry = document.createElement('div');
    userEntry.classList.add('user-entry');
    userEntry.setAttribute('tab-index', '0');
    userEntry.setAttribute('contenteditable', 'true');
    userEntry.setAttribute('spellcheck', 'false');
    userEntry.addEventListener('input', this.entryInput.bind(this));
    userEntry.addEventListener('keyup', this.entryEnterKey.bind(this));
    userEntry.addEventListener('keydown', this.entryEnterKeyDown.bind(this));
    userEntry.addEventListener('blur', this.entryBlur.bind(this));

    const errorArea = document.createElement('div');
    errorArea.classList.add('entry-error-message-area');

    area.appendChild(userEntry);
    area.appendChild(errorArea);

    this.userEntry = userEntry;
    this.entryErrorArea = errorArea;
    return area;
  }
}

export { SpreadSheetApp };
