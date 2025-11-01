import { applyTransformToPoint } from './applyTransformToPoint';
import { AffineTransform } from './getAffineTransform';
/**
 * Apply the affine transform to a set of points in the [x,y] format.
 *
 * @param points - Points to transfrom.
 * @param transform  - Affine transformation.
 * @returns The transformed points in the [x,y] format.
 */
export function applyTransformToPoints(
  points: number[][],
  transform: AffineTransform,
): number[][] {
  const result: number[][] = [];

  for (const point of points) {
    result.push(applyTransformToPoint(point, transform));
  }

  return result;
}
