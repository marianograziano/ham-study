use wasm_bindgen::prelude::*;
use crate::AntennaType;
use crate::calculate_windom_factor;

/// Calculate antenna gain at a specific angle
///
/// # Arguments
/// * `antenna_type` - Type of antenna ("vertical", "gp", "dp", "yagi", etc.)
/// * `theta` - Elevation angle in radians (0 = horizontal plane, π/2 = vertical)
/// * `phi` - Azimuth angle in radians (0 = forward direction)
/// * `antenna_length` - Antenna length in wavelengths (used for some antenna types)
/// * `active_harmonic` - Active harmonic number (used for EndFed, Windom)
/// * `is_inverted_v` - Inverted V flag (used for Windom)
/// * `radial_angle` - Radial angle string ("60", "135") for GP antennas
///
/// # Returns
/// Normalized gain value (0.0 to 1.0+)
#[wasm_bindgen]
pub fn calculate_antenna_gain(
    antenna_type: &str,
    theta: f64,
    phi: f64,
    antenna_length: f64,
    active_harmonic: i32,
    is_inverted_v: bool,
    radial_angle: &str,
) -> f64 {
    let antenna_type_enum = AntennaType::from(antenna_type);

    match antenna_type_enum {
        AntennaType::Vertical | AntennaType::GP => {
            // Vertical and GP antennas have omnidirectional pattern
            // GP with radial angle 60 has some directionality
            if antenna_type_enum == AntennaType::GP && radial_angle == "60" {
                // Some directionality for GP 60
                (theta.sin().abs() + 0.1).min(1.0)
            } else {
                1.0
            }
        }
        AntennaType::DP => {
            // Dipole pattern: sin(θ) for vertical dipole
            // Assuming vertical orientation (theta is elevation from horizontal)
            theta.sin().abs()
        }
        AntennaType::Yagi => {
            // Yagi antenna forward lobe: cos^3(phi) where phi is azimuth off boresight
            // theta is elevation angle (typically minimal variation)
            let front = phi.cos().max(0.0);
            front.powi(3) + 0.1
        }
        AntennaType::Quad => {
            // Quad antenna similar to Yagi
            let front = phi.cos().max(0.0);
            front.powi(2) + 0.1
        }
        AntennaType::Moxon => {
            // Moxon antenna forward lobe: sin^2(phi)
            let front = phi.sin().max(0.0);
            front.powi(2) + 0.1
        }
        AntennaType::HB9CV => {
            // HB9CV pattern based on array factor
            let kd = std::f64::consts::PI / 4.0;
            let delta = 5.0 * std::f64::consts::PI / 4.0;
            let psi = kd * phi.cos() + delta;
            let mag = (2.0 + 2.0 * psi.cos()).sqrt();
            (mag / std::f64::consts::SQRT_2).powi(2)
        }
        AntennaType::MagneticLoop => {
            // Magnetic loop pattern: cos^2(phi)
            phi.cos().abs() + 0.05
        }
        AntennaType::LongWire => {
            // Long wire antenna pattern using existing WASM calculate_field
            // Use standing wave type for long wire
            crate::calculate_field(phi, antenna_length, "standing")
        }
        AntennaType::Windom => {
            // Windom antenna using numerical integration
            let n = if active_harmonic > 0 { active_harmonic } else { 1 };
            calculate_windom_factor(phi, n, is_inverted_v)
        }
        AntennaType::EndFed => {
            // End-fed antenna pattern
            let n = if active_harmonic > 0 { active_harmonic } else { 1 };
            let cos_theta = phi.cos();
            let sin_theta = phi.sin().abs();
            let safe_sin_theta = sin_theta.max(0.001);

            let val = if n % 2 == 1 {
                let num = ((n as f64 * std::f64::consts::PI) / 2.0 * cos_theta).cos();
                (num / safe_sin_theta).abs()
            } else {
                let num = ((n as f64 * std::f64::consts::PI) / 2.0 * cos_theta).sin();
                (num / safe_sin_theta).abs()
            };
            val.powf(1.5) * 0.5 + 0.05
        }
    }
}

/// Calculate antenna gain for multiple angles in batch
///
/// # Arguments
/// * `antenna_type` - Type of antenna
/// * `angles_theta` - Array of elevation angles in radians
/// * `angles_phi` - Array of azimuth angles in radians (same length as angles_theta)
/// * `antenna_length` - Antenna length in wavelengths
/// * `active_harmonic` - Active harmonic number
/// * `is_inverted_v` - Inverted V flag
/// * `radial_angle` - Radial angle string
/// * `output` - Output buffer for gain values (must be same length as angles_theta)
#[wasm_bindgen]
pub fn calculate_antenna_gain_batch(
    antenna_type: &str,
    angles_theta: &[f64],
    angles_phi: &[f64],
    antenna_length: f64,
    active_harmonic: i32,
    is_inverted_v: bool,
    radial_angle: &str,
    output: &mut [f64],
) {
    if angles_theta.len() != angles_phi.len() || angles_theta.len() != output.len() {
        return;
    }

    for i in 0..angles_theta.len() {
        output[i] = calculate_antenna_gain(
            antenna_type,
            angles_theta[i],
            angles_phi[i],
            antenna_length,
            active_harmonic,
            is_inverted_v,
            radial_angle,
        );
    }
}

/// Calculate antenna radiation pattern (360 degrees in azimuth)
///
/// # Arguments
/// * `antenna_type` - Type of antenna
/// * `theta` - Fixed elevation angle in radians
/// * `antenna_length` - Antenna length in wavelengths
/// * `active_harmonic` - Active harmonic number
/// * `is_inverted_v` - Inverted V flag
/// * `radial_angle` - Radial angle string
/// * `num_points` - Number of azimuth points to calculate (default 360)
/// * `output` - Output buffer for gain values (must have length >= num_points)
#[wasm_bindgen]
pub fn calculate_antenna_radiation_pattern(
    antenna_type: &str,
    theta: f64,
    antenna_length: f64,
    active_harmonic: i32,
    is_inverted_v: bool,
    radial_angle: &str,
    num_points: usize,
    output: &mut [f64],
) {
    if output.len() < num_points {
        return;
    }

    let two_pi = 2.0 * std::f64::consts::PI;

    for i in 0..num_points {
        let phi = two_pi * (i as f64) / (num_points as f64);
        output[i] = calculate_antenna_gain(
            antenna_type,
            theta,
            phi,
            antenna_length,
            active_harmonic,
            is_inverted_v,
            radial_angle,
        );
    }
}