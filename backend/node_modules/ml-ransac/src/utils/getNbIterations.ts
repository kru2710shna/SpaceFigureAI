/**
 * Get the minimal number of iterations of the RANSAC algorithm
 * required to have the given probability of having found the best model.
 *
 * @param probability - Desired probability (between 0 and 1).
 * @param outliersFraction - The estimated fraction of the data that is outliers (from 0 to 1).
 * @param sampleSize - The sample size for the RANSAC algoritm (number of values used for each random test).
 * @returns The minimal number of iterations.
 */
export function getNbIterations(
  probability: number,
  outliersFraction: number,
  sampleSize: number,
): number {
  const value =
    Math.log10(1 - probability) /
    Math.log10(1 - (1 - outliersFraction) ** sampleSize);
  return Math.ceil(value);
}
