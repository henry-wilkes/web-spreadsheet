/* Web Spreadsheet
 * Copyright (C) 2020 Henry Wilkes

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.

 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


class TextRegion {
  constructor (index, length) {
    this.index = index;
    this.length = length;
  }
}

function sortRegion (regA, regB) {
  if (regA.length === 0) {
    return -1;
  }
  if (regB.length === 0) {
    return +1;
  }
  const startA = regA.index;
  const startB = regB.index;
  if (startA < startB) {
    return -1;
  } else if (startA > startB) {
    return +1;
  }
  const endA = startA + regA.length;
  const endB = startB + regB.length;
  if (endA < endB) {
    return -1;
  } else if (endA > endB) {
    return +1;
  }
  return 0;
}

function mergeRegions (regions) {
  regions.sort(sortRegion);

  let i = 0;
  while (i < regions.length && regions[i].length === 0) {
    i++;
  }
  regions.splice(0, i);

  i = 0;
  while (i < regions.length) {
    const reg = regions[i];
    const start = reg.index;
    /* goes one index further than the last character in the region */
    let end = start + reg.length;
    let num = 1;
    while (i + num < regions.length) {
      const other = regions[i + num];
      const otherStart = other.index;
      if (otherStart <= end) {
        /* the start comes before the end of this merging region, or
         * is just after the merging region */
        if (end < otherStart + other.length) {
          end = otherStart + other.length;
        }
        num++;
      } else {
        break;
      }
    }
    /* NOTE: num includes self */
    if (num !== 1) {
      /* edit first, and remove rest */
      reg.length = end - start;
      num--;
      regions.splice(i + 1, num);
    }
    i++;
  }
}

export { TextRegion, mergeRegions };
