use wasm_bindgen::prelude::*;

// Re-export all modules
mod antenna_pattern;
mod electric_field;
mod geometry;
mod moxon_calc;
mod propagation;
mod radiation;
mod yagi_calc;

pub use antenna_pattern::*;
pub use electric_field::*;
pub use geometry::*;
pub use moxon_calc::*;
pub use propagation::*;
pub use radiation::*;
pub use yagi_calc::*;

/// Wave type for antenna field calculation
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum WaveType {
    Traveling,
    Standing,
}

impl From<&str> for WaveType {
    fn from(s: &str) -> Self {
        match s {
            "traveling" => WaveType::Traveling,
            "standing" => WaveType::Standing,
            _ => WaveType::Standing,
        }
    }
}

/// Calculate electric field intensity for a single angle
///
/// Uses numerical integration method, logic consistent with Balanis Antenna Theory.
///
/// # Arguments
/// * `theta` - Angle off the axis (radians)
/// * `length` - Antenna length (in wavelengths lambda)
/// * `wave_type` - "traveling" or "standing"
///
/// # Returns
/// Normalized electric field magnitude
#[wasm_bindgen]
pub fn calculate_field(theta: f64, length: f64, wave_type: &str) -> f64 {
    calculate_field_internal_single(theta, length, WaveType::from(wave_type))
}

/// Internal single field calculation
fn calculate_field_internal_single(theta: f64, length: f64, wave_type: WaveType) -> f64 {
    const PI: f64 = std::f64::consts::PI;
    const K: f64 = 2.0 * PI; // normalized wavenumber k = 2pi (lambda = 1)
    const N: usize = 200; // Integration steps

    let dz = length / N as f64;
    let cos_theta = theta.cos();

    let mut sum_re = 0.0;
    let mut sum_im = 0.0;

    for i in 0..=N {
        let z = i as f64 * dz;

        // 1. Calculate current I(z) = Ir + j*Ii
        let (ir, ii) = match wave_type {
            WaveType::Traveling => {
                // I(z) = exp(-j * k * z)
                let kz = K * z;
                (kz.cos(), -kz.sin())
            }
            WaveType::Standing => {
                // I(z) = sin(k * (L - z)) (Purely real for standing wave assumption)
                ((K * (length - z)).sin(), 0.0)
            }
        };

        // 2. Calculate phase Kernel = exp(j * k * z * cos(theta))
        let phase_arg = K * z * cos_theta;
        let kr = phase_arg.cos();
        let ki = phase_arg.sin();

        // 3. Integration integrand = I(z) * Kernel (complex multiplication)
        sum_re += ir * kr - ii * ki;
        sum_im += ir * ki + ii * kr;
    }

    // Multiply by dz (step size)
    sum_re *= dz;
    sum_im *= dz;

    // Magnitude of the integral |Integral|
    let integral_mag = (sum_re * sum_re + sum_im * sum_im).sqrt();

    // 4. Calculate final Electric Field |E|
    // Factor: sin(theta) (element factor for dipole/wire) * Array Factor (Integral)
    (theta.sin() * integral_mag).abs()
}

/// Calculate electric field intensity for multiple angles in batch
///
/// This is more efficient than calling calculate_field multiple times
/// as it reduces JS<->WASM call overhead.
///
/// # Arguments
/// * `angles` - Array of angles in radians
/// * `length` - Antenna length (in wavelengths lambda)
/// * `wave_type` - "traveling" or "standing"
/// * `output` - Output buffer for field magnitudes (must be same length as angles)
#[wasm_bindgen]
pub fn calculate_field_batch(angles: &[f64], length: f64, wave_type: &str, output: &mut [f64]) {
    if angles.len() != output.len() {
        return;
    }

    let wave_type_enum = WaveType::from(wave_type);

    for (i, &theta) in angles.iter().enumerate() {
        output[i] = calculate_field_internal_single(theta, length, wave_type_enum);
    }
}

/// Calculate antenna radiation pattern (360 degrees)
///
/// Returns normalized field magnitudes for angles 0 to 2π.
///
/// # Arguments
/// * `length` - Antenna length (in wavelengths lambda)
/// * `wave_type` - "traveling" or "standing"
/// * `num_points` - Number of points to calculate (default 360)
/// * `output` - Output buffer for field magnitudes (must have length >= num_points)
#[wasm_bindgen]
pub fn calculate_radiation_pattern(
    length: f64,
    wave_type: &str,
    num_points: usize,
    output: &mut [f64],
) {
    if output.len() < num_points {
        return;
    }

    let wave_type_enum = WaveType::from(wave_type);
    let two_pi = 2.0 * std::f64::consts::PI;

    for i in 0..num_points {
        let theta = two_pi * (i as f64) / (num_points as f64);
        output[i] = calculate_field_internal_single(theta, length, wave_type_enum);
    }
}
