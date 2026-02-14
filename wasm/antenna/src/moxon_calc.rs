use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// Moxon antenna configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MoxonConfig {
    pub frequency: f64,     // MHz
    pub wire_diameter: f64, // mm
}

/// Moxon antenna design
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MoxonDesign {
    pub wavelength: f64, // meters
    // Dimensions in mm
    pub a_width: f64,       // Driven Element Width
    pub b_driven_tail: f64, // Driven Element Tail
    pub c_gap: f64,         // Gap
    pub d_ref_tail: f64,    // Reflector Tail
    pub e_depth: f64,       // Total Depth

    // Computed Wire Lengths (for BOM)
    pub wire_length_driven: f64,
    pub wire_length_reflector: f64,

    // Computed totals
    pub total_width: f64,
    pub total_height: f64,

    // Geometry
    pub geometry_width: f64,
    pub geometry_depth: f64,
}

/// Internal calculation function
fn calculate_moxon_internal(config: &MoxonConfig) -> MoxonDesign {
    let frequency = config.frequency;
    let wire_diameter = config.wire_diameter;

    // 1. Calculate wavelength in mm
    let lambda = 299_792.458 / frequency; // mm
    let lambda_m = 299.792_458 / frequency; // meters

    // 2. Log Ratio Calculation
    let dia = if wire_diameter > 0.0 {
        wire_diameter
    } else {
        1.0
    };
    let ratio = lambda / dia;
    let x = ratio.log10();

    // 3. Polynomial Factors (AC6LA / MoxGen / M0UKD)

    // A Factor (Total Width)
    let a_factor = 0.284_203 + 0.054_366 * x - 0.010_186 * x.powi(2) + 0.000_636 * x.powi(3);

    // B Factor (Reflector Tail Length)
    let b_factor_ref_tail =
        0.024_443 + 0.027_038 * x - 0.006_927 * x.powi(2) + 0.000_624 * x.powi(3);

    // D Factor (Driven Element Tail Length)
    let d_factor_driven_tail =
        0.012_921 + 0.027_735 * x - 0.007_624 * x.powi(2) + 0.000_713 * x.powi(3);

    // C Factor (Total Depth / Front-to-Back Spacing)
    let c_factor_depth = 0.170_617 - 0.026_772 * x + 0.004_944 * x.powi(2) - 0.000_297 * x.powi(3);

    // 4. Convert to Dimensions (scale with wavelength)
    let dim_a_width = a_factor * lambda;
    let dim_ref_tail = b_factor_ref_tail * lambda;
    let dim_driven_tail = d_factor_driven_tail * lambda;
    let dim_depth = c_factor_depth * lambda;

    // 5. Calculate Gap
    let dim_gap = dim_depth - dim_driven_tail - dim_ref_tail;
    let dim_gap = if dim_gap > 0.0 { dim_gap } else { 0.0 };

    MoxonDesign {
        wavelength: lambda_m,
        a_width: dim_a_width,
        b_driven_tail: dim_driven_tail,
        c_gap: dim_gap,
        d_ref_tail: dim_ref_tail,
        e_depth: dim_depth,
        total_width: dim_a_width,
        total_height: dim_depth,
        wire_length_driven: dim_a_width + 2.0 * dim_driven_tail,
        wire_length_reflector: dim_a_width + 2.0 * dim_ref_tail,
        geometry_width: dim_a_width,
        geometry_depth: dim_depth,
    }
}

/// Calculate Moxon Rectangle dimensions using AC6LA / MoxGen algorithm.
/// Based on 3rd order polynomial regression of Nec-2 simulation data.
///
/// # Arguments
/// * `config_json` - JSON string containing MoxonConfig
///
/// # Returns
/// JSON string containing MoxonDesign
#[wasm_bindgen]
pub fn calculate_moxon_json(config_json: &str) -> String {
    let config: MoxonConfig = match serde_json::from_str(config_json) {
        Ok(c) => c,
        Err(_) => return "{\"error\": \"Invalid config JSON\"}".to_string(),
    };

    let design = calculate_moxon_internal(&config);

    match serde_json::to_string(&design) {
        Ok(json) => json,
        Err(_) => "{\"error\": \"Failed to serialize result\"}".to_string(),
    }
}

/// Calculate Moxon dimensions for specific frequency and wire size
///
/// Simplified API for quick calculations
///
/// # Arguments
/// * `frequency` - Frequency in MHz
/// * `wire_diameter` - Wire diameter in mm
///
/// # Returns
/// JSON object with {width_mm, depth_mm, driven_wire_length_mm, reflector_wire_length_mm}
#[wasm_bindgen]
pub fn calculate_moxon_simple_json(frequency: f64, wire_diameter: f64) -> String {
    let config = MoxonConfig {
        frequency,
        wire_diameter,
    };
    let design = calculate_moxon_internal(&config);

    format!(
        "{{\"width_mm\": {}, \"depth_mm\": {}, \"driven_wire_length_mm\": {}, \"reflector_wire_length_mm\": {}}}",
        design.a_width,
        design.e_depth,
        design.wire_length_driven,
        design.wire_length_reflector
    )
}

/// Calculate the polynomial factors for educational/display purposes
///
/// Returns the raw polynomial factors used in the calculation
///
/// # Arguments
/// * `frequency` - Frequency in MHz
/// * `wire_diameter` - Wire diameter in mm
///
/// # Returns
/// JSON object with {A_factor, B_factor, D_factor, C_factor}
#[wasm_bindgen]
pub fn calculate_moxon_factors_json(frequency: f64, wire_diameter: f64) -> String {
    let lambda = 299_792.458 / frequency;
    let dia = if wire_diameter > 0.0 {
        wire_diameter
    } else {
        1.0
    };
    let ratio = lambda / dia;
    let x = ratio.log10();

    let a_factor = 0.284_203 + 0.054_366 * x - 0.010_186 * x.powi(2) + 0.000_636 * x.powi(3);
    let b_factor = 0.024_443 + 0.027_038 * x - 0.006_927 * x.powi(2) + 0.000_624 * x.powi(3);
    let d_factor = 0.012_921 + 0.027_735 * x - 0.007_624 * x.powi(2) + 0.000_713 * x.powi(3);
    let c_factor = 0.170_617 - 0.026_772 * x + 0.004_944 * x.powi(2) - 0.000_297 * x.powi(3);

    format!(
        "{{\"A_factor\": {}, \"B_factor\": {}, \"D_factor\": {}, \"C_factor\": {}}}",
        a_factor, b_factor, d_factor, c_factor
    )
}

/// Estimate Moxon antenna gain
///
/// Moxon rectangles typically have ~5.5-6 dBi gain depending on construction
#[wasm_bindgen]
pub fn estimate_moxon_gain() -> f64 {
    5.5 // dBi
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> MoxonConfig {
        MoxonConfig {
            frequency: 14.1,    // 20m band
            wire_diameter: 2.0, // 2mm wire
        }
    }

    #[test]
    fn test_calculate_moxon_basic() {
        let config = create_test_config();
        let design = calculate_moxon_internal(&config);

        assert!(design.a_width > 0.0);
        assert!(design.b_driven_tail > 0.0);
        assert!(design.c_gap > 0.0);
        assert!(design.d_ref_tail > 0.0);
        assert!(design.e_depth > 0.0);

        let expected_wavelength = 299.792_458 / 14.1;
        assert!((design.wavelength - expected_wavelength).abs() < 0.01);

        let expected_gap = design.e_depth - design.b_driven_tail - design.d_ref_tail;
        assert!((design.c_gap - expected_gap).abs() < 0.001);
    }

    #[test]
    fn test_wire_lengths() {
        let config = create_test_config();
        let design = calculate_moxon_internal(&config);

        let expected_driven = design.a_width + 2.0 * design.b_driven_tail;
        assert!((design.wire_length_driven - expected_driven).abs() < 0.001);

        let expected_reflector = design.a_width + 2.0 * design.d_ref_tail;
        assert!((design.wire_length_reflector - expected_reflector).abs() < 0.001);
    }

    #[test]
    fn test_different_frequencies() {
        let bands = vec![
            (3.5, "80m"),
            (7.0, "40m"),
            (14.1, "20m"),
            (21.0, "15m"),
            (28.0, "10m"),
            (145.0, "2m"),
        ];

        for (freq, _name) in bands {
            let config = MoxonConfig {
                frequency: freq,
                wire_diameter: 2.0,
            };
            let design = calculate_moxon_internal(&config);

            assert!(design.a_width > 0.0);
            assert!(design.e_depth > 0.0);
        }
    }

    #[test]
    fn test_zero_wire_diameter_fallback() {
        let config = MoxonConfig {
            frequency: 14.1,
            wire_diameter: 0.0,
        };

        let design = calculate_moxon_internal(&config);
        assert!(design.a_width > 0.0);
    }

    #[test]
    fn test_geometry_calculations() {
        let config = create_test_config();
        let design = calculate_moxon_internal(&config);

        assert!((design.geometry_width - design.a_width).abs() < 0.001);
        assert!((design.geometry_depth - design.e_depth).abs() < 0.001);
        assert!((design.total_width - design.a_width).abs() < 0.001);
        assert!((design.total_height - design.e_depth).abs() < 0.001);
    }
}
