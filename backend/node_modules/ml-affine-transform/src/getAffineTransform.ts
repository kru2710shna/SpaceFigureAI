import Matrix, { SingularValueDecomposition, determinant } from 'ml-matrix';

import { getCentroid } from './getCentroid';

export interface AffineTransform {
  /**
   * Translation of source points along x and y axes.
   */
  translation: { x: number; y: number };
  /**
   * Clockwise angle in degrees.
   */
  rotation: number;
  scale: number;
}

/**
 * Get best rotation and translation of source points to destination points.
 * Based on {@link https://nghiaho.com/?page_id=671}
 *
 * @param source - Source points as a 3xN matrix. Third dimension must be padded with ones.
 * @param destination - Destination points as a 3xN matrix. Third dimension must be padded with ones.
 * @returns The affine transformation.
 */
export function getAffineTransform(
  source: Matrix,
  destination: Matrix,
): AffineTransform {
  if (source.columns !== destination.columns) {
    throw new Error(
      'Source and destination matrices should have same dimensions (same number of points).',
    );
  }
  if (source.columns < 2) {
    throw new Error(
      'Matrices should contain at least two points for the algorithm to run properly.',
    );
  }
  const sourceCentroid = getCentroid(source);
  const destinationCentroid = getCentroid(destination);

  const translatedSource = source.clone().subColumnVector(sourceCentroid);
  const translatedDestination = destination
    .clone()
    .subColumnVector(destinationCentroid);

  // computing scale
  let ratioSum = 0;
  const nbPoints = source.columns;
  for (let i = 0; i < nbPoints; i++) {
    const sourcePoint = translatedSource.getColumn(i);
    const destinationPoint = translatedDestination.getColumn(i);
    ratioSum +=
      getDistanceToOrigin(destinationPoint) / getDistanceToOrigin(sourcePoint);
  }
  const scale = ratioSum / nbPoints;

  const scaledSource = Matrix.mul(translatedSource, scale);

  // computing rotation
  const covarianceMatrix = scaledSource.mmul(translatedDestination.transpose());

  const svd = new SingularValueDecomposition(covarianceMatrix);

  const U = svd.leftSingularVectors;
  const V = svd.rightSingularVectors;

  let rotation = V.mmul(U.transpose());
  if (determinant(rotation) < 0) {
    const newV = V.mulColumn(2, -1);

    rotation = newV.mmul(U.transpose());
  }

  let angleDegrees =
    (Math.atan2(rotation.get(1, 0), rotation.get(0, 0)) * 180) / Math.PI;

  if (angleDegrees === -180) {
    angleDegrees = 180;
  }

  // computing translation
  const translation = Matrix.sub(
    destinationCentroid,
    Matrix.mul(rotation.mmul(sourceCentroid), scale),
  );

  return {
    translation: {
      x: translation.get(0, 0),
      y: translation.get(1, 0),
    },
    rotation: angleDegrees,
    scale,
  };
}

function getDistanceToOrigin(point: number[]): number {
  return Math.hypot(point[0], point[1]);
}
