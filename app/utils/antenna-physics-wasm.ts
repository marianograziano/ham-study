/**
 * Antenna Physics Calculations using WebAssembly
 *
 * This module provides high-performance antenna field calculations
 * using Rust-compiled WebAssembly for CPU-intensive numerical integration.
 */

import {
  calculate_antenna_gain,
  calculate_antenna_gain_batch,
  calculate_antenna_radiation_pattern,
  calculate_field,
  calculate_field_batch,
  calculate_radiation_pattern,
} from "wasm/antenna/pkg/antenna";
import initWasm from "wasm/antenna/pkg/antenna?init";

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

/**
 * Calculate antenna gain at a specific angle
 *
 * @param antennaType - Type of antenna ("vertical", "gp", "dp", "yagi", etc.)
 * @param theta - Elevation angle in radians (0 = horizontal plane, π/2 = vertical)
 * @param phi - Azimuth angle in radians (0 = forward direction)
 * @param antennaLength - Antenna length in wavelengths (used for some antenna types)
 * @param activeHarmonic - Active harmonic number (used for EndFed, Windom)
 * @param isInvertedV - Inverted V flag (used for Windom)
 * @param radialAngle - Radial angle string ("60", "135") for GP antennas
 * @returns Normalized gain value (0.0 to 1.0+)
 */
export function calculateAntennaGain(
  antennaType: string,
  theta: number,
  phi: number,
  antennaLength: number,
  activeHarmonic: number = 1,
  isInvertedV: boolean = false,
  radialAngle: string = "60",
): number {
  if (!wasmInitialized) {
    throw new Error("WASM not initialized. Call initAntennaWasm() first.");
  }
  return calculate_antenna_gain(
    antennaType,
    theta,
    phi,
    antennaLength,
    activeHarmonic,
    isInvertedV,
    radialAngle,
  );
}

/**
 * Calculate antenna gain for multiple angles in batch
 *
 * @param antennaType - Type of antenna
 * @param anglesTheta - Array of elevation angles in radians
 * @param anglesPhi - Array of azimuth angles in radians (same length as anglesTheta)
 * @param antennaLength - Antenna length in wavelengths
 * @param activeHarmonic - Active harmonic number
 * @param isInvertedV - Inverted V flag
 * @param radialAngle - Radial angle string
 * @returns Array of gain values
 */
export function calculateAntennaGainBatch(
  antennaType: string,
  anglesTheta: number[],
  anglesPhi: number[],
  antennaLength: number,
  activeHarmonic: number = 1,
  isInvertedV: boolean = false,
  radialAngle: string = "60",
): number[] {
  if (!wasmInitialized) {
    throw new Error("WASM not initialized. Call initAntennaWasm() first.");
  }

  if (anglesTheta.length !== anglesPhi.length) {
    throw new Error("anglesTheta and anglesPhi must have the same length");
  }

  const anglesThetaArray = new Float64Array(anglesTheta);
  const anglesPhiArray = new Float64Array(anglesPhi);
  const outputArray = new Float64Array(anglesTheta.length);

  calculate_antenna_gain_batch(
    antennaType,
    anglesThetaArray,
    anglesPhiArray,
    antennaLength,
    activeHarmonic,
    isInvertedV,
    radialAngle,
    outputArray,
  );

  return Array.from(outputArray);
}

/**
 * Calculate antenna radiation pattern (360 degrees in azimuth)
 *
 * @param antennaType - Type of antenna
 * @param theta - Fixed elevation angle in radians
 * @param antennaLength - Antenna length in wavelengths
 * @param activeHarmonic - Active harmonic number
 * @param isInvertedV - Inverted V flag
 * @param radialAngle - Radial angle string
 * @param numPoints - Number of azimuth points to calculate (default: 360)
 * @returns Array of gain values for azimuth angles 0 to 2π
 */
export function calculateAntennaRadiationPattern(
  antennaType: string,
  theta: number,
  antennaLength: number,
  activeHarmonic: number = 1,
  isInvertedV: boolean = false,
  radialAngle: string = "60",
  numPoints: number = 360,
): number[] {
  if (!wasmInitialized) {
    throw new Error("WASM not initialized. Call initAntennaWasm() first.");
  }

  const outputArray = new Float64Array(numPoints);

  calculate_antenna_radiation_pattern(
    antennaType,
    theta,
    antennaLength,
    activeHarmonic,
    isInvertedV,
    radialAngle,
    numPoints,
    outputArray,
  );

  return Array.from(outputArray);
}

// Re-export WASM initialization for apps that need direct access
export { initWasm };
