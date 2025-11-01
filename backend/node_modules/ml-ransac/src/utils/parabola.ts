import { levenbergMarquardt } from 'ml-levenberg-marquardt';

export type LineFunction = (x: number) => number;

export interface ParabolaRegressionOptions {
  /**
   * Initial parameter values.
   *
   * @default [0,0,0]
   */
  initialValues?: number[];
}

/**
 * Get the parabola function.
 *
 * @param root0 - Parameters.
 * @param root0."0"
 * @param root0."1"
 * @param root0."2"
 * @returns The parabola.
 */
export function parabola([a, b, c]: number[]): LineFunction {
  return (x: number) => a * x ** 2 + b * x + c;
}

/**
 * Compute linear regression parameters for the given data.
 *
 * @param source - Source data.
 * @param destination - Destination data.
 * @param options
 * @returns Line parameters.
 */
export function parabolaRegression(
  source: number[],
  destination: number[],
  options: ParabolaRegressionOptions = {},
): number[] {
  const { initialValues = [0, 0, 0] } = options;
  const result = levenbergMarquardt({ x: source, y: destination }, parabola, {
    initialValues,
  });

  return result.parameterValues;
}
