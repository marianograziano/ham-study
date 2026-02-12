/**
 * Ionospheric Propagation Calculations using WebAssembly
 * 
 * This module provides high-performance propagation calculations
 * using Rust-compiled WebAssembly for CPU-intensive ray tracing.
 */

import initWasm, {
  calculate_signal_path,
  calculate_ground_wave_strength,
  calculate_ground_wave_angle,
  get_propagation_buffer_size,
  calculate_propagation_stats,
  generate_spherical_surface,
  get_spherical_surface_buffer_sizes,
  intersect_sphere_batch,
  SphericalSurfaceParams,
  PropagationParams,
  PropagationMode,
} from "wasm/antenna/pkg/antenna?init";

// WASM initialization state
let wasmInitialized = false;

/**
 * Initialize the WASM module
 */
export async function initPropagationWasm(): Promise<void> {
  if (!wasmInitialized) {
    await initWasm();
    wasmInitialized = true;
  }
}

/**
 * Signal path point
 */
export interface PathPoint {
  x: number;
  y: number;
  z: number;
  isImpact: boolean;
}

/**
 * Propagation statistics
 */
export interface PropagationStats {
  incidenceAngle: number;  // degrees
  muf: number;             // MHz
  isPenetrating: boolean;
  groundWaveStrength: number;
}

/**
 * Calculate signal propagation path
 * 
 * @param mode - "HF" or "UV"
 * @param frequency - Frequency in MHz
 * @param angle - Elevation angle in degrees
 * @param ionoHeight - Ionosphere height (same units as earthRadius)
 * @param earthRadius - Earth radius
 * @param maxHops - Maximum number of hops for HF mode
 * @param criticalFrequency - Critical frequency f0F2 in MHz (default: 7)
 * @returns Array of path points
 */
export function calculateSignalPath(
  mode: "HF" | "UV",
  frequency: number,
  angle: number,
  ionoHeight: number,
  earthRadius: number = 50,
  maxHops: number = 3,
  criticalFrequency: number = 7,
): PathPoint[] {
  if (!wasmInitialized) {
    throw new Error("WASM not initialized. Call initPropagationWasm() first.");
  }

  const params = new PropagationParams();
  params.mode = mode === "UV" ? PropagationMode.UV : PropagationMode.HF;
  params.frequency = frequency;
  params.angle = angle;
  params.iono_height = ionoHeight;
  params.earth_radius = earthRadius;
  params.max_hops = maxHops;
  params.critical_frequency = criticalFrequency;

  // Allocate buffers
  const bufferSize = get_propagation_buffer_size(maxHops);
  const pathBuffer = new Float32Array(bufferSize);
  const impactBuffer = new Uint8Array(bufferSize / 3);

  const pointCount = calculate_signal_path(params, pathBuffer, impactBuffer);

  if (pointCount <= 0) {
    return [];
  }

  // Convert to PathPoint array
  const points: PathPoint[] = [];
  for (let i = 0; i < pointCount; i++) {
    points.push({
      x: pathBuffer[i * 3],
      y: pathBuffer[i * 3 + 1],
      z: pathBuffer[i * 3 + 2],
      isImpact: impactBuffer[i] === 1,
    });
  }

  return points;
}

/**
 * Calculate propagation statistics
 * 
 * @param mode - "HF" or "UV"
 * @param frequency - Frequency in MHz
 * @param angle - Elevation angle in degrees
 * @param ionoHeight - Ionosphere height
 * @param earthRadius - Earth radius
 * @param criticalFrequency - Critical frequency f0F2 in MHz
 * @returns Propagation statistics
 */
export function getPropagationStats(
  mode: "HF" | "UV",
  frequency: number,
  angle: number,
  ionoHeight: number,
  earthRadius: number = 50,
  criticalFrequency: number = 7,
): PropagationStats {
  if (!wasmInitialized) {
    throw new Error("WASM not initialized. Call initPropagationWasm() first.");
  }

  const params = new PropagationParams();
  params.mode = mode === "UV" ? PropagationMode.UV : PropagationMode.HF;
  params.frequency = frequency;
  params.angle = angle;
  params.iono_height = ionoHeight;
  params.earth_radius = earthRadius;
  params.critical_frequency = criticalFrequency;

  const stats = calculate_propagation_stats(params);

  return {
    incidenceAngle: stats.incidence_angle,
    muf: stats.muf,
    isPenetrating: stats.is_penetrating,
    groundWaveStrength: stats.ground_wave_strength,
  };
}

/**
 * Generate spherical surface geometry
 * 
 * @param radius - Sphere radius
 * @param maxAngle - Maximum angle (radians)
 * @param spreadAngle - Spread angle (radians)
 * @param segmentsR - Radial segments
 * @param segmentsW - Width segments
 * @returns Geometry data { vertices, uvs, indices }
 */
export function generateSphericalSurface(
  radius: number,
  maxAngle: number,
  spreadAngle: number,
  segmentsR: number = 64,
  segmentsW: number = 64,
): { vertices: Float32Array; uvs: Float32Array; indices: Uint32Array } {
  if (!wasmInitialized) {
    throw new Error("WASM not initialized. Call initPropagationWasm() first.");
  }

  const params = new SphericalSurfaceParams();
  params.radius = radius;
  params.max_angle = maxAngle;
  params.spread_angle = spreadAngle;
  params.segments_r = segmentsR;
  params.segments_w = segmentsW;

  // Get buffer sizes
  const sizes = get_spherical_surface_buffer_sizes(segmentsR, segmentsW);
  const vertexCount = Number(sizes >> BigInt(32));
  const indexCount = Number(sizes & BigInt(0xffffffff));

  // Allocate buffers
  const vertices = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint32Array(indexCount);

  const result = generate_spherical_surface(params, vertices, uvs, indices);

  if (result < 0) {
    throw new Error("Failed to generate spherical surface: buffer too small");
  }

  return { vertices, uvs, indices };
}

/**
 * Batch ray-sphere intersection test
 * 
 * @param rayOrigins - Ray origins [x, y, z, x, y, z, ...]
 * @param rayDirs - Ray directions [x, y, z, x, y, z, ...]
 * @param sphereCenter - Sphere center [x, y, z]
 * @param sphereRadius - Sphere radius
 * @returns Intersection distances [t1, t2, t1, t2, ...], -1 for no intersection
 */
export function intersectSphereBatch(
  rayOrigins: Float32Array,
  rayDirs: Float32Array,
  sphereCenter: [number, number, number],
  sphereRadius: number,
): Float32Array {
  if (!wasmInitialized) {
    throw new Error("WASM not initialized. Call initPropagationWasm() first.");
  }

  const rayCount = rayOrigins.length / 3;
  const results = new Float32Array(rayCount * 2);

  const centerArray = new Float32Array(sphereCenter);

  intersect_sphere_batch(
    rayOrigins,
    rayDirs,
    centerArray,
    sphereRadius,
    results,
  );

  return results;
}

/**
 * Calculate ground wave strength
 * 
 * @param frequency - Frequency in MHz
 * @returns Ground wave strength (0-15)
 */
export function getGroundWaveStrength(frequency: number): number {
  if (!wasmInitialized) {
    throw new Error("WASM not initialized. Call initPropagationWasm() first.");
  }
  return calculate_ground_wave_strength(frequency);
}

/**
 * Calculate ground wave angle
 * 
 * @param strength - Ground wave strength
 * @returns Angle in radians
 */
export function getGroundWaveAngle(strength: number): number {
  if (!wasmInitialized) {
    throw new Error("WASM not initialized. Call initPropagationWasm() first.");
  }
  return calculate_ground_wave_angle(strength);
}

// Re-export WASM initialization
export { initWasm };
