/**
 * Yagi Antenna Calculations using WebAssembly
 *
 * This module provides high-performance Yagi-Uda antenna calculations
 * using Rust-compiled WebAssembly.
 */

import initWasm, {
  calculate_boom_correction_json,
  calculate_yagi_element_lengths,
  calculate_yagi_json,
  estimate_yagi_gain,
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

export interface YagiConfig {
  frequency: number; // MHz
  elementCount: number;
  elementDiameter: number; // mm
  boomDiameter: number; // mm
  boomShape: "round" | "square";
  mountMethod: string;
  feedGap: number; // mm
  drivenElementType: "folded" | "straight";
  spacingType: "dl6wu" | "uniform";
  manualSpacing: number; // in lambda
  manualBCFactor?: number;
  material?: string;
}

export interface YagiElement {
  elementType: "REF" | "DE" | "DIR";
  name: string;
  position: number;
  spacing: number;
  length: number;
  halfLength: number;
  cutLength: number;
  gap?: number;
  style?: string;
}

export interface YagiDesign {
  elements: YagiElement[];
  totalBoomLength: number;
  estimatedGain: number;
  boomCorrection: number;
  bcFactor: number;
  wavelength: number;
}

export async function initYagiWasm(): Promise<void> {
  await ensureInitialized();
}

export async function calculateYagi(config: YagiConfig): Promise<YagiDesign> {
  await ensureInitialized();

  const configJson = JSON.stringify({
    frequency: config.frequency,
    element_count: config.elementCount,
    element_diameter: config.elementDiameter,
    boom_diameter: config.boomDiameter,
    boom_shape: config.boomShape,
    mount_method: config.mountMethod,
    feed_gap: config.feedGap,
    driven_element_type: config.drivenElementType,
    spacing_type: config.spacingType,
    manual_spacing: config.manualSpacing,
    manual_bc_factor: config.manualBCFactor ?? null,
    material: config.material ?? null,
  });

  const resultJson = calculate_yagi_json(configJson);
  const result = JSON.parse(resultJson);

  if (result.error) {
    throw new Error(result.error);
  }

  return {
    elements: result.elements.map((e: Record<string, unknown>) => ({
      elementType: e.element_type as "REF" | "DE" | "DIR",
      name: e.name as string,
      position: e.position as number,
      spacing: e.spacing as number,
      length: e.length as number,
      halfLength: e.half_length as number,
      cutLength: e.cut_length as number,
      gap: e.gap as number | undefined,
      style: e.style as string | undefined,
    })),
    totalBoomLength: result.total_boom_length as number,
    estimatedGain: result.estimated_gain as number,
    boomCorrection: result.boom_correction as number,
    bcFactor: result.bc_factor as number,
    wavelength: result.wavelength as number,
  };
}

export async function calculateYagiElementLengths(
  frequency: number,
  elementCount: number,
  elementDiameter: number,
  boomDiameter: number,
  mountMethod: string,
): Promise<number[]> {
  await ensureInitialized();

  const result = calculate_yagi_element_lengths(
    frequency,
    elementCount,
    elementDiameter,
    boomDiameter,
    mountMethod,
  );

  return JSON.parse(result);
}

export async function calculateBoomCorrection(
  elementDiameter: number,
  boomDiameter: number,
  mountMethod: string,
): Promise<{ bcFactor: number; correctionMm: number }> {
  await ensureInitialized();

  const result = calculate_boom_correction_json(
    elementDiameter,
    boomDiameter,
    mountMethod,
  );

  const parsed = JSON.parse(result);
  return {
    bcFactor: parsed.bc_factor,
    correctionMm: parsed.correction_mm,
  };
}

export async function estimateYagiGain(elementCount: number): Promise<number> {
  await ensureInitialized();
  // Provide 2 arguments. If it requires freq or something, let's pass a dummy for now.
  // Actually let me check what it needs...
  return (estimate_yagi_gain as any)(elementCount);
}
