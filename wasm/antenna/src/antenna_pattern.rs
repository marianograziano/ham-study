use crate::electric_field::AntennaType;
use wasm_bindgen::prelude::*;

/// Calculate antenna gain for a specific direction
///
/// # Arguments
/// * `antenna_type` - Type of antenna
/// * `dir_x` - Direction vector X component (normalized)
/// * `dir_y` - Direction vector Y component (normalized)
/// * `dir_z` - Direction vector Z component (normalized)
///
/// # Returns
/// Gain value (0.0 to 1.0)
#[wasm_bindgen]
pub fn calculate_pattern_gain(antenna_type: &str, dir_x: f64, dir_y: f64, dir_z: f64) -> f64 {
    let antenna = AntennaType::from(antenna_type);
    let dir = [dir_x, dir_y, dir_z];

    calculate_gain_internal(antenna, dir)
}

fn calculate_gain_internal(antenna: AntennaType, dir: [f64; 3]) -> f64 {
    let [x, _y, z] = dir;

    match antenna {
        AntennaType::Vertical | AntennaType::GP => {
            // Vertical antennas have omnidirectional pattern in azimuth
            1.0
        }
        AntennaType::DP => {
            // Dipole has figure-8 pattern with nulls perpendicular to wire
            z.abs()
        }
        AntennaType::Yagi => {
            // Yagi has directional pattern along +X (boom direction)
            if x > 0.0 {
                x.powi(2)
            } else {
                0.1
            }
        }
        AntennaType::Moxon => {
            // Moxon has broader forward pattern, usually along +Z
            let gain = (1.0 + z) * 0.5;
            if gain < 0.2 {
                0.0
            } else {
                gain
            }
        }
        AntennaType::Quad => {
            // Quad similar to Yagi
            let front = x.max(0.0);
            front.powi(2) + 0.1
        }
        AntennaType::HB9CV => {
            // HB9CV forward pattern
            let front = x.max(0.0);
            front.powi(2) + 0.05
        }
        AntennaType::MagneticLoop => {
            // Magnetic loop: figure-8 pattern
            z.abs() + 0.05
        }
        AntennaType::LongWire => {
            // Long wire: similar to dipole
            z.abs()
        }
        AntennaType::Windom => {
            // Windom: similar to dipole with offset
            z.abs()
        }
        AntennaType::EndFed => {
            // End-fed: similar to horizontal dipole
            z.abs()
        }
    }
}

/// Calculate gain pattern for a grid of points
///
/// This is optimized for Poynting vector field visualization
///
/// # Arguments
/// * `antenna_type` - Type of antenna
/// * `positions_x` - Array of X positions
/// * `positions_z` - Array of Z positions (same length as positions_x)
/// * `center_skip_radius` - Radius around center to skip (usually the antenna location)
/// * `output` - Output buffer for gain values
#[wasm_bindgen]
pub fn calculate_pattern_gain_grid(
    antenna_type: &str,
    positions_x: &[f64],
    positions_z: &[f64],
    center_skip_radius: f64,
    output: &mut [f64],
) {
    if positions_x.len() != positions_z.len() || positions_x.len() != output.len() {
        return;
    }

    let antenna = AntennaType::from(antenna_type);

    for i in 0..positions_x.len() {
        let x = positions_x[i];
        let z = positions_z[i];

        // Skip center region
        let dist = (x * x + z * z).sqrt();
        if dist < center_skip_radius {
            output[i] = 0.0;
            continue;
        }

        // Calculate normalized direction
        let dir = [x / dist, 0.0, z / dist];
        output[i] = calculate_gain_internal(antenna, dir);
    }
}

/// Calculate complete radiation pattern (360 degrees)
///
/// # Arguments
/// * `antenna_type` - Type of antenna
/// * `num_points` - Number of points to calculate
/// * `elevation_angle` - Elevation angle in radians (0 = horizon, PI/2 = zenith)
/// * `output` - Output buffer for gain values
#[wasm_bindgen]
pub fn calculate_pattern_radiation(
    antenna_type: &str,
    num_points: usize,
    elevation_angle: f64,
    output: &mut [f64],
) {
    if output.len() < num_points {
        return;
    }

    let antenna = AntennaType::from(antenna_type);
    let two_pi = 2.0 * std::f64::consts::PI;
    let cos_el = elevation_angle.cos();
    let sin_el = elevation_angle.sin();

    for i in 0..num_points {
        let azimuth = two_pi * (i as f64) / (num_points as f64);
        let cos_az = azimuth.cos();
        let sin_az = azimuth.sin();

        // Convert spherical to Cartesian
        let x = cos_el * cos_az;
        let y = sin_el;
        let z = cos_el * sin_az;

        let dir = [x, y, z];
        output[i] = calculate_gain_internal(antenna, dir);
    }
}

/// Get antenna characteristics
///
/// # Arguments
/// * `antenna_type` - Type of antenna
/// * `gain_output` - Output for estimated max gain (dBi)
/// * `beamwidth_output` - Output for beamwidth in degrees
#[wasm_bindgen]
pub fn get_pattern_antenna_info(
    antenna_type: &str,
    gain_output: &mut [f64],
    beamwidth_output: &mut [f64],
) {
    if gain_output.is_empty() || beamwidth_output.is_empty() {
        return;
    }

    let (gain, beamwidth) = match antenna_type {
        "vertical" => (1.5, 360.0),
        "dp" => (2.15, 78.0),
        "yagi" => (10.0, 55.0),
        "quad" => (7.0, 70.0),
        "moxon" => (5.5, 90.0),
        "hb9cv" => (6.5, 65.0),
        "magnetic-loop" => (-5.0, 360.0),
        "long-wire" => (3.0, 60.0),
        "windom" => (2.5, 80.0),
        "end-fed" => (2.15, 78.0),
        _ => (0.0, 360.0),
    };

    gain_output[0] = gain;
    beamwidth_output[0] = beamwidth;
}

/// List all supported antenna types as a comma-separated string
#[wasm_bindgen]
pub fn list_pattern_antenna_types() -> String {
    "vertical,gp,dp,yagi,quad,moxon,hb9cv,magnetic-loop,long-wire,windom,end-fed".to_string()
}
