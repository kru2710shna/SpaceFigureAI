import { AffineTransform } from './getAffineTransform';
/**
 * Apply the affine transform to a point in the [x,y] format.
 *
 * @param point - Point to transfrom.
 * @param transform  - Affine transformation.
 * @returns The transformed point in the [x,y] format.
 */
export function applyTransformToPoint(
  point: number[],
  transform: AffineTransform,
): number[] {
  const angle = (transform.rotation * Math.PI) / 180;
  const xTranslation = transform.translation.x;
  const yTranslation = transform.translation.y;
  const scale = transform.scale;
  const x =
    scale * (Math.cos(angle) * point[0] - Math.sin(angle) * point[1]) +
    xTranslation;
  const y =
    scale * (Math.sin(angle) * point[0] + Math.cos(angle) * point[1]) +
    yTranslation;

  return [x, y];
}
