use wasm_bindgen::prelude::*;

// Re-export all modules
mod electric_field;
mod geometry;
mod propagation;

pub use electric_field::*;
pub use geometry::*;
pub use propagation::*;

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
pub fn calculate_field_batch(
    angles: &[f64],
    length: f64,
    wave_type: &str,
    output: &mut [f64],
) {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_field_standing_wave() {
        // Test standing wave pattern for a half-wave dipole (length = 0.5)
        let length = 0.5;
        
        // At theta = 90 degrees (PI/2), should have maximum field
        let field_90 = calculate_field(std::f64::consts::PI / 2.0, length, "standing");
        assert!(field_90 > 0.0, "Field at 90 degrees should be positive");
        
        // At theta = 0, field should be 0 (sin(0) = 0)
        let field_0 = calculate_field(0.0, length, "standing");
        assert!(field_0 < 0.01, "Field at 0 degrees should be near zero");
    }

    #[test]
    fn test_calculate_field_traveling_wave() {
        // Test traveling wave pattern
        let length = 2.0;
        
        // Traveling wave should have some field at most angles
        let field_90 = calculate_field(std::f64::consts::PI / 2.0, length, "traveling");
        assert!(field_90 > 0.0, "Traveling wave field at 90 degrees should be positive");
        
        // Field should be finite
        assert!(field_90.is_finite(), "Field should be finite");
    }

    #[test]
    fn test_calculate_field_batch() {
        let angles = vec![0.0, std::f64::consts::PI / 4.0, std::f64::consts::PI / 2.0];
        let mut output = vec![0.0; 3];
        
        calculate_field_batch(&angles, 1.0, "standing", &mut output);
        
        // Check that output was filled
        assert!(output[0] >= 0.0, "Output should be non-negative");
        assert!(output[1] >= 0.0, "Output should be non-negative");
        assert!(output[2] >= 0.0, "Output should be non-negative");
        
        // Middle angle should have higher field than 0
        assert!(output[1] > output[0], "Field at 45 degrees should be higher than at 0 degrees");
    }

    #[test]
    fn test_calculate_radiation_pattern() {
        let num_points = 360;
        let mut output = vec![0.0; num_points];
        
        calculate_radiation_pattern(2.0, "standing", num_points, &mut output);
        
        // Check that all values are valid
        for (i, &field) in output.iter().enumerate() {
            assert!(field >= 0.0, "Field at index {} should be non-negative", i);
            assert!(field.is_finite(), "Field at index {} should be finite", i);
        }
        
        // Find maximum field
        let max_field = output.iter().cloned().fold(0.0, f64::max);
        assert!(max_field > 0.0, "Should have some non-zero field");
    }

    #[test]
    fn test_wave_type_from_str() {
        assert_eq!(WaveType::from("traveling"), WaveType::Traveling);
        assert_eq!(WaveType::from("standing"), WaveType::Standing);
        assert_eq!(WaveType::from("unknown"), WaveType::Standing); // Default
    }

    #[test]
    fn test_calculate_field_symmetry() {
        // Field pattern should be symmetric around the wire axis
        let length = 1.5;
        let field_45 = calculate_field(std::f64::consts::PI / 4.0, length, "standing");
        let field_135 = calculate_field(3.0 * std::f64::consts::PI / 4.0, length, "standing");
        
        // These should be approximately equal (within numerical precision)
        let diff = (field_45 - field_135).abs();
        assert!(diff < 0.001, "Field should be symmetric: {} vs {}", field_45, field_135);
    }
}
