# affine-transform

[![NPM version][npm-image]][npm-url]
[![build status][ci-image]][ci-url]
[![Test coverage][codecov-image]][codecov-url]
[![npm download][download-image]][download-url]

Get and apply affine transform to 2D points.

## Installation

`$ npm i ml-affine-transform`

## Main steps of the algorithm to get the affine transform

Based on the tutorial: https://nghiaho.com/?page_id=671

1. Find centroids of the two point sets and deduce the translation from one to the other
2. Find rotation using SVD

When the transform is applied to a function, the operations are made in the following order:

1. Rotate
2. Scale
3. Translate

## API

The inputs of the functions are 3xN matrices consisting of the source and the destination points. The third dimension for Z must be padded with ones. The output is an object containing the x and y translations as well as the anti-clockwise angle in degrees.

```ts
export interface AffineTransformParameters {
  rotation: number;
  translation: { x: number; y: number };
  scale: number;
}

export function getAffineTransform(
  source: Matrix,
  destination: Matrix,
): AffineTransformParameters;
```

## Coordinates system

In this project, standard x and y axes are used, as in mathematics (y pointing up and x to the right). The angles are expressed in degrees and positive angles are in the anti-clockwise direction.

## Example

```js
import Matrix from 'ml-matrix';
import { getAffineTransform } from '../getAffineTransform';

const sourceMatrix = new Matrix([
  [1, 1, -3], // x
  [2, -1, -1], // y
  [1, 1, 1], // z
]);
const destinationMatrix = new Matrix([
  [4, -2, -2],
  [-2, -2, 6],
  [1, 1, 1],
]);

const result = getAffineTransform(sourceMatrix, destinationMatrix);

// result = {
//   translation: { x: 0, y: 0 },
//   scale: 2,
//   rotation: -90,
// }
```

## License

[MIT](./LICENSE)

[npm-image]: https://img.shields.io/npm/v/ml-affine-transform.svg
[npm-url]: https://www.npmjs.com/package/ml-affine-transform
[ci-image]: https://github.com/mljs/affine-transform/workflows/Node.js%20CI/badge.svg?branch=main
[ci-url]: https://github.com/mljs/affine-transform/actions?query=workflow%3A%22Node.js+CI%22
[codecov-image]: https://img.shields.io/codecov/c/github/mljs/affine-transform.svg
[codecov-url]: https://codecov.io/gh/mljs/affine-transform
[download-image]: https://img.shields.io/npm/dm/ml-affine-transform.svg
[download-url]: https://www.npmjs.com/package/ml-affine-transform
