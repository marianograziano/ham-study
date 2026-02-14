use antenna::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct MoxonConfig {
    frequency: f64,
    wire_diameter: f64,
}

#[test]
fn test_calculate_moxon_json() {
    let config = MoxonConfig {
        frequency: 14.1,
        wire_diameter: 2.0,
    };
    let config_json = serde_json::to_string(&config).unwrap();
    let result_json = calculate_moxon_json(&config_json);

    assert!(result_json.contains("a_width"));
    assert!(result_json.contains("e_depth"));
}

#[test]
fn test_calculate_moxon_simple() {
    let result = calculate_moxon_simple_json(14.1, 2.0);

    assert!(result.contains("width_mm"));
    assert!(result.contains("depth_mm"));
}

#[test]
fn test_calculate_moxon_factors() {
    let result = calculate_moxon_factors_json(14.1, 2.0);

    assert!(result.contains("A_factor"));
    assert!(result.contains("B_factor"));
    assert!(result.contains("C_factor"));
    assert!(result.contains("D_factor"));
}

#[test]
fn test_estimate_gain() {
    let gain = estimate_moxon_gain();
    assert!(gain > 0.0);
    assert!(gain < 10.0);
}
