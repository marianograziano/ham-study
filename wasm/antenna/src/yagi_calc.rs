use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// Yagi antenna configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct YagiConfig {
    pub frequency: f64,                // MHz
    pub element_count: usize,          // count
    pub element_diameter: f64,         // mm
    pub boom_diameter: f64,            // mm
    pub boom_shape: String,            // "round" or "square"
    pub mount_method: String,          // mounting method
    pub feed_gap: f64,                 // mm
    pub driven_element_type: String,   // "folded" or "straight"
    pub spacing_type: String,          // "dl6wu" or "uniform"
    pub manual_spacing: f64,           // in lambda
    pub manual_bc_factor: Option<f64>, // Optional override for K factor
}

/// Yagi element information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct YagiElement {
    pub element_type: String, // "REF", "DE", "DIR"
    pub name: String,
    pub position: f64,         // cumulative from 0 (mm)
    pub spacing: f64,          // dist from previous (mm)
    pub length: f64,           // total length (mm)
    pub half_length: f64,      // (mm)
    pub cut_length: f64,       // length after gap adjustment (for DE) (mm)
    pub gap: Option<f64>,      // (mm) - for DE
    pub style: Option<String>, // "folded" or "straight" - for DE
}

/// Complete Yagi antenna design
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct YagiDesign {
    pub elements: Vec<YagiElement>,
    pub total_boom_length: f64,
    pub estimated_gain: f64,
    pub boom_correction: f64,
    pub bc_factor: f64,
    pub wavelength: f64,
}

/// Calculate boom correction factor (K factor)
fn calculate_bc_factor(
    element_diameter: f64,
    boom_diameter: f64,
    mount_method: &str,
    manual_bc_factor: Option<f64>,
) -> f64 {
    // Check if manual override is provided
    if let Some(bc) = manual_bc_factor {
        return bc;
    }

    let d = element_diameter;
    let b = boom_diameter;
    let ratio = if d > 0.0 { b / d } else { 0.0 };

    match mount_method {
        "non_metal" | "none" => 0.0,
        "above_insulated" | "above" => 0.05,
        "through_insulated" | "insulated" => 0.3,
        "through_bonded" | "bonded" => {
            // VK5DJ dynamic logic
            if ratio > 1.0 {
                let bc = 0.35 + 0.23 * ratio.ln();
                if bc > 1.0 {
                    1.0
                } else {
                    bc
                }
            } else {
                0.0
            }
        }
        _ => 0.0,
    }
}

/// Internal calculation function
fn calculate_yagi_internal(config: &YagiConfig) -> YagiDesign {
    let frequency = config.frequency;
    let element_count = config.element_count;
    let element_diameter = config.element_diameter;
    let boom_diameter = config.boom_diameter;
    let mount_method = config.mount_method.as_str();
    let feed_gap = config.feed_gap;
    let driven_element_type = config.driven_element_type.as_str();
    let spacing_type = config.spacing_type.as_str();
    let manual_spacing = config.manual_spacing;
    let manual_bc_factor = config.manual_bc_factor;

    // 1. Calculate wavelength
    let lambda = 299_792.458 / frequency; // mm

    // 2. Calculate Boom Correction Factor
    let bc_factor = calculate_bc_factor(
        element_diameter,
        boom_diameter,
        mount_method,
        manual_bc_factor,
    );
    let boom_correction = bc_factor * boom_diameter;

    // 3. Calculate Elements
    let mut elements: Vec<YagiElement> = Vec::new();
    let mut current_pos = 0.0;

    // --- Reflector ---
    let ref_len = 0.495 * lambda + boom_correction;
    elements.push(YagiElement {
        element_type: "REF".to_string(),
        name: "Reflector".to_string(),
        position: 0.0,
        spacing: 0.0,
        length: ref_len,
        half_length: ref_len / 2.0,
        cut_length: ref_len,
        gap: None,
        style: None,
    });

    // --- Driven Element (DE) ---
    let space_ref_to_de = if spacing_type == "uniform" {
        manual_spacing * lambda
    } else {
        0.2 * lambda
    };
    current_pos += space_ref_to_de;

    // DE Length calculation
    let base_len = 0.473 * lambda;
    let de_total_len = base_len + boom_correction - element_diameter * 0.5;

    let de_cut_len = if driven_element_type == "straight" {
        de_total_len - feed_gap
    } else {
        de_total_len
    };

    elements.push(YagiElement {
        element_type: "DE".to_string(),
        name: "Driven Element".to_string(),
        position: current_pos,
        spacing: space_ref_to_de,
        length: de_total_len,
        half_length: de_total_len / 2.0,
        cut_length: de_cut_len,
        gap: Some(feed_gap),
        style: Some(driven_element_type.to_string()),
    });

    // --- Directors ---
    for i in 1..=(element_count - 2) {
        let spacing = if spacing_type == "uniform" {
            manual_spacing * lambda
        } else {
            // DL6WU Spacing Model
            match i {
                1 => 0.075 * lambda,
                2 => 0.18 * lambda,
                3 => 0.215 * lambda,
                4 => 0.25 * lambda,
                _ => {
                    let factor = 0.28 + (i - 5) as f64 * 0.01;
                    let factor = if factor > 0.35 { 0.35 } else { factor };
                    factor * lambda
                }
            }
        };
        current_pos += spacing;

        // DL6WU Length Model
        let mut len_factor = 0.455 - (i - 1) as f64 * 0.005;
        if len_factor < 0.405 {
            len_factor = 0.405;
        }

        let dir_len = len_factor * lambda + boom_correction;

        elements.push(YagiElement {
            element_type: "DIR".to_string(),
            name: format!("Director {}", i),
            position: current_pos,
            spacing,
            length: dir_len,
            half_length: dir_len / 2.0,
            cut_length: dir_len,
            gap: None,
            style: None,
        });
    }

    // 4. Final Estimates
    let estimated_gain = element_count as f64 * 1.2 + 2.15;

    YagiDesign {
        elements,
        total_boom_length: current_pos,
        estimated_gain,
        boom_correction,
        bc_factor,
        wavelength: lambda,
    }
}

/// Calculate Yagi-Uda antenna dimensions based on DL6WU and VK5DJ models.
///
/// # Arguments
/// * `config_json` - JSON string containing YagiConfig
///
/// # Returns
/// JSON string containing YagiDesign
#[wasm_bindgen]
pub fn calculate_yagi_json(config_json: &str) -> String {
    let config: YagiConfig = match serde_json::from_str(config_json) {
        Ok(c) => c,
        Err(_) => return "{\"error\": \"Invalid config JSON\"}".to_string(),
    };

    let design = calculate_yagi_internal(&config);

    match serde_json::to_string(&design) {
        Ok(json) => json,
        Err(_) => "{\"error\": \"Failed to serialize result\"}".to_string(),
    }
}

/// Calculate estimated gain based on element count
///
/// Simple estimation formula: gain = element_count * 1.2 + 2.15 dBi
#[wasm_bindgen]
pub fn estimate_yagi_gain(element_count: usize) -> f64 {
    element_count as f64 * 1.2 + 2.15
}

/// Calculate boom correction factor and amount
///
/// # Arguments
/// * `element_diameter` - Element diameter in mm
/// * `boom_diameter` - Boom diameter in mm
/// * `mount_method` - Mounting method string
///
/// # Returns
/// JSON object with {bc_factor, correction_mm}
#[wasm_bindgen]
pub fn calculate_boom_correction_json(
    element_diameter: f64,
    boom_diameter: f64,
    mount_method: &str,
) -> String {
    let bc_factor = calculate_bc_factor(element_diameter, boom_diameter, mount_method, None);
    let correction = bc_factor * boom_diameter;

    format!(
        "{{\"bc_factor\": {}, \"correction_mm\": {}}}",
        bc_factor, correction
    )
}

/// Calculate Yagi element lengths only (simplified API)
///
/// # Arguments
/// * `frequency` - Frequency in MHz
/// * `element_count` - Number of elements
/// * `element_diameter` - Element diameter in mm
/// * `boom_diameter` - Boom diameter in mm
/// * `mount_method` - Mount method string
///
/// # Returns
/// JSON array of element lengths in mm
#[wasm_bindgen]
pub fn calculate_yagi_element_lengths(
    frequency: f64,
    element_count: usize,
    element_diameter: f64,
    boom_diameter: f64,
    mount_method: &str,
) -> String {
    let config = YagiConfig {
        frequency,
        element_count,
        element_diameter,
        boom_diameter,
        boom_shape: "round".to_string(),
        mount_method: mount_method.to_string(),
        feed_gap: 10.0,
        driven_element_type: "straight".to_string(),
        spacing_type: "dl6wu".to_string(),
        manual_spacing: 0.2,
        manual_bc_factor: None,
    };

    let design = calculate_yagi_internal(&config);
    let lengths: Vec<f64> = design.elements.iter().map(|e| e.length).collect();

    match serde_json::to_string(&lengths) {
        Ok(json) => json,
        Err(_) => "[]".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> YagiConfig {
        YagiConfig {
            frequency: 145.0,
            element_count: 5,
            element_diameter: 6.0,
            boom_diameter: 20.0,
            boom_shape: "round".to_string(),
            mount_method: "bonded".to_string(),
            feed_gap: 10.0,
            driven_element_type: "straight".to_string(),
            spacing_type: "dl6wu".to_string(),
            manual_spacing: 0.2,
            manual_bc_factor: None,
        }
    }

    #[test]
    fn test_calculate_yagi_basic() {
        let config = create_test_config();
        let design = calculate_yagi_internal(&config);

        assert_eq!(design.elements.len(), config.element_count);
        assert_eq!(design.elements[0].element_type, "REF");
        assert_eq!(design.elements[1].element_type, "DE");

        for i in 2..design.elements.len() {
            assert_eq!(design.elements[i].element_type, "DIR");
        }

        let expected_wavelength = 299_792.458 / 145.0;
        assert!((design.wavelength - expected_wavelength).abs() < 0.1);
        assert!(design.estimated_gain > 0.0);
    }

    #[test]
    fn test_boom_correction_calculation() {
        let (k, _) = calculate_bc_factor(6.0, 20.0, "bonded", None);
        assert!(k > 0.0);

        let (k, _) = calculate_bc_factor(6.0, 20.0, "none", None);
        assert_eq!(k, 0.0);

        let (k, _) = calculate_bc_factor(6.0, 20.0, "insulated", None);
        assert_eq!(k, 0.3);
    }

    #[test]
    fn test_manual_bc_factor_override() {
        let mut config = create_test_config();
        config.manual_bc_factor = Some(0.5);

        let design = calculate_yagi_internal(&config);
        assert!((design.bc_factor - 0.5).abs() < 0.001);
    }

    #[test]
    fn test_uniform_spacing() {
        let mut config = create_test_config();
        config.spacing_type = "uniform".to_string();
        config.manual_spacing = 0.25;

        let design = calculate_yagi_internal(&config);

        for i in 2..design.elements.len() {
            let expected_spacing = 0.25 * design.wavelength;
            assert!((design.elements[i].spacing - expected_spacing).abs() < 0.1);
        }
    }

    #[test]
    fn test_estimate_gain() {
        let gain_3 = estimate_yagi_gain(3);
        let gain_5 = estimate_yagi_gain(5);
        let gain_10 = estimate_yagi_gain(10);

        assert!(gain_5 > gain_3);
        assert!(gain_10 > gain_5);
        assert!((gain_5 - (5.0 * 1.2 + 2.15)).abs() < 0.001);
    }

    #[test]
    fn test_folded_vs_straight_driven_element() {
        let mut config = create_test_config();

        config.driven_element_type = "straight".to_string();
        let design_straight = calculate_yagi_internal(&config);

        config.driven_element_type = "folded".to_string();
        let design_folded = calculate_yagi_internal(&config);

        let de_straight = &design_straight.elements[1];
        let de_folded = &design_folded.elements[1];

        assert!((de_straight.cut_length - (de_straight.length - config.feed_gap)).abs() < 0.001);
        assert!((de_folded.cut_length - de_folded.length).abs() < 0.001);
    }

    #[test]
    fn test_calculate_yagi_json() {
        let config = create_test_config();
        let config_json = serde_json::to_string(&config).unwrap();
        let result_json = calculate_yagi_json(&config_json);

        assert!(result_json.contains("elements"));
        assert!(result_json.contains("total_boom_length"));
    }

    #[test]
    fn test_calculate_element_lengths() {
        let result = calculate_yagi_element_lengths(145.0, 5, 6.0, 20.0, "bonded");

        assert!(result.starts_with("["));
        assert!(result.ends_with("]"));
    }
}
