use crate::calculate_windom_factor;
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

    let gain = match antenna_type_enum {
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
            // Improved Yagi pattern with side lobes
            // Main lobe: cos^2.5(phi)
            // Side lobes: 0.15 * |cos(3*phi)| for back/side

            let cos_phi = phi.cos();

            // Elevation factor (theta is elevation from horizontal, 0 = horizon, pi/2 = zenith)
            // We want max gain at theta = 0, so we use cos(theta)
            let cos_theta = theta.cos();
            // Protect against negative cos_theta (should be positive for -pi/2 to pi/2, but safety first)
            let elevation_factor = cos_theta.abs();

            // Forward main lobe
            // Power factor depends on antenna length (gain)
            // Longer antenna -> sharper beam -> higher exponent
            // Base exponent 2.0, plus length contribution
            let exponent = 2.0 + 4.0 * antenna_length.max(0.0);

            // Combine azimuth and elevation for 3D pencil beam
            // We apply the same exponent to elevation to get a circular beam cross-section
            let main_lobe = if cos_phi > 0.0 {
                cos_phi.powf(exponent) * elevation_factor.powf(exponent)
            } else {
                0.0
            };

            // Side/Back lobes approximation
            // Also attenuate side lobes with elevation, but maybe less aggressively or same?
            // Realistically side lobes are also 3D structures.
            // Let's attenuate them normally with elevation to avoid vertical fans
            let side_lobes = (3.0 * phi).cos().abs() * 0.15 * elevation_factor;

            // Front-to-back ratio floor (non-zero back radiation)
            let fbr_floor = if cos_phi < 0.0 { 0.05 } else { 0.0 };

            // Composite pattern
            let raw = main_lobe + side_lobes * (1.0 - main_lobe) + fbr_floor;

            // Normalize to peak at ~1.0 + FBR
            raw.min(1.0)
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
            let n = if active_harmonic > 0 {
                active_harmonic
            } else {
                1
            };
            calculate_windom_factor(phi, n, is_inverted_v)
        }
        AntennaType::EndFed => {
            // End-fed antenna pattern
            let n = if active_harmonic > 0 {
                active_harmonic
            } else {
                1
            };
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
