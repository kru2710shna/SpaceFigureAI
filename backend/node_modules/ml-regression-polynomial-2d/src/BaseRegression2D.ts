import { DataXY, PointXY, type NumberArray } from 'cheminfo-types';
import { isAnyArray } from 'is-any-array';

import { checkArrayLength } from './checkArrayLength';

export interface RegressionScore {
  r: number;
  r2: number;
  chi2: number;
  rmsd: number;
}
export class BaseRegression2D {
  constructor() {
    if (new.target === BaseRegression2D) {
      throw new Error('BaseRegression must be subclassed');
    }
  }

  predict(inputs: PointXY): number;
  predict(inputs: DataXY): NumberArray;
  predict(inputs: PointXY | DataXY): number | NumberArray {
    if (isOnePoint(inputs)) {
      return this._predict(inputs);
    } else if (isAnyArray(inputs.x)) {
      const { x, y } = inputs;
      const result = new Float64Array(x.length);
      for (let i = 0; i < x.length; i++) {
        result[i] = this._predict({ x: x[i], y: y[i] });
      }
      return result;
    } else {
      throw new TypeError('x must be a number or array');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _predict(x: PointXY): number {
    throw new Error('_predict must be implemented');
  }

  train() {
    // Do nothing for this package
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toString(precision?: number) {
    return '';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toLaTeX(precision?: number) {
    return '';
  }

  /**
   * Return the correlation coefficient of determination (r) and chi-square.
   * @param x - explanatory variable
   * @param y - response variable
   * @return - Object with further statistics.
   */
  getScore(input: DataXY, z: NumberArray): RegressionScore {
    checkArrayLength(input, z);
    const y2 = this.predict(input);

    let xSum = 0;
    let ySum = 0;
    let chi2 = 0;
    let rmsd = 0;
    let xSquared = 0;
    let ySquared = 0;
    let xY = 0;
    const n = z.length;
    for (let i = 0; i < n; i++) {
      xSum += y2[i];
      ySum += z[i];
      xSquared += y2[i] * y2[i];
      ySquared += z[i] * z[i];
      xY += y2[i] * z[i];
      if (z[i] !== 0) {
        chi2 += ((z[i] - y2[i]) * (z[i] - y2[i])) / z[i];
      }
      rmsd += (z[i] - y2[i]) * (z[i] - y2[i]);
    }

    const r =
      (n * xY - xSum * ySum) /
      Math.sqrt((n * xSquared - xSum * xSum) * (n * ySquared - ySum * ySum));

    return {
      r,
      r2: r * r,
      chi2,
      rmsd: Math.sqrt(rmsd / n),
    };
  }
}

function isOnePoint(input: PointXY | DataXY): input is PointXY {
  return !isAnyArray(input.x);
}
export { checkArrayLength };
