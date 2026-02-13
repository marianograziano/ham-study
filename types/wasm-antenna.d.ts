/**
 * WASM Module Type Declarations for Antenna Physics and Propagation Calculations
 *
 * This file provides type declarations for WASM imports used throughout the application,
 * including support for relative paths in Worker files.
 */

// ============================================================================
// Worker Import Declarations for Vite
// ============================================================================

declare module "*?worker" {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

// ============================================================================
// Core WASM Module Declarations
// ============================================================================

/**
 * Main WASM module declaration for absolute imports
 * Used by files that can resolve "wasm/antenna/pkg/antenna?init"
 */
declare module "wasm/antenna/pkg/antenna?init" {
  export enum PropagationMode {
    HF = 0,
    UV = 1,
  }

  export class SphericalSurfaceParams {
    radius: number;
    max_angle: number;
    spread_angle: number;
    segments_r: number;
    segments_w: number;
    constructor();
    free(): void;
    [Symbol.dispose](): void;
  }

  export class PropagationParams {
    mode: PropagationMode;
    frequency: number;
    angle: number;
    iono_height: number;
    earth_radius: number;
    max_hops: number;
    critical_frequency: number;
    constructor();
    free(): void;
    [Symbol.dispose](): void;
  }

  export class PropagationStats {
    incidence_angle: number;
    muf: number;
    is_penetrating: boolean;
    ground_wave_strength: number;
    free(): void;
    [Symbol.dispose](): void;
  }

  export function calculate_field(
    theta: number,
    length: number,
    wave_type: string,
  ): number;
  export function calculate_field_batch(
    angles: Float64Array,
    length: number,
    wave_type: string,
    output: Float64Array,
  ): void;
  export function calculate_radiation_pattern(
    length: number,
    wave_type: string,
    num_points: number,
    output: Float64Array,
  ): void;
  export function calculate_electric_field(
    antenna_type: string,
    polarization_type: string,
    speed: number,
    amplitude_scale: number,
    is_rhcp: boolean,
    antenna_length: number,
    radial_angle: string,
    active_harmonic: number,
    is_inverted_v: boolean,
    time: number,
    grid_size: number,
    spacing: number,
    matrix_buffer: Float32Array,
    color_buffer: Float32Array,
  ): void;
  export function generate_spherical_surface(
    params: SphericalSurfaceParams,
    vertices: Float32Array,
    uvs: Float32Array,
    indices: Uint32Array,
  ): number;
  export function get_spherical_surface_buffer_sizes(
    segments_r: number,
    segments_w: number,
  ): bigint;
  export function intersect_sphere_batch(
    ray_origins: Float32Array,
    ray_dirs: Float32Array,
    sphere_center: Float32Array,
    sphere_radius: number,
    results: Float32Array,
  ): void;
  export function calculate_signal_path(
    params: PropagationParams,
    path_buffer: Float32Array,
    impact_buffer: Uint8Array,
  ): number;
  export function calculate_propagation_stats(
    params: PropagationParams,
  ): PropagationStats;
  export function calculate_ground_wave_strength(frequency: number): number;
  export function calculate_ground_wave_angle(strength: number): number;
  export function get_propagation_buffer_size(max_hops: number): number;

  function initWasm(): Promise<void>;
  export default initWasm;
}

/**
 * For Worker files that use relative paths (from app/workers/)
 * Re-exports all declarations from the main module
 */
declare module "../../wasm/antenna/pkg/antenna?init" {
  export * from "wasm/antenna/pkg/antenna?init";
  export { default } from "wasm/antenna/pkg/antenna?init";
}

/**
 * For files in app/utils/ that use relative paths
 * Re-exports all declarations from the main module
 */
declare module "../wasm/antenna/pkg/antenna?init" {
  export * from "wasm/antenna/pkg/antenna?init";
  export { default } from "wasm/antenna/pkg/antenna?init";
}
