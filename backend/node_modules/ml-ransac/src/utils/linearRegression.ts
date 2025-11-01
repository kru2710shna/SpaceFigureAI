import { levenbergMarquardt } from 'ml-levenberg-marquardt';

export type LineFunction = (x: number) => number;

export interface LinearRegressionOptions {
  /**
   * Initial parameter values.
   *
   * @default [0,0]
   */
  initialValues?: number[];
}
/**
 * Get the line function with given slope and offset.
 *
 * @param root0 - Line parameters.
 * @param root0."0" - Slope.
 * @param root0."1" - Offset.
 * @returns The line function.
 */
export function line([a, b]: number[]): LineFunction {
  return (x: number) => a * x + b;
}

/**
 * Compute linear regression parameters for the given data.
 *
 * @param source - Source data.
 * @param destination - Destination data.
 * @param options
 * @returns Line parameters.
 */
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
