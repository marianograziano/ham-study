/**
 * Propagation Web Worker
 *
 * Offloads WASM propagation calculations to a Web Worker
to avoid blocking the main thread.
 */

import initWasm, {
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

// WASM initialization state
let wasmInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the WASM module in the worker
 */
async function initWasmInWorker(): Promise<void> {
  if (wasmInitialized) {
    return;
  }

  if (!initPromise) {
    initPromise = initWasm().then(() => {
      wasmInitialized = true;
    });
  }

  await initPromise;
}

// Message types
interface CalculateSignalPathMessage {
  type: "calculateSignalPath";
  id: string;
  mode: "HF" | "UV";
  frequency: number;
  angle: number;
  ionoHeight: number;
  earthRadius: number;
  maxHops: number;
  criticalFrequency: number;
}

interface CalculateStatsMessage {
  type: "calculateStats";
  id: string;
  mode: "HF" | "UV";
  frequency: number;
  angle: number;
  ionoHeight: number;
  earthRadius: number;
  criticalFrequency: number;
}

interface GenerateGeometryMessage {
  type: "generateGeometry";
  id: string;
  radius: number;
  maxAngle: number;
  spreadAngle: number;
  segmentsR: number;
  segmentsW: number;
}

interface BatchCalculateMessage {
  type: "batchCalculate";
  id: string;
  paths: Array<{
    mode: "HF" | "UV";
    frequency: number;
    angle: number;
    ionoHeight: number;
  }>;
  earthRadius: number;
  maxHops: number;
  criticalFrequency: number;
}

interface IntersectSphereBatchMessage {
  type: "intersectSphereBatch";
  id: string;
  rayOrigins: Float32Array;
  rayDirs: Float32Array;
  sphereCenter: [number, number, number];
  sphereRadius: number;
}

type WorkerMessage =
  | CalculateSignalPathMessage
  | CalculateStatsMessage
  | GenerateGeometryMessage
  | BatchCalculateMessage
  | IntersectSphereBatchMessage;

// Result types
interface PathPoint {
  x: number;
  y: number;
  z: number;
  isImpact: boolean;
}

interface PropagationStats {
  incidenceAngle: number;
  muf: number;
  isPenetrating: boolean;
  groundWaveStrength: number;
}

interface GeometryResult {
  vertices: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

// Handle messages
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const message = e.data;

  try {
    // Ensure WASM is initialized
    await initWasmInWorker();

    switch (message.type) {
      case "calculateSignalPath": {
        const result = handleCalculateSignalPath(message);
        self.postMessage({
          type: "result",
          id: message.id,
          result,
        });
        break;
      }

      case "calculateStats": {
        const result = handleCalculateStats(message);
        self.postMessage({
          type: "result",
          id: message.id,
          result,
        });
        break;
      }

      case "generateGeometry": {
        const result = handleGenerateGeometry(message);
        self.postMessage(
          {
            type: "result",
            id: message.id,
            result,
          },
          // Transfer buffers to avoid copying
          {
            transfer: [
              result.vertices.buffer,
              result.uvs.buffer,
              result.indices.buffer,
            ],
          },
        );
        break;
      }

      case "batchCalculate": {
        const result = handleBatchCalculate(message);
        self.postMessage({
          type: "result",
          id: message.id,
          result,
        });
        break;
      }

      case "intersectSphereBatch": {
        const result = handleIntersectSphereBatch(message);
        self.postMessage(
          {
            type: "result",
            id: message.id,
            result,
          },
          { transfer: [result.buffer] },
        );
        break;
      }

      default:
        self.postMessage({
          type: "error",
          id: (message as { id: string }).id,
          error: "Unknown message type",
        });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      id: (message as { id: string }).id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Calculate signal propagation path
 */
function handleCalculateSignalPath(
  message: CalculateSignalPathMessage,
): PathPoint[] {
  const {
    mode,
    frequency,
    angle,
    ionoHeight,
    earthRadius,
    maxHops,
    criticalFrequency,
  } = message;

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
 */
function handleCalculateStats(
  message: CalculateStatsMessage,
): PropagationStats {
  const { mode, frequency, angle, ionoHeight, earthRadius, criticalFrequency } =
    message;

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
 */
function handleGenerateGeometry(
  message: GenerateGeometryMessage,
): GeometryResult {
  const { radius, maxAngle, spreadAngle, segmentsR, segmentsW } = message;

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
 * Batch calculate multiple signal paths
 */
function handleBatchCalculate(
  message: BatchCalculateMessage,
): Array<{ path: PathPoint[]; stats: PropagationStats }> {
  const { paths, earthRadius, maxHops, criticalFrequency } = message;

  const results: Array<{ path: PathPoint[]; stats: PropagationStats }> = [];

  for (const pathConfig of paths) {
    // Calculate path
    const params = new PropagationParams();
    params.mode =
      pathConfig.mode === "UV" ? PropagationMode.UV : PropagationMode.HF;
    params.frequency = pathConfig.frequency;
    params.angle = pathConfig.angle;
    params.iono_height = pathConfig.ionoHeight;
    params.earth_radius = earthRadius;
    params.max_hops = maxHops;
    params.critical_frequency = criticalFrequency;

    // Allocate buffers
    const bufferSize = get_propagation_buffer_size(maxHops);
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
 */
function handleIntersectSphereBatch(
  message: IntersectSphereBatchMessage,
): Float32Array {
  const { rayOrigins, rayDirs, sphereCenter, sphereRadius } = message;

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

// Signal that worker is ready
self.postMessage({ type: "ready" });
