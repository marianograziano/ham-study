export interface MoxonConfig {
  frequency: number; // MHz
  wireDiameter: number; // mm
}

export interface MoxonDesign {
  config: MoxonConfig;
  wavelength: number; // meters
  A: number; // Driven Element Width (mm)
  B: number; // Driven Element Tail (mm)
  C: number; // Gap (mm)
  D: number; // Reflector Tail (mm)
  E: number; // Total Depth (mm)
  wireLengthDriven: number; // mm
  wireLengthReflector: number; // mm
  totalWidth: number; // mm
  totalHeight: number; // mm
  geometry: {
    width: number;
    depth: number;
  };
}

let wasmMoxon: Awaited<typeof import("~/utils/moxon-wasm")> | null = null;

async function getWasmModule() {
  if (!wasmMoxon) {
    try {
      wasmMoxon = await import("~/utils/moxon-wasm");
    } catch {
      // WASM not available
    }
  }
  return wasmMoxon;
}

async function calculateMoxonWasm(config: MoxonConfig): Promise<MoxonDesign> {
  const wasm = await getWasmModule();

  if (wasm) {
    try {
      const result = await wasm.calculateMoxon({
        frequency: config.frequency,
        wireDiameter: config.wireDiameter,
      });

      return {
        config,
        wavelength: result.wavelength,
        A: result.aWidth,
        B: result.bDrivenTail,
        C: result.cGap,
        D: result.dRefTail,
        E: result.eDepth,
        wireLengthDriven: result.wireLengthDriven,
        wireLengthReflector: result.wireLengthReflector,
        totalWidth: result.totalWidth,
        totalHeight: result.totalHeight,
        geometry: {
          width: result.geometryWidth,
          depth: result.geometryDepth,
        },
      };
    } catch {
      // Fall back to JS implementation
    }
  }

  return calculateMoxonJs(config);
}

export async function calculateMoxon(
  config: MoxonConfig,
): Promise<MoxonDesign> {
  return calculateMoxonWasm(config);
}

export function calculateMoxonJs(config: MoxonConfig): MoxonDesign {
  const { frequency, wireDiameter } = config;
  const lambda = 299792.458 / frequency;
  const lambdaM = 299.792458 / frequency;

  const dia = wireDiameter > 0 ? wireDiameter : 1.0;
  const ratio = lambda / dia;
  const X = Math.log10(ratio);

  const A_factor =
    0.284203 + 0.054366 * X - 0.010186 * X ** 2 + 0.000636 * X ** 3;

  const B_factor_refTail =
    0.024443 + 0.027038 * X - 0.006927 * X ** 2 + 0.000624 * X ** 3;

  const D_factor_drivenTail =
    0.012921 + 0.027735 * X - 0.007624 * X ** 2 + 0.000713 * X ** 3;

  const C_factor_depth =
    0.170617 - 0.026772 * X + 0.004944 * X ** 2 - 0.000297 * X ** 3;

  const Dim_A_Width = A_factor * lambda;
  const Dim_RefTail = B_factor_refTail * lambda;
  const Dim_DrivenTail = D_factor_drivenTail * lambda;
  const Dim_Depth = C_factor_depth * lambda;

  const Dim_Gap = Dim_Depth - Dim_DrivenTail - Dim_RefTail;

  const designA = Dim_A_Width;
  const designB = Dim_DrivenTail;
  const designC = Dim_Gap > 0 ? Dim_Gap : 0;
  const designD = Dim_RefTail;
  const designE = Dim_Depth;

  return {
    config,
    wavelength: lambdaM,
    A: designA,
    B: designB,
    C: designC,
    D: designD,
    E: designE,
    totalWidth: designA,
    totalHeight: designE,
    geometry: {
      width: designA,
      depth: designE,
    },
    wireLengthDriven: designA + 2 * designB,
    wireLengthReflector: designA + 2 * designD,
  };
}
