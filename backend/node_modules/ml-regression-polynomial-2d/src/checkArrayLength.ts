import { DataXY, NumberArray } from 'cheminfo-types';
import { isAnyArray } from 'is-any-array';
/**
 * Check that x and y are arrays with the same length.
 * @param x - first array
 * @param y - second array
 * @throws if x or y are not the same length, or if they are not arrays
 */
export function checkArrayLength(input: DataXY, output: NumberArray) {
  // TODO: This function should be removed and replace by
  // https://github.com/mljs/spectra-processing/blob/main/src/xy/xyCheck.ts
  if (!isAnyArray(input.x) || !isAnyArray(input.y) || !isAnyArray(output)) {
    throw new TypeError('x, y and outputs must be arrays');
  }
  if (input.x.length < 2) {
    throw new RangeError(
      'explanatory variable should be two element per point',
    );
  }

  if (input.x.length !== input.y.length) {
    throw new RangeError('x and y data must have the same length');
  }

  if (input.x.length !== output.length) {
    throw new RangeError('input and outputs must have the same length');
  }
}
