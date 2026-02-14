/**
 * Propagation Worker Client
 *
 * Provides a high-level API for interacting with the propagation Web Worker.
 * Handles message passing, request/response correlation, and error handling.
 */

// Import the worker using Vite's ?worker syntax
import PropagationWorker from "../workers/propagation.worker?worker";
import type { PathPoint, PropagationStats } from "./propagation-wasm";

// Generate unique request IDs
let requestIdCounter = 0;
function generateRequestId(): string {
  return `req_${++requestIdCounter}_${Date.now()}`;
}

/**
 * Worker client configuration
 */
interface WorkerClientConfig {
  /** Timeout for worker responses in milliseconds */
  timeout?: number;
  /** Maximum number of concurrent requests */
  maxConcurrent?: number;
}

/**
 * Pending request
 */
interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

/**
 * Propagation Worker Client
 *
 * Manages a Web Worker for offloading WASM calculations.
 */
export class PropagationWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, PendingRequest<unknown>> = new Map();
  private config: Required<WorkerClientConfig>;
  private isReady = false;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;

  constructor(config: WorkerClientConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 5000,
      maxConcurrent: config.maxConcurrent ?? 10,
    };
  }

  /**
   * Initialize the worker
   */
  async init(): Promise<void> {
    if (this.isReady) {
      return;
    }

    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    // Create worker using Vite's worker import
    this.worker = new PropagationWorker();

    this.worker.onmessage = (e: MessageEvent) => {
      this.handleMessage(e.data);
    };

    this.worker.onerror = (error) => {
      console.error("Propagation worker error:", error);
      // Reject all pending requests
      for (const [id, request] of this.pendingRequests) {
        request.reject(new Error(`Worker error: ${error.message}`));
        clearTimeout(request.timeoutId);
      }
      this.pendingRequests.clear();
    };

    return this.readyPromise;
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      // Reject all pending requests
      for (const [id, request] of this.pendingRequests) {
        request.reject(new Error("Worker terminated"));
        clearTimeout(request.timeoutId);
      }
      this.pendingRequests.clear();

      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      this.readyPromise = null;
      this.readyResolve = null;
    }
  }

  /**
   * Handle messages from the worker
   */
  private handleMessage(data: unknown): void {
    const message = data as {
      type: string;
      id?: string;
      result?: unknown;
      error?: string;
    };

    if (message.type === "ready") {
      this.isReady = true;
      this.readyResolve?.();
      return;
    }

    if (message.type === "result" && message.id) {
      const request = this.pendingRequests.get(message.id);
      if (request) {
        clearTimeout(request.timeoutId);
        this.pendingRequests.delete(message.id);
        request.resolve(message.result);
      }
      return;
    }

    if (message.type === "error" && message.id) {
      const request = this.pendingRequests.get(message.id);
      if (request) {
        clearTimeout(request.timeoutId);
        this.pendingRequests.delete(message.id);
        request.reject(new Error(message.error || "Unknown worker error"));
      }
      return;
    }
  }

  /**
   * Send a request to the worker
   */
  private sendRequest<T>(message: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error("Worker not initialized"));
        return;
      }

      const id = generateRequestId();
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutId,
      });

      this.worker.postMessage({ ...message, id });
    });
  }

  /**
   * Calculate signal propagation path
   */
  async calculateSignalPath(
    mode: "HF" | "UV",
    frequency: number,
    angle: number,
    ionoHeight: number,
    earthRadius: number = 50,
    maxHops: number = 3,
    criticalFrequency: number = 7,
  ): Promise<PathPoint[]> {
    await this.init();
    return this.sendRequest<PathPoint[]>({
      type: "calculateSignalPath",
      mode,
      frequency,
      angle,
      ionoHeight,
      earthRadius,
      maxHops,
      criticalFrequency,
    });
  }

  /**
   * Calculate propagation statistics
   */
  async getPropagationStats(
    mode: "HF" | "UV",
    frequency: number,
    angle: number,
    ionoHeight: number,
    earthRadius: number = 50,
    criticalFrequency: number = 7,
  ): Promise<PropagationStats> {
    await this.init();
    return this.sendRequest<PropagationStats>({
      type: "calculateStats",
      mode,
      frequency,
      angle,
      ionoHeight,
      earthRadius,
      criticalFrequency,
    });
  }

  /**
   * Generate spherical surface geometry
   */
  async generateSphericalSurface(
    radius: number,
    maxAngle: number,
    spreadAngle: number,
    segmentsR: number = 64,
    segmentsW: number = 64,
  ): Promise<{
    vertices: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
  }> {
    await this.init();
    return this.sendRequest<{
      vertices: Float32Array;
      uvs: Float32Array;
      indices: Uint32Array;
    }>({
      type: "generateGeometry",
      radius,
      maxAngle,
      spreadAngle,
      segmentsR,
      segmentsW,
    });
  }

  /**
   * Batch calculate multiple signal paths
   */
  async batchCalculatePaths(
    paths: Array<{
      mode: "HF" | "UV";
      frequency: number;
      angle: number;
      ionoHeight: number;
    }>,
    earthRadius: number = 50,
    maxHops: number = 3,
    criticalFrequency: number = 7,
  ): Promise<Array<{ path: PathPoint[]; stats: PropagationStats }>> {
    await this.init();
    return this.sendRequest<
      Array<{ path: PathPoint[]; stats: PropagationStats }>
    >({
      type: "batchCalculate",
      paths,
      earthRadius,
      maxHops,
      criticalFrequency,
    });
  }

  /**
   * Batch ray-sphere intersection test
   */
  async intersectSphereBatch(
    rayOrigins: Float32Array,
    rayDirs: Float32Array,
    sphereCenter: [number, number, number],
    sphereRadius: number,
  ): Promise<Float32Array> {
    await this.init();
    return this.sendRequest<Float32Array>({
      type: "intersectSphereBatch",
      rayOrigins,
      rayDirs,
      sphereCenter,
      sphereRadius,
    });
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isReady: boolean;
    pendingRequests: number;
  } {
    return {
      isReady: this.isReady,
      pendingRequests: this.pendingRequests.size,
    };
  }
}

// Singleton instance
let globalWorkerClient: PropagationWorkerClient | null = null;

/**
 * Get the global worker client instance
 */
export function getPropagationWorker(): PropagationWorkerClient {
  if (!globalWorkerClient) {
    globalWorkerClient = new PropagationWorkerClient();
  }
  return globalWorkerClient;
}

/**
 * Initialize the global worker client
 */
export async function initPropagationWorker(): Promise<void> {
  const worker = getPropagationWorker();
  await worker.init();
}

/**
 * Terminate the global worker client
 */
export function terminatePropagationWorker(): void {
  if (globalWorkerClient) {
    globalWorkerClient.terminate();
    globalWorkerClient = null;
  }
}

// Re-export types
export type { PathPoint, PropagationStats };
