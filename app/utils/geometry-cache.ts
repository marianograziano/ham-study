/**
 * Geometry Cache System for WASM-generated geometries
 *
 * Provides caching for spherical surface geometries to avoid
 * regenerating identical geometries multiple times.
 */

import * as THREE from "three";

/**
 * Cache key for spherical surface parameters
 */
interface CacheKey {
  radius: number;
  maxAngle: number;
  spreadAngle: number;
  segmentsR: number;
  segmentsW: number;
}

/**
 * Cached geometry entry
 */
interface CachedGeometry {
  geometry: THREE.BufferGeometry;
  lastUsed: number;
  useCount: number;
}

/**
 * Geometry Cache Manager
 *
 * Implements LRU (Least Recently Used) eviction policy
 */
class GeometryCache {
  private cache: Map<string, CachedGeometry> = new Map();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 10, ttl: number = 60000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Generate a cache key from parameters
   */
  private generateKey(params: CacheKey): string {
    return `${params.radius.toFixed(2)}_${params.maxAngle.toFixed(4)}_${params.spreadAngle.toFixed(
      4,
    )}_${params.segmentsR}_${params.segmentsW}`;
  }

  /**
   * Get a cached geometry or return undefined if not found
   */
  get(params: CacheKey): THREE.BufferGeometry | undefined {
    const key = this.generateKey(params);
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check TTL
    const now = Date.now();
    if (now - entry.lastUsed > this.ttl) {
      this.cache.delete(key);
      entry.geometry.dispose();
      return undefined;
    }

    // Update usage stats
    entry.lastUsed = now;
    entry.useCount++;

    // Clone the geometry to avoid modifying the cached instance
    return entry.geometry.clone();
  }

  /**
   * Store a geometry in the cache
   */
  set(params: CacheKey, geometry: THREE.BufferGeometry): void {
    const key = this.generateKey(params);
    const now = Date.now();

    // Evict old entries if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    // If key exists, dispose old geometry
    const existing = this.cache.get(key);
    if (existing) {
      existing.geometry.dispose();
    }

    // Clone geometry before storing to prevent external modifications
    const clonedGeometry = geometry.clone();

    this.cache.set(key, {
      geometry: clonedGeometry,
      lastUsed: now,
      useCount: 1,
    });
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        entry.geometry.dispose();
      }
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear all cached geometries
   */
  clear(): void {
    for (const entry of this.cache.values()) {
      entry.geometry.dispose();
    }
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    entries: Array<{ key: string; useCount: number; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      useCount: entry.useCount,
      age: now - entry.lastUsed,
    }));

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastUsed > this.ttl) {
        entry.geometry.dispose();
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
const globalGeometryCache = new GeometryCache(20, 120000);

/**
 * Get the global geometry cache instance
 */
export function getGeometryCache(): GeometryCache {
  return globalGeometryCache;
}

/**
 * Create a spherical surface geometry with caching
 *
 * This function wraps the WASM geometry generation with a caching layer.
 * Identical parameters will return a cached geometry clone.
 */
export function createCachedSphericalSurface(
  vertices: Float32Array,
  uvs: Float32Array,
  indices: Uint32Array,
  params: {
    radius: number;
    maxAngle: number;
    spreadAngle: number;
    segmentsR: number;
    segmentsW: number;
  },
): THREE.BufferGeometry {
  const cache = getGeometryCache();

  // Try to get from cache first
  const cached = cache.get(params);
  if (cached) {
    return cached;
  }

  // Create new geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(Array.from(indices));
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

  // Store in cache
  cache.set(params, geometry);

  return geometry;
}

/**
 * Preload common geometries into cache
 *
 * Call this during app initialization to warm up the cache
 */
export function preloadCommonGeometries(
  generateFn: (
    radius: number,
    maxAngle: number,
    spreadAngle: number,
    segmentsR: number,
    segmentsW: number,
  ) => { vertices: Float32Array; uvs: Float32Array; indices: Uint32Array },
): void {
  const commonConfigs = [
    // Earth ground wave geometries
    {
      radius: 50.3,
      maxAngle: 0.01,
      spreadAngle: Math.PI / 3,
      segmentsR: 64,
      segmentsW: 64,
    },
    {
      radius: 50.3,
      maxAngle: 0.03,
      spreadAngle: Math.PI / 3,
      segmentsR: 64,
      segmentsW: 64,
    },
    {
      radius: 50.3,
      maxAngle: 0.05,
      spreadAngle: Math.PI / 3,
      segmentsR: 64,
      segmentsW: 64,
    },
    // Secondary ground wave
    {
      radius: 50.3,
      maxAngle: 0.08,
      spreadAngle: Math.PI * 2,
      segmentsR: 64,
      segmentsW: 64,
    },
  ];

  for (const config of commonConfigs) {
    const { vertices, uvs, indices } = generateFn(
      config.radius,
      config.maxAngle,
      config.spreadAngle,
      config.segmentsR,
      config.segmentsW,
    );
    createCachedSphericalSurface(vertices, uvs, indices, config);
  }
}

export { GeometryCache };
export default globalGeometryCache;
