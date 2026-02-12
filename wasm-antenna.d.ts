declare module "wasm/antenna/pkg/antenna?init" {
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
