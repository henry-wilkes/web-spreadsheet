import { TextRegion, mergeRegions } from '../modules/text-regions.js'

function toRegionList(regionRanges) {
  return regionRanges.map(
    range => new TextRegion(range[0], range[1] - range[0]));
}

describe('text region merging', () => {
  test.each([
    /* just touching */
    [[[0, 5], [5, 8]], [[0, 8]]],
    /* overlap */
    [[[0, 6], [5, 8]], [[0, 8]]],
    /* contained */
    [[[1, 6], [0, 8]], [[0, 8]]],
    /* no overlap */
    [[[0, 4], [5, 8]], [[0, 4], [5, 8]]],
    /* chained */
    [[[0, 3], [1, 2], [3, 8], [4, 7], [8, 10]], [[0, 10]]],
    /* re-ordered */
    [[[3, 8], [1, 2], [8, 10], [4, 7], [0, 3]], [[0, 10]]],
    [[[1, 2], [8, 10], [0, 3], [3, 8], [4, 7]], [[0, 10]]],
    /* empty regions are lost */
    [[[1, 1], [9, 9]], []],
    [[[9, 12], [3, 7], [7, 7], [2, 2], [7, 8], [13, 13]], [[3, 8], [9, 12]]],
    /* complex */
    [[
      [20, 22], [13, 15], [9, 10], [29, 32], [21, 25], [16, 20], [27, 35],
      [12, 12], [1, 4], [7, 11], [21, 21], [28, 29], [0, 0]
    ], [
      [1, 4], [7, 11], [13, 15], [16, 25], [27, 35]
    ]]
  ])('merge %j', (regions, merged) => {
    regions = toRegionList(regions);
    merged = toRegionList(merged);

    mergeRegions(regions);
    expect(regions).toStrictEqual(merged);
  });
});
