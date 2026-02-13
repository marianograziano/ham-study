/**
 * Ionospheric Propagation Calculations using WebAssembly
 *
 * This module provides high-performance propagation calculations
 * using Rust-compiled WebAssembly for CPU-intensive ray tracing.
 *
 * Phase 2: Added caching and Worker support for better performance
 */

import * as THREE from "three";
import initWasm, {
  calculate_ground_wave_angle,
  calculate_ground_wave_strength,
  calculate_propagation_stats,
  calculate_signal_path,
  generate_spherical_surface,
  get_propagation_buffer_size,
  get_spherical_surface_buffer_sizes,
  intersect_sphere_batch,
  PropagationMode,
  PropagationParams,
  SphericalSurfaceParams,
} from "wasm/antenna/pkg/antenna?init";
import { getGeometryCache } from "./geometry-cache";
import {
  getPropagationWorker,
  initPropagationWorker,
  PropagationWorkerClient,
} from "./propagation-worker-client";

// WASM initialization state
let wasmInitialized = false;

/**
 * Configuration for propagation calculations
 */
export interface PropagationConfig {
  /** Use Web Worker for calculations (default: true) */
  useWorker?: boolean;
  /** Enable geometry caching (default: true) */
  useCache?: boolean;
  /** Earth radius (default: 50) */
  earthRadius?: number;
  /** Maximum number of hops (default: 3) */
  maxHops?: number;
  /** Critical frequency f0F2 in MHz (default: 7) */
  criticalFrequency?: number;
}

// Default configuration
const defaultConfig: Required<PropagationConfig> = {
  useWorker: true,
  useCache: true,
  earthRadius: 50,
  maxHops: 3,
  criticalFrequency: 7,
};

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
  incidenceAngle: number; // degrees
  muf: number; // MHz
  isPenetrating: boolean;
  groundWaveStrength: number;
}

/**
 * Get current configuration
 */
function getConfig(config?: PropagationConfig): Required<PropagationConfig> {
  return { ...defaultConfig, ...config };
}

/**
 * Calculate signal propagation path
 *
 * @param mode - "HF" or "UV"
 * @param frequency - Frequency in MHz
 * @param angle - Elevation angle in degrees
 * @param ionoHeight - Ionosphere height (same units as earthRadius)
 * @param config - Optional configuration
 * @returns Array of path points
 */
export async function calculateSignalPath(
  mode: "HF" | "UV",
  frequency: number,
  angle: number,
  ionoHeight: number,
  config?: PropagationConfig,
): Promise<PathPoint[]> {
  const cfg = getConfig(config);

  // Use Worker if available and enabled
  if (cfg.useWorker) {
    try {
      const worker = getPropagationWorker();
      return await worker.calculateSignalPath(
        mode,
        frequency,
        angle,
        ionoHeight,
        cfg.earthRadius,
        cfg.maxHops,
        cfg.criticalFrequency,
      );
    } catch (error) {
      console.warn(
        "Worker calculation failed, falling back to main thread:",
        error,
      );
      // Fall through to main thread calculation
    }
  }

  // Main thread calculation
  if (!wasmInitialized) {
    await initPropagationWasm();
  }

  const params = new PropagationParams();
  params.mode = mode === "UV" ? PropagationMode.UV : PropagationMode.HF;
  params.frequency = frequency;
  params.angle = angle;
  params.iono_height = ionoHeight;
  params.earth_radius = cfg.earthRadius;
  params.max_hops = cfg.maxHops;
  params.critical_frequency = cfg.criticalFrequency;

  // Allocate buffers
  const bufferSize = get_propagation_buffer_size(cfg.maxHops);
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
 * @param config - Optional configuration
 * @returns Propagation statistics
 */
export async function getPropagationStats(
  mode: "HF" | "UV",
  frequency: number,
  angle: number,
  ionoHeight: number,
  config?: PropagationConfig,
): Promise<PropagationStats> {
  const cfg = getConfig(config);

  // Use Worker if available and enabled
  if (cfg.useWorker) {
    try {
      const worker = getPropagationWorker();
      return await worker.getPropagationStats(
        mode,
        frequency,
        angle,
        ionoHeight,
        cfg.earthRadius,
        cfg.criticalFrequency,
      );
    } catch (error) {
      console.warn(
        "Worker calculation failed, falling back to main thread:",
        error,
      );
      // Fall through to main thread calculation
    }
  }

  // Main thread calculation
  if (!wasmInitialized) {
    await initPropagationWasm();
  }

  const params = new PropagationParams();
  params.mode = mode === "UV" ? PropagationMode.UV : PropagationMode.HF;
  params.frequency = frequency;
  params.angle = angle;
  params.iono_height = ionoHeight;
  params.earth_radius = cfg.earthRadius;
  params.critical_frequency = cfg.criticalFrequency;

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
 * @param config - Optional configuration
 * @returns Geometry data { vertices, uvs, indices }
 */
export async function generateSphericalSurface(
  radius: number,
  maxAngle: number,
  spreadAngle: number,
  segmentsR: number = 64,
  segmentsW: number = 64,
  config?: PropagationConfig,
): Promise<{
  vertices: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}> {
  const cfg = getConfig(config);

  // Use Worker if available and enabled
  if (cfg.useWorker) {
    try {
      const worker = getPropagationWorker();
      return await worker.generateSphericalSurface(
        radius,
        maxAngle,
        spreadAngle,
        segmentsR,
        segmentsW,
      );
    } catch (error) {
      console.warn(
        "Worker calculation failed, falling back to main thread:",
        error,
      );
      // Fall through to main thread calculation
    }
  }

  // Main thread calculation
  if (!wasmInitialized) {
    await initPropagationWasm();
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
 * Create Three.js geometry with caching support
 *
 * @param radius - Sphere radius
 * @param maxAngle - Maximum angle (radians)
 * @param spreadAngle - Spread angle (radians)
 * @param segmentsR - Radial segments
 * @param segmentsW - Width segments
 * @param config - Optional configuration
 * @returns Three.js BufferGeometry
 */
export async function createSphericalSurfaceGeometry(
  radius: number,
  maxAngle: number,
  spreadAngle: number,
  segmentsR: number = 64,
  segmentsW: number = 64,
  config?: PropagationConfig,
): Promise<THREE.BufferGeometry> {
  const cfg = getConfig(config);

  // Try cache first if enabled
  if (cfg.useCache) {
    const cache = getGeometryCache();
    const cached = cache.get({
      radius,
      maxAngle,
      spreadAngle,
      segmentsR,
      segmentsW,
    });
    if (cached) {
      return cached;
    }
  }

  // Generate new geometry
  const { vertices, uvs, indices } = await generateSphericalSurface(
    radius,
    maxAngle,
    spreadAngle,
    segmentsR,
    segmentsW,
    config,
  );

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(Array.from(indices));
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

  // Cache if enabled
  if (cfg.useCache) {
    const cache = getGeometryCache();
    cache.set(
      { radius, maxAngle, spreadAngle, segmentsR, segmentsW },
      geometry,
    );
  }

  return geometry;
}

/**
 * Batch calculate multiple signal paths
 *
 * This is more efficient than calling calculateSignalPath multiple times
 * as it reduces overhead and can parallelize calculations.
 *
 * @param paths - Array of path configurations
 * @param config - Optional configuration
 * @returns Array of path points and stats for each configuration
 */
export async function batchCalculateSignalPaths(
  paths: Array<{
    mode: "HF" | "UV";
    frequency: number;
    angle: number;
    ionoHeight: number;
  }>,
  config?: PropagationConfig,
): Promise<Array<{ path: PathPoint[]; stats: PropagationStats }>> {
  const cfg = getConfig(config);

  // Use Worker for batch calculation
  if (cfg.useWorker) {
    try {
      const worker = getPropagationWorker();
      return await worker.batchCalculatePaths(
        paths,
        cfg.earthRadius,
        cfg.maxHops,
        cfg.criticalFrequency,
      );
    } catch (error) {
      console.warn(
        "Worker batch calculation failed, falling back to main thread:",
        error,
      );
      // Fall through to main thread calculation
    }
  }

  // Main thread batch calculation
  if (!wasmInitialized) {
    await initPropagationWasm();
  }

  const results: Array<{ path: PathPoint[]; stats: PropagationStats }> = [];

  for (const pathConfig of paths) {
    const params = new PropagationParams();
    params.mode =
      pathConfig.mode === "UV" ? PropagationMode.UV : PropagationMode.HF;
    params.frequency = pathConfig.frequency;
    params.angle = pathConfig.angle;
    params.iono_height = pathConfig.ionoHeight;
    params.earth_radius = cfg.earthRadius;
    params.max_hops = cfg.maxHops;
    params.critical_frequency = cfg.criticalFrequency;

    // Calculate path
    const bufferSize = get_propagation_buffer_size(cfg.maxHops);
    const pathBuffer = new Float32Array(bufferSize);
    const impactBuffer = new Uint8Array(bufferSize / 3);

    const pointCount = calculate_signal_path(params, pathBuffer, impactBuffer);

    const pathPoints: PathPoint[] = [];
    if (pointCount > 0) {
      for (let i = 0; i < pointCount; i++) {
        pathPoints.push({
          x: pathBuffer[i * 3],
          y: pathBuffer[i * 3 + 1],
          z: pathBuffer[i * 3 + 2],
          isImpact: impactBuffer[i] === 1,
        });
      }
    }

    // Calculate stats
    const stats = calculate_propagation_stats(params);

    results.push({
      path: pathPoints,
      stats: {
        incidenceAngle: stats.incidence_angle,
        muf: stats.muf,
        isPenetrating: stats.is_penetrating,
        groundWaveStrength: stats.ground_wave_strength,
      },
    });
  }

  return results;
}

/**
 * Batch ray-sphere intersection test
 *
 * @param rayOrigins - Ray origins [x, y, z, x, y, z, ...]
 * @param rayDirs - Ray directions [x, y, z, x, y, z, ...]
 * @param sphereCenter - Sphere center [x, y, z]
 * @param sphereRadius - Sphere radius
 * @param config - Optional configuration
 * @returns Intersection distances [t1, t2, t1, t2, ...], -1 for no intersection
 */
export async function intersectSphereBatch(
  rayOrigins: Float32Array,
  rayDirs: Float32Array,
  sphereCenter: [number, number, number],
  sphereRadius: number,
  config?: PropagationConfig,
): Promise<Float32Array> {
  const cfg = getConfig(config);

  // Use Worker if available and enabled
  if (cfg.useWorker) {
    try {
      const worker = getPropagationWorker();
      return await worker.intersectSphereBatch(
        rayOrigins,
        rayDirs,
        sphereCenter,
        sphereRadius,
      );
    } catch (error) {
      console.warn(
        "Worker calculation failed, falling back to main thread:",
        error,
      );
      // Fall through to main thread calculation
    }
  }

  // Main thread calculation
  if (!wasmInitialized) {
    await initPropagationWasm();
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
    // Fallback to JS implementation
    return Math.max(0, 15 - frequency * 0.4);
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
    // Fallback to JS implementation
    return strength * 0.06;
  }
  return calculate_ground_wave_angle(strength);
}

// Re-export Worker client
export { PropagationWorkerClient, getPropagationWorker, initPropagationWorker };

// Re-export cache utilities
export {
  createCachedSphericalSurface,
  getGeometryCache,
  preloadCommonGeometries,
} from "./geometry-cache";

// Re-export WASM initialization
export { initWasm };
