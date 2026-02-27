use wasm_bindgen::prelude::*;

/// Antenna type for field calculation
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum AntennaType {
    Vertical,
    GP,
    DP,
    Yagi,
    Quad,
    Moxon,
    HB9CV,
    MagneticLoop,
    LongWire,
    Windom,
    EndFed,
}

impl From<&str> for AntennaType {
    fn from(s: &str) -> Self {
        match s {
            "vertical" => AntennaType::Vertical,
            "gp" => AntennaType::GP,
            "dp" | "inverted-v" | "positive-v" => AntennaType::DP,
            "yagi" => AntennaType::Yagi,
            "quad" => AntennaType::Quad,
            "moxon" => AntennaType::Moxon,
            "hb9cv" => AntennaType::HB9CV,
            "magnetic-loop" => AntennaType::MagneticLoop,
            "long-wire" => AntennaType::LongWire,
            "windom" => AntennaType::Windom,
            "end-fed" => AntennaType::EndFed,
            _ => AntennaType::Vertical,
        }
    }
}

/// Polarization type
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum PolarizationType {
    Vertical,
    Horizontal,
    Circular,
    Elliptical,
}

impl From<&str> for PolarizationType {
    fn from(s: &str) -> Self {
        match s {
            "vertical" => PolarizationType::Vertical,
            "horizontal" => PolarizationType::Horizontal,
            "circular" => PolarizationType::Circular,
            "elliptical" => PolarizationType::Elliptical,
            _ => PolarizationType::Vertical,
        }
    }
}

/// Calculate Windom antenna factor using numerical integration
pub(crate) fn calculate_windom_factor(
    dx: f64,
    dy: f64,
    dz: f64,
    n: i32,
    is_inverted_v: bool,
) -> f64 {
    const PI: f64 = std::f64::consts::PI;
    let k_current = n as f64 * PI; // For current distribution sin(n * pi * t)
    let k_phase = n as f64 * PI; // For phase calculation k*r. Length is n*lambda/2, so k*L = n*pi. If we normalize L=1, then k=n*pi.

    let segments = 80;

    let droop = if is_inverted_v { PI / 6.0 } else { 0.0 };
    let sin_d = droop.sin();
    let cos_d = droop.cos();

    let mut ex_real = 0.0;
    let mut ex_imag = 0.0;
    let mut ey_real = 0.0;
    let mut ey_imag = 0.0;
    let mut ez_real = 0.0;
    let mut ez_imag = 0.0;

    for i in 0..segments {
        let t = (i as f64 + 0.5) / segments as f64;
        let current = (k_current * t).sin();
        let dist_from_left = t;
        let dist_from_feed = dist_from_left - 1.0 / 3.0; // feed at 1/3 from left

        let (px, py, pz, tx, ty, tz) = if dist_from_feed < 0.0 {
            // Left arm
            let d = -dist_from_feed;
            (0.0, d * -sin_d, d * -cos_d, 0.0, -sin_d, -cos_d)
        } else {
            // Right arm
            let d = dist_from_feed;
            (0.0, d * -sin_d, d * cos_d, 0.0, -sin_d, cos_d)
        };

        let phase = k_phase * (px * dx + py * dy + pz * dz);
        let cp = phase.cos();
        let sp = phase.sin();

        let jx = current * tx;
        let jy = current * ty;
        let jz = current * tz;

        ex_real += jx * cp;
        ex_imag += jx * sp;
        ey_real += jy * cp;
        ey_imag += jy * sp;
        ez_real += jz * cp;
        ez_imag += jz * sp;
    }

    // Far field E = A - (A.r)r (projection onto plane perpendicular to r)
    let adot_r_real = ex_real * dx + ey_real * dy + ez_real * dz;
    let adot_r_imag = ex_imag * dx + ey_imag * dy + ez_imag * dz;

    let eperp_x_real = ex_real - adot_r_real * dx;
    let eperp_y_real = ey_real - adot_r_real * dy;
    let eperp_z_real = ez_real - adot_r_real * dz;

    let eperp_x_imag = ex_imag - adot_r_imag * dx;
    let eperp_y_imag = ey_imag - adot_r_imag * dy;
    let eperp_z_imag = ez_imag - adot_r_imag * dz;

    let mag_sq = eperp_x_real * eperp_x_real
        + eperp_y_real * eperp_y_real
        + eperp_z_real * eperp_z_real
        + eperp_x_imag * eperp_x_imag
        + eperp_y_imag * eperp_y_imag
        + eperp_z_imag * eperp_z_imag;

    mag_sq.sqrt() / (segments as f64 * 0.5)
}

/// HSL to RGB conversion
fn hsl_to_rgb(h: f64, s: f64, l: f64) -> (f64, f64, f64) {
    if s == 0.0 {
        return (l, l, l);
    }

    let hue2rgb = |p: f64, q: f64, t: f64| -> f64 {
        let mut t = t;
        if t < 0.0 {
            t += 1.0;
        }
        if t > 1.0 {
            t -= 1.0;
        }
        if t < 1.0 / 6.0 {
            return p + (q - p) * 6.0 * t;
        }
        if t < 0.5 {
            return q;
        }
        if t < 2.0 / 3.0 {
            return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
        }
        p
    };

    let q = if l < 0.5 {
        l * (1.0 + s)
    } else {
        l + s - l * s
    };
    let p = 2.0 * l - q;

    let r = hue2rgb(p, q, h + 1.0 / 3.0);
    let g = hue2rgb(p, q, h);
    let b = hue2rgb(p, q, h - 1.0 / 3.0);

    (r, g, b)
}

/// Internal function to calculate electric field
fn calculate_field_internal(
    antenna_type: AntennaType,
    polarization_type: PolarizationType,
    _speed: f64,
    amplitude_scale: f64,
    is_rhcp: bool,
    antenna_length: f64,
    radial_angle: &str,
    active_harmonic: i32,
    is_inverted_v: bool,
    time: f64,
    ground_height: f64,
    grid_size: i32,
    spacing: f64,
    matrix_buffer: &mut [f32],
    color_buffer: &mut [f32],
) {
    let center_offset = (grid_size as f64 * spacing) / 2.0;
    let count = (grid_size * grid_size) as usize;

    // Ensure buffers are large enough
    if matrix_buffer.len() < count * 16 || color_buffer.len() < count * 3 {
        return;
    }

    let k = 2.0; // Wave number
    let speed_factor = 6.0;

    for x in 0..grid_size {
        for z in 0..grid_size {
            let index = (x * grid_size + z) as usize;

            let pos_x = x as f64 * spacing - center_offset;
            let pos_z = z as f64 * spacing - center_offset;

            let dist = (pos_x * pos_x + pos_z * pos_z).sqrt();

            if dist < 1.0 {
                // Zero scale - set identity matrix with zero scale
                set_matrix_at(matrix_buffer, index, 0.0, 0.0, 0.0, 0.0);
                continue;
            }

            // Conical slope logic for GP 60
            let mut y_offset = 0.0;
            if antenna_type == AntennaType::GP && radial_angle == "60" {
                y_offset = dist * 1.2;
            }

            // Phase calculation
            let phase = k * dist - time * speed_factor;
            let mut val_y_base = phase.sin();
            let mut val_h_base = phase.cos();
            let mut wave_pulse_base = (phase.sin() + 1.0) * 0.5;

            if ground_height > 0.0 {
                // If ground is present, add the reflected wave
                // Reflecting perfectly conducting horizontal ground assumption:
                // Grid is in the plane of the antenna (Y=0 usually).
                // Distance to image = sqrt(pos_x^2 + pos_z^2 + (2H)^2)
                // We use height in terms of lambda (1.0 = lambda). k = 2.0 in our visual scale?
                // Wait, in visual scale, spacing=0.4, grid=100.
                // In visualization, k=2.0 generates typical wave density.
                // For height mapping we need to convert ground_height (in lambda) to the same visual scale metrics.
                // The visual wavelength = 2*pi / k = pi ~ 3.14.
                // So ground_height visual = ground_height * pi.
                let height_visual = ground_height * std::f64::consts::PI;
                let dist_img =
                    (pos_x * pos_x + pos_z * pos_z + 4.0 * height_visual * height_visual).sqrt();
                let phase_img = k * dist_img - time * speed_factor;

                // For Horizontal polarization, reflection coeff is -1
                val_y_base -= phase_img.sin();
                val_h_base -= phase_img.cos();
                wave_pulse_base = (val_y_base + 1.0) * 0.5;
            }

            // Direction & handedness
            let angle = pos_z.atan2(pos_x);
            let cos_dir = angle.cos();

            // Polarization logic
            let mut y_scale = 1.0;
            let mut h_scale = 1.0;
            let mut dir_gain = 1.0;

            match polarization_type {
                PolarizationType::Circular | PolarizationType::Elliptical => {
                    let rot_dir = if is_rhcp { 1.0 } else { -1.0 };
                    h_scale = rot_dir * cos_dir;
                    if polarization_type == PolarizationType::Elliptical {
                        h_scale *= 0.6;
                    }

                    let front = cos_dir.max(0.0);
                    let back = (-cos_dir).max(0.0);
                    dir_gain = front.powf(1.5) + 0.3 * back + 0.1;
                }
                _ => {
                    // Check for directional antennas
                    match antenna_type {
                        AntennaType::MagneticLoop => {
                            let cos_a = angle.cos();
                            dir_gain = cos_a.abs() + 0.05;
                            if polarization_type == PolarizationType::Vertical {
                                y_scale = 1.0;
                                h_scale = 0.0;
                            } else {
                                y_scale = 0.0;
                                h_scale = 1.0;
                            }
                        }
                        AntennaType::Yagi | AntennaType::Quad => {
                            let front = cos_dir.max(0.0);
                            dir_gain = front.powi(2) + 0.1;
                            if polarization_type == PolarizationType::Vertical {
                                y_scale = 1.0;
                                h_scale = 0.0;
                            } else {
                                y_scale = 0.0;
                                h_scale = 1.0;
                            }
                        }
                        AntennaType::Moxon => {
                            let sin_dir = angle.sin();
                            let front = sin_dir.max(0.0);
                            dir_gain = front.powi(2) + 0.1;
                            if polarization_type == PolarizationType::Vertical {
                                y_scale = 1.0;
                                h_scale = 0.0;
                            } else {
                                y_scale = 0.0;
                                h_scale = 1.0;
                            }
                        }
                        AntennaType::HB9CV => {
                            let kd = std::f64::consts::PI / 4.0;
                            let delta = 5.0 * std::f64::consts::PI / 4.0;
                            let psi = kd * cos_dir + delta;
                            let mag = (2.0 + 2.0 * psi.cos()).sqrt();
                            dir_gain = (mag / std::f64::consts::SQRT_2).powi(2);
                            if polarization_type == PolarizationType::Vertical {
                                y_scale = 1.0;
                                h_scale = 0.0;
                            } else {
                                y_scale = 0.0;
                                h_scale = 1.0;
                            }
                        }
                        AntennaType::LongWire => {
                            let l = antenna_length;
                            let lobe_arg = 2.5 * std::f64::consts::PI * l * angle.cos();
                            let base_lobe = lobe_arg.sin().abs();
                            let num = base_lobe.powi(2);
                            let den = angle.sin().abs();
                            let val = if den > 0.1 { num / den } else { num * 10.0 };
                            dir_gain = val * 0.5 + 0.05;
                            if polarization_type == PolarizationType::Vertical {
                                y_scale = 1.0;
                                h_scale = 0.0;
                            } else {
                                y_scale = 0.0;
                                h_scale = 1.0;
                            }
                        }
                        AntennaType::Windom => {
                            let n = if active_harmonic > 0 {
                                active_harmonic
                            } else {
                                1
                            };
                            let val = calculate_windom_factor(
                                angle.cos(),
                                0.0,
                                angle.sin(),
                                n,
                                is_inverted_v,
                            );
                            dir_gain = val.powf(1.5) * 0.5 + 0.05;
                            if polarization_type == PolarizationType::Vertical {
                                y_scale = 1.0;
                                h_scale = 0.0;
                            } else {
                                y_scale = 0.0;
                                h_scale = 1.0;
                            }
                        }
                        AntennaType::EndFed => {
                            let n = if active_harmonic > 0 {
                                active_harmonic
                            } else {
                                1
                            };
                            let cos_theta = angle.cos();
                            let sin_theta = angle.sin().abs();
                            let safe_sin_theta = sin_theta.max(0.001);

                            let val = if n % 2 == 1 {
                                let num =
                                    ((n as f64 * std::f64::consts::PI) / 2.0 * cos_theta).cos();
                                (num / safe_sin_theta).abs()
                            } else {
                                let num =
                                    ((n as f64 * std::f64::consts::PI) / 2.0 * cos_theta).sin();
                                (num / safe_sin_theta).abs()
                            };
                            dir_gain = val.powf(1.5) * 0.5 + 0.05;
                            if polarization_type == PolarizationType::Vertical {
                                y_scale = 1.0;
                                h_scale = 0.0;
                            } else {
                                y_scale = 0.0;
                                h_scale = 1.0;
                            }
                        }
                        _ => {
                            // Default handling for Vertical, GP, DP
                            match antenna_type {
                                AntennaType::DP => {
                                    let l_lambda = antenna_length;
                                    let cos_theta = angle.sin();
                                    let sin_theta = angle.cos();
                                    let safe_sin_theta = sin_theta.abs().max(0.001);
                                    let kl_2 = (std::f64::consts::PI * 2.0 * l_lambda) / 2.0;
                                    let num = (kl_2 * cos_theta).cos() - kl_2.cos();
                                    dir_gain = (num / safe_sin_theta).abs();
                                    y_scale = 0.0;
                                    h_scale = 1.0;
                                }
                                AntennaType::Vertical | AntennaType::GP => {
                                    h_scale = 0.0;
                                    dir_gain = 1.0;

                                    // Horizontal polarization fallback only for simple antennas
                                    if polarization_type == PolarizationType::Horizontal {
                                        y_scale = 0.0;
                                        h_scale = angle.sin();
                                        dir_gain = angle.sin().abs() + 0.1;
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }

            let amp = amplitude_scale * dir_gain;
            let decay = (1.0 - dist / 22.0).max(0.0);
            let effective_amp = amp * decay;

            let val_y = val_y_base;
            let val_h = val_h_base;

            let disp_y = val_y * y_scale * effective_amp;
            let disp_h = val_h * h_scale * effective_amp;

            let tan_x = -angle.sin();
            let tan_z = angle.cos();

            let final_x = pos_x + tan_x * disp_h;
            let final_y = disp_y + y_offset;
            let final_z = pos_z + tan_z * disp_h;

            let s = if decay > 0.01 { 1.0 } else { 0.0 };

            // Update matrix
            set_matrix_at(
                matrix_buffer,
                index,
                final_x as f32,
                final_y as f32,
                final_z as f32,
                s as f32,
            );

            // Color logic
            let mut normalized_gain = 0.0;
            let mut use_heat_map = false;

            let is_variable_gain = matches!(
                antenna_type,
                AntennaType::Yagi
                    | AntennaType::Quad
                    | AntennaType::Moxon
                    | AntennaType::HB9CV
                    | AntennaType::MagneticLoop
            ) || polarization_type == PolarizationType::Horizontal;

            match polarization_type {
                PolarizationType::Circular | PolarizationType::Elliptical => {
                    use_heat_map = true;
                    normalized_gain = (cos_dir + 1.0) * 0.5;
                }
                _ => {
                    if is_variable_gain {
                        use_heat_map = true;
                        normalized_gain = ((dir_gain - 0.1) / 1.0).max(0.0).min(1.0);
                    }
                }
            }

            let (mut r, mut g, mut b) = if use_heat_map {
                let hue = (1.0 - normalized_gain) * 0.66;
                hsl_to_rgb(hue, 1.0, 0.5)
            } else {
                hsl_to_rgb(0.55, 0.9, 0.5)
            };

            let wave_pulse = wave_pulse_base;
            let sharpness = wave_pulse.powi(2);
            let effective_gain = dir_gain.max(0.3);
            let brightness = sharpness * decay * 2.0 * effective_gain + 0.2;

            r *= brightness;
            g *= brightness;
            b *= brightness;

            // Update color
            color_buffer[index * 3] = r as f32;
            color_buffer[index * 3 + 1] = g as f32;
            color_buffer[index * 3 + 2] = b as f32;
        }
    }
}

/// WASM-exposed function to calculate electric field
///
/// # Arguments
/// * `antenna_type` - Type of antenna ("vertical", "gp", "dp", "yagi", etc.)
/// * `polarization_type` - Polarization type ("vertical", "horizontal", "circular", "elliptical")
/// * `speed` - Animation speed multiplier
/// * `amplitude_scale` - Amplitude scaling factor
/// * `is_rhcp` - Right-hand circular polarization flag
/// * `antenna_length` - Antenna length parameter
/// * `radial_angle` - Radial angle string ("60", "135", etc.)
/// * `active_harmonic` - Active harmonic number
/// * `is_inverted_v` - Inverted V flag for Windom antenna
/// * `time` - Current time for animation
/// * `ground_height` - Antenna height above ground in wavelengths (0.0 = free space)
/// * `grid_size` - Size of the grid (grid_size x grid_size)
/// * `spacing` - Spacing between grid points
/// * `matrix_buffer` - Output buffer for instance matrices (16 floats per instance)
/// * `color_buffer` - Output buffer for instance colors (3 floats per instance)
#[wasm_bindgen]
pub fn calculate_electric_field(
    antenna_type: &str,
    polarization_type: &str,
    speed: f64,
    amplitude_scale: f64,
    is_rhcp: bool,
    antenna_length: f64,
    radial_angle: &str,
    active_harmonic: i32,
    is_inverted_v: bool,
    time: f64,
    ground_height: f64,
    grid_size: i32,
    spacing: f64,
    matrix_buffer: &mut [f32],
    color_buffer: &mut [f32],
) {
    let antenna_type_enum = AntennaType::from(antenna_type);
    let polarization_type_enum = PolarizationType::from(polarization_type);

    calculate_field_internal(
        antenna_type_enum,
        polarization_type_enum,
        speed,
        amplitude_scale,
        is_rhcp,
        antenna_length,
        radial_angle,
        active_harmonic,
        is_inverted_v,
        time,
        ground_height,
        grid_size,
        spacing,
        matrix_buffer,
        color_buffer,
    );
}

/// Set matrix at index (column-major for Three.js)
/// Matrix format:
/// [ sx, 0,  0,  0 ]
/// [ 0,  sy, 0,  0 ]
/// [ 0,  0,  sz, 0 ]
/// [ ox, oy, oz, 1 ]
fn set_matrix_at(buffer: &mut [f32], index: usize, x: f32, y: f32, z: f32, scale: f32) {
    let offset = index * 16;

    // Column 0
    buffer[offset] = scale;
    buffer[offset + 1] = 0.0;
    buffer[offset + 2] = 0.0;
    buffer[offset + 3] = 0.0;

    // Column 1
    buffer[offset + 4] = 0.0;
    buffer[offset + 5] = scale;
    buffer[offset + 6] = 0.0;
    buffer[offset + 7] = 0.0;

    // Column 2
    buffer[offset + 8] = 0.0;
    buffer[offset + 9] = 0.0;
    buffer[offset + 10] = scale;
    buffer[offset + 11] = 0.0;

    // Column 3 (translation)
    buffer[offset + 12] = x;
    buffer[offset + 13] = y;
    buffer[offset + 14] = z;
    buffer[offset + 15] = 1.0;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hsl_to_rgb() {
        // Test red (hue = 0)
        let (r, g, b) = hsl_to_rgb(0.0, 1.0, 0.5);
        assert!(r > 0.99 && r <= 1.0, "Red component should be ~1.0");
        assert!(g < 0.01, "Green component should be ~0");
        assert!(b < 0.01, "Blue component should be ~0");

        // Test gray (saturation = 0)
        let (r, g, b) = hsl_to_rgb(0.5, 0.0, 0.5);
        assert!((r - 0.5).abs() < 0.01, "Gray R should be 0.5");
        assert!((g - 0.5).abs() < 0.01, "Gray G should be 0.5");
        assert!((b - 0.5).abs() < 0.01, "Gray B should be 0.5");
    }

    #[test]
    fn test_windom_factor() {
        // Test Windom factor calculation
        let factor = calculate_windom_factor(1.0, 0.0, 0.0, 1, false);
        assert!(factor >= 0.0, "Windom factor should be non-negative");
        assert!(factor.is_finite(), "Windom factor should be finite");

        let factor_inv = calculate_windom_factor(1.0, 0.0, 0.0, 1, true);
        assert!(
            factor_inv >= 0.0,
            "Inverted V Windom factor should be non-negative"
        );
        assert!(
            factor_inv.is_finite(),
            "Inverted V Windom factor should be finite"
        );
    }
}
