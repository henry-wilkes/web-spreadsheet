# Web Spreadsheet Demo

A web spreadsheet with error handling.

## Running the demo

After cloning the project, you can likely run the demo immediately. The project
is in vanilla ES6 JavaScript and can runs in a browser. However, since it uses
modules, you will have to run it through a server.

In the project directory, I used

```
python -m http.server
```

and then navigated to `localhost:8000/demo.html`. The demo is known to work in
Firefox.

### How to use

You can select a cell by clicking on it. The selected cell should have a thick
black border. You can also navigate between neighbouring cells using the Control
key with the arrow keys (the arrow keys without the Control key can still be
used as normal when editing cell entries).

At the bottom of the screen is the cell entry for the currently selected cell.
The entry accept strings, decimal numbers (non-exponent) and formulas (any entry
that starts with the equal sign `=`).

A formula can contain:

+ Numbers;
+ References to spreadsheet cell values, in the format
  `<column-letter><row-number>` (in upper or lower case).
+ The negative operator `-`;
+ The binary operators `+`, `-`, `*` and `/`, for addition, subtraction,
  multiplication and division, respectively;
+ The functions `sum` and `avg` (in upper or lower case) which sum and average
  their arguments, respectively. These can also contain references to cell
  ranges, in the format `<column-letter><row-start>:<column-letter><row-end>`
  (in upper or lower case). Each cell referenced in the range will be added to
  the function arguments. These two functions may refer to empty cells, but
  they will be ignored as arguments.

Number and string entries are shown live in the spreadsheet cell, but formulas
entries will not be applied until the user commits them explicitly by pressing
Enter, moving to another cell (by clicking or keyboard navigation), clicking
on the same cell, or moving focus.

In addition to committing the entry to a cell, pressing Enter will also move you
to the next cell below. If you want to commit the value but remain on the same
cell (to check for errors), you can hold the Control or Shift key when pressing
Enter.

When a formula cell is selected, each of the cells it references directly will
be highlighted with a thick blue border.

### Formula Error handling

The spreadsheet is able to handle various errors in formulas. If a formula is
undetermined it will show as `???` in the spreadsheet cell and be highlighted
red when it is not selected.

If a formula is syntactically invalid when it is committed an error message will
appear underneath the entry describing the problem. In addition, the part of the
formula that caused the error will be colored red within the entry. Note, only
the first spotted error in an invalid formula is shown.

A formula that is syntactically valid may still be undetermined in the following
cases:

+ It references an empty cell (outside of `sum` and `avg`).
+ It references a cell that is outside of the spreadsheet (e.g. `a51`).
+ It references a cell that has an undetermined or string value.
+ It is part of a dependency cycle (e.g. `a1` refers to `a2`, which refers to
  `a1` back).
+ It contains a function that has an undetermined value. Currently this is only
  caused by `avg` when it only refers to empty cells or has no arguments.

In the first 3 cases, the corresponding references will be highlighted in red in
the entry. In the case of a dependency cycles, the references that are at the
start of a cycle will be highlighted in the entry. In the case of the
undetermined function, the function and its arguments will be highlighted.

Each error will have a corresponding message, which will refer to the
corresponding cells individual in the format `<cell-name> (<how they appear in
the formula>)`.

## Running tests

To run the tests you will first need to install the dependencies by running in
the project root:

```
npm install
```

After this, you can run the tests for the modules with:

```
npm test
```
