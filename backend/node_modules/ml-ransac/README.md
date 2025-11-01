# ml-ransac

[![NPM version][npm-image]][npm-url]
[![build status][ci-image]][ci-url]
[![Test coverage][codecov-image]][codecov-url]
[![npm download][download-image]][download-url]

Fit a model to noisy data by excluding outliers. This is an implementation of the RANSAC algorithm..

## Installation

`$ npm i ml-ransac`

## Examples

Finding the best linear regression which doesn't take the outliers into account:

```js
import { levenbergMarquardt } from 'ml-levenberg-marquardt'; // library allowing you to find a regression of any type
import { ransac } from 'ml-ransac';

// defining the model function: a line
export type LineFunction = (x: number) => number;

export function line([a, b]: number[]): LineFunction {
  return (x: number) => a * x + b;
}

// defining the fit function: we create a linear regression using levenberg-maquard
export interface LinearRegressionOptions {
  /**
   * Initial parameter values.
   *
   * @default [0,0]
   */
  initialValues?: number[];
}

export function linearRegression(
  source: number[],
  destination: number[],
  options: LinearRegressionOptions = {},
): number[] {
  const { initialValues = [0, 0] } = options;
  const result = levenbergMarquardt({ x: source, y: destination }, line, {
    initialValues,
  });

  return result.parameterValues;
}

// data
const source = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const destination = [-6, -2, 0, 5, 0, 0, -1, 1, 0, 0, -1, 0, 3];

// finding the best model
const result = ransac(source, destination, {
  distanceFunction,
  fitFunction,
  modelFunction,
  threshold: 1.1,
  sampleSize: 2,
  maxNbIterations: 10,
  seed: 0,
});

// result is :
//   {
//     nbIterations: 10,
//     modelParameters: [0, 0],
//     inliers: [2, 4, 5, 6, 7, 8, 9, 10, 11],
//     error: 1,
//   }
```

## License

[MIT](./LICENSE)

[npm-image]: https://img.shields.io/npm/v/ml-ransac.svg
[npm-url]: https://www.npmjs.com/package/ml-ransac
[ci-image]: https://github.com/mljs/ransac/workflows/Node.js%20CI/badge.svg?branch=main
[ci-url]: https://github.com/mljs/ransac/actions?query=workflow%3A%22Node.js+CI%22
[codecov-image]: https://img.shields.io/codecov/c/github/mljs/ransac.svg
[codecov-url]: https://codecov.io/gh/mljs/ransac
[download-image]: https://img.shields.io/npm/dm/ml-ransac.svg
[download-url]: https://www.npmjs.com/package/ml-ransac
