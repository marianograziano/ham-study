/**
 * Antenna Pattern Calculations using WebAssembly
 *
 * This module provides high-performance antenna pattern calculations
 * using Rust-compiled WebAssembly.
 */

import initWasm, {
  calculate_pattern_gain,
  calculate_pattern_gain_grid,
  calculate_pattern_radiation,
  get_pattern_antenna_info,
  list_pattern_antenna_types,
} from "wasm/antenna/pkg/antenna";

let wasmInitialized = false;
let initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (wasmInitialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = initWasm().then(() => {
    wasmInitialized = true;
  });

  return initPromise;
}

export type AntennaPatternType =
  | "vertical"
  | "horizontal"
  | "circular"
  | "yagi"
  | "inverted-v"
  | "gp"
  | "positive-v"
  | "quad"
  | "moxon"
  | "elliptical"
  | "end-fed";

export interface AntennaInfo {
  gain: number;
  beamwidth: number;
}

export async function initPatternWasm(): Promise<void> {
  await ensureInitialized();
}

export async function calculatePatternGain(
  antennaType: AntennaPatternType,
  dirX: number,
  dirY: number,
  dirZ: number,
): Promise<number> {
  await ensureInitialized();
  return calculate_pattern_gain(antennaType, dirX, dirY, dirZ);
}

export async function calculatePatternGainGrid(
  antennaType: AntennaPatternType,
  positionsX: number[],
  positionsZ: number[],
  centerSkipRadius: number,
): Promise<number[]> {
  await ensureInitialized();

  const output = new Float64Array(positionsX.length);

  calculate_pattern_gain_grid(
    antennaType,
    new Float64Array(positionsX),
    new Float64Array(positionsZ),
    centerSkipRadius,
    output,
  );

  return Array.from(output);
}

export async function calculatePatternRadiation(
  antennaType: AntennaPatternType,
  numPoints: number,
  elevationAngle: number,
): Promise<number[]> {
  await ensureInitialized();

  const output = new Float64Array(numPoints);

  calculate_pattern_radiation(antennaType, numPoints, elevationAngle, output);

  return Array.from(output);
}

export async function getAntennaInfo(
  antennaType: AntennaPatternType,
): Promise<AntennaInfo> {
  await ensureInitialized();

  const gainOutput = new Float64Array(1);
  const beamwidthOutput = new Float64Array(1);

  get_pattern_antenna_info(antennaType, gainOutput, beamwidthOutput);

  return {
    gain: gainOutput[0],
    beamwidth: beamwidthOutput[0],
  };
}

export async function listAntennaTypes(): Promise<string[]> {
  await ensureInitialized();
  const types = list_pattern_antenna_types();
  return types.split(",");
}
