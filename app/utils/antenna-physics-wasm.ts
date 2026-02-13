/**
 * Antenna Physics Calculations using WebAssembly
 *
 * This module provides high-performance antenna field calculations
 * using Rust-compiled WebAssembly for CPU-intensive numerical integration.
 */

import initWasm, {
  calculate_field,
  calculate_field_batch,
  calculate_radiation_pattern,
} from "wasm/antenna/pkg/antenna?init";

// WASM initialization state
let wasmInitialized = false;

/**
 * Initialize the WASM module
 */
export async function initAntennaWasm(): Promise<void> {
  if (!wasmInitialized) {
    await initWasm();
    wasmInitialized = true;
  }
}

/**
 * Calculate electric field intensity for a single angle
 *
 * @param theta - Angle off the axis (radians)
 * @param length - Antenna length (in wavelengths lambda)
 * @param type - "traveling" | "standing"
 * @returns Normalized electric field magnitude
 */
export function calculateField(
  theta: number,
  length: number,
  type: "traveling" | "standing",
): number {
  if (!wasmInitialized) {
    throw new Error("WASM not initialized. Call initAntennaWasm() first.");
  }
  return calculate_field(theta, length, type);
}

/**
 * Calculate electric field intensity for multiple angles in batch
 *
 * This is significantly more efficient than calling calculateField multiple times
 * as it reduces JavaScript <-> WebAssembly call overhead.
 *
 * @param angles - Array of angles in radians
 * @param length - Antenna length (in wavelengths lambda)
 * @param type - "traveling" | "standing"
 * @returns Array of normalized electric field magnitudes
 */
export function calculateFieldBatch(
  angles: number[],
  length: number,
  type: "traveling" | "standing",
): number[] {
  if (!wasmInitialized) {
    throw new Error("WASM not initialized. Call initAntennaWasm() first.");
  }

  const anglesArray = new Float64Array(angles);
  const outputArray = new Float64Array(angles.length);

  calculate_field_batch(anglesArray, length, type, outputArray);

  return Array.from(outputArray);
}

/**
 * Calculate complete antenna radiation pattern (360 degrees)
 *
 * @param length - Antenna length (in wavelengths lambda)
 * @param type - "traveling" | "standing"
 * @param numPoints - Number of points to calculate (default: 360)
 * @returns Array of normalized field magnitudes for angles 0 to 2π
 */
export function calculateRadiationPattern(
  length: number,
  type: "traveling" | "standing",
  numPoints: number = 360,
): number[] {
  if (!wasmInitialized) {
    throw new Error("WASM not initialized. Call initAntennaWasm() first.");
  }

  const outputArray = new Float64Array(numPoints);

  calculate_radiation_pattern(length, type, numPoints, outputArray);

  return Array.from(outputArray);
}

/**
 * Generate radiation pattern data for polar plot
 *
 * Returns data points suitable for Chart.js or similar plotting libraries.
 *
 * @param length - Antenna length (in wavelengths lambda)
 * @param type - "traveling" | "standing"
 * @param numPoints - Number of points (default: 360)
 * @returns Array of {angle, field} objects where angle is in degrees
 */
export function generateRadiationPatternData(
  length: number,
  type: "traveling" | "standing",
  numPoints: number = 360,
): Array<{ angle: number; field: number; angleRad: number }> {
  const fields = calculateRadiationPattern(length, type, numPoints);

  return fields.map((field, index) => ({
    angle: (360 * index) / numPoints,
    angleRad: (2 * Math.PI * index) / numPoints,
    field,
  }));
}

// Re-export WASM initialization for apps that need direct access
export { initWasm };
