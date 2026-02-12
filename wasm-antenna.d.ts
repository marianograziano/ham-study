declare module "wasm/antenna/pkg/antenna?init" {
  /**
   * Calculate electric field intensity for a single angle
   * Uses numerical integration method, logic consistent with Balanis Antenna Theory.
   * 
   * @param theta - Angle off the axis (radians)
   * @param length - Antenna length (in wavelengths lambda)
   * @param wave_type - "traveling" or "standing"
   * @returns Normalized electric field magnitude
   */
  export function calculate_field(
    theta: number,
    length: number,
    wave_type: "traveling" | "standing",
  ): number;

  /**
   * Calculate electric field intensity for multiple angles in batch
   * More efficient than calling calculate_field multiple times.
   * 
   * @param angles - Array of angles in radians
   * @param length - Antenna length (in wavelengths lambda)
   * @param wave_type - "traveling" or "standing"
   * @param output - Output buffer for field magnitudes (must be same length as angles)
   */
  export function calculate_field_batch(
    angles: Float64Array,
    length: number,
    wave_type: "traveling" | "standing",
    output: Float64Array,
  ): void;

  /**
   * Calculate antenna radiation pattern (360 degrees)
   * Returns normalized field magnitudes for angles 0 to 2π.
   * 
   * @param length - Antenna length (in wavelengths lambda)
   * @param wave_type - "traveling" or "standing"
   * @param num_points - Number of points to calculate
   * @param output - Output buffer for field magnitudes
   */
  export function calculate_radiation_pattern(
    length: number,
    wave_type: "traveling" | "standing",
    num_points: number,
    output: Float64Array,
  ): void;

  /**
   * Calculate electric field for 3D visualization
   * (Legacy function for 3D field visualization)
   */
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

  export default function initWasm(): Promise<void>;
}
