# regression-polynomial-2d

[![NPM version][npm-image]][npm-url]
[![npm download][download-image]][download-url]
[![build status][ci-image]][ci-url]
[![Test coverage][codecov-image]][codecov-url]

Polynomial Regression.

## Installation

`$ npm i ml-regression-polynomial-2d`

## Usage

```js
import { PolynomialRegression2D } from 'ml-regression-polynomial-2d';

const inputs = {
  x: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  y: [
    10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
    29, 30,
  ],
};
const z = [
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
  39, 40,
];
const order = 2; // setup the maximum degree of the polynomial

const regression = new PolynomialRegression2D(inputs, z, { order });

//prediction
console.log(regression.predict({ x: 0.5, y: 1.5 })); // Apply the model to some x tuple.
console.log(regression.predict({ x: [0.5, 1.5], y: [1.5, 2.5] })); // Apply the model to an array of points tuple.
console.log(regression.coefficients); // Prints the coefficients in increasing order of power (from 0 to degree).
console.log(regression.toString(3)); // Prints a human-readable version of the function.
console.log(regression.toLaTeX());
console.log(regression.score); // { r, r2, chi2, rmsd } statistical scores
console.log(regression.getScore(x, y)); // calculate the score for another database
```

## License

[MIT](./LICENSE)

[npm-image]: https://img.shields.io/npm/v/ml-regression-polynomial-2d.svg?style=flat-square
[npm-url]: https://npmjs.org/package/ml-regression-polynomial-2d
[download-image]: https://img.shields.io/npm/dm/ml-regression-polynomial-2d.svg?style=flat-square
[download-url]: https://npmjs.org/package/ml-regression-polynomial-2d
[codecov-image]: https://img.shields.io/codecov/c/github/mljs/regression-polynomial-2d.svg
[codecov-url]: https://codecov.io/gh/mljs/regression-polynomial-2d
[ci-image]: https://github.com/mljs/regression-polynomial-2d/workflows/Node.js%20CI/badge.svg?branch=main
[ci-url]: https://github.com/mljs/regression-polynomial-2d/actions?query=workflow%3A%22Node.js+CI%22
