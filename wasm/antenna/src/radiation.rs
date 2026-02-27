use crate::AntennaType;
use wasm_bindgen::prelude::*;

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
    material: Option<String>,
) -> f64 {
    let antenna_type_enum = AntennaType::from(antenna_type);

    // Material efficiency factor
    let efficiency = match material.as_deref() {
        Some("stainless_steel") => 0.85,
        Some("fiberglass") | Some("plastic") => 0.01,
        _ => 1.0, // Aluminum, Copper, or undefined
    };

    let cos_theta = theta.cos();
    let x = cos_theta * phi.cos();
    let y = theta.sin();
    let z = cos_theta * phi.sin();

    let gain = match antenna_type_enum {
        AntennaType::Vertical | AntennaType::GP => {
            if radial_angle == "135" {
                let cos_theta_from_zenith = y.abs(); // vertical axis is Y
                let sin_theta_from_zenith = (1.0 - y * y).sqrt().max(0.001);

                let num = (std::f64::consts::PI / 2.0 * cos_theta_from_zenith).cos();
                (num / sin_theta_from_zenith).abs()
            } else if radial_angle == "60" {
                let elevation = y.asin();
                let target_elevation = std::f64::consts::PI / 4.0; // 45 deg up
                let beam_shape = (elevation - target_elevation).cos();
                let mut gain = beam_shape * beam_shape * beam_shape;
                if y > 0.98 {
                    gain = 0.0;
                }
                gain * 1.2
            } else {
                1.0
            }
        }
        AntennaType::DP => {
            // Dipole axis is Z
            let cos_gamma = z;
            let sin_gamma = (1.0 - z * z).sqrt().max(0.001);
            let kl_2 = std::f64::consts::PI * antenna_length;
            let num = (kl_2 * cos_gamma).cos() - kl_2.cos();
            let mut gain = (num / sin_gamma).abs();
            if is_inverted_v {
                gain *= 0.9;
            }
            gain
        }
        AntennaType::Yagi => {
            let exponent = 2.0 + 4.0 * antenna_length.max(0.0);
            let main_lobe = if x > 0.0 { x.powf(exponent) } else { 0.0 };

            // Side lobes approximation based on azimuth angle phi and zenith attenuation
            let side_lobes = (3.0 * phi).cos().abs() * 0.15 * cos_theta.abs();

            let fbr_floor = if x < 0.0 { 0.05 } else { 0.0 };

            let raw = main_lobe + side_lobes * (1.0 - main_lobe) + fbr_floor;
            raw.min(1.0)
        }
        AntennaType::Quad => {
            // Quad pointing +X
            let front = (1.0 + x) / 2.0;
            front.powi(2)
        }
        AntennaType::Moxon => {
            // Moxon pointing +Z
            let mut gain = 0.1;
            if z > 0.0 {
                gain += z * z;
            }
            gain
        }
        AntennaType::HB9CV => {
            // HB9CV pointing +X
            let kd = std::f64::consts::PI / 4.0;
            let delta = 5.0 * std::f64::consts::PI / 4.0;
            let psi = kd * x + delta;
            let mag = (2.0 + 2.0 * psi.cos()).sqrt();
            (mag / std::f64::consts::SQRT_2).powi(2)
        }
        AntennaType::MagneticLoop => {
            // Magnetic loop in XY plane, nulls at Z
            (1.0 - z * z).max(0.1)
        }
        AntennaType::LongWire => crate::calculate_field(phi, antenna_length, "standing"),
        AntennaType::Windom => {
            let n = if active_harmonic > 0 {
                active_harmonic
            } else {
                1
            };
            crate::calculate_windom_factor(x, y, z, n, is_inverted_v)
        }
        AntennaType::EndFed => {
            let n = if active_harmonic > 0 {
                active_harmonic
            } else {
                1
            };
            let cos_theta_axis = x;
            let sin_theta_axis = (1.0 - x * x).sqrt().max(0.001);

            let val = if n % 2 == 1 {
                let num = ((n as f64 * std::f64::consts::PI) / 2.0 * cos_theta_axis).cos();
                (num / sin_theta_axis).abs()
            } else {
                let num = ((n as f64 * std::f64::consts::PI) / 2.0 * cos_theta_axis).sin();
                (num / sin_theta_axis).abs()
            };
            val
        }
        AntennaType::InvertedV | AntennaType::PositiveV => {
            // V-antennas: slightly broader than a normal dipole in the main planes
            let cos_gamma = z;
            let sin_gamma = (1.0 - z * z).sqrt().max(0.001);
            let kl_2 = std::f64::consts::PI * antenna_length;
            let num = (kl_2 * cos_gamma).cos() - kl_2.cos();
            let mut gain = (num / sin_gamma).abs();
            gain *= 0.95; // Slightly less peak gain than straight dipole
            gain
        }
    };

    gain * efficiency
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
/// * `material` - Antenna material (optional)
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
    material: Option<String>,
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
            material.clone(),
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
/// * `material` - Antenna material (optional)
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
    material: Option<String>,
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
            material.clone(),
        );
    }
}
