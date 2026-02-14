/**
 * Moxon Antenna Calculations using WebAssembly
 *
 * This module provides high-performance Moxon antenna calculations
 * using Rust-compiled WebAssembly.
 */

import initWasm, {
  calculate_moxon_factors_json,
  calculate_moxon_json,
  calculate_moxon_simple_json,
  estimate_moxon_gain,
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

export interface MoxonConfig {
  frequency: number; // MHz
  wireDiameter: number; // mm
}

export interface MoxonDesign {
  wavelength: number; // meters
  aWidth: number; // Driven Element Width (mm)
  bDrivenTail: number; // Driven Element Tail (mm)
  cGap: number; // Gap (mm)
  dRefTail: number; // Reflector Tail (mm)
  eDepth: number; // Total Depth (mm)
  wireLengthDriven: number; // mm
  wireLengthReflector: number; // mm
  totalWidth: number; // mm
  totalHeight: number; // mm
  geometryWidth: number; // mm
  geometryDepth: number; // mm
}

export async function initMoxonWasm(): Promise<void> {
  await ensureInitialized();
}

export async function calculateMoxon(
  config: MoxonConfig,
): Promise<MoxonDesign> {
  await ensureInitialized();

  const configJson = JSON.stringify({
    frequency: config.frequency,
    wire_diameter: config.wireDiameter,
  });

  const resultJson = calculate_moxon_json(configJson);
  const result = JSON.parse(resultJson);

  if (result.error) {
    throw new Error(result.error);
  }

  return {
    wavelength: result.wavelength,
    aWidth: result.a_width,
    bDrivenTail: result.b_driven_tail,
    cGap: result.c_gap,
    dRefTail: result.d_ref_tail,
    eDepth: result.e_depth,
    wireLengthDriven: result.wire_length_driven,
    wireLengthReflector: result.wire_length_reflector,
    totalWidth: result.total_width,
    totalHeight: result.total_height,
    geometryWidth: result.geometry_width,
    geometryDepth: result.geometry_depth,
  };
}

export async function calculateMoxonSimple(
  frequency: number,
  wireDiameter: number,
): Promise<{
  widthMm: number;
  depthMm: number;
  drivenWireLengthMm: number;
  reflectorWireLengthMm: number;
}> {
  await ensureInitialized();

  const result = calculate_moxon_simple_json(frequency, wireDiameter);
  const parsed = JSON.parse(result);

  return {
    widthMm: parsed.width_mm,
    depthMm: parsed.depth_mm,
    drivenWireLengthMm: parsed.driven_wire_length_mm,
    reflectorWireLengthMm: parsed.reflector_wire_length_mm,
  };
}

export async function calculateMoxonFactors(
  frequency: number,
  wireDiameter: number,
): Promise<{
  AFactor: number;
  BFactor: number;
  DFactor: number;
  CFactor: number;
}> {
  await ensureInitialized();

  const result = calculate_moxon_factors_json(frequency, wireDiameter);
  const parsed = JSON.parse(result);

  return {
    AFactor: parsed.A_factor,
    BFactor: parsed.B_factor,
    DFactor: parsed.D_factor,
    CFactor: parsed.C_factor,
  };
}

export async function estimateMoxonGain(): Promise<number> {
  await ensureInitialized();
  return estimate_moxon_gain();
}
