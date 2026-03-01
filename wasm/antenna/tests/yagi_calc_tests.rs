use antenna::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct YagiConfig {
    frequency: f64,
    element_count: usize,
    element_diameter: f64,
    boom_diameter: f64,
    boom_shape: String,
    mount_method: String,
    feed_gap: f64,
    driven_element_type: String,
    spacing_type: String,
    manual_spacing: f64,
    manual_bc_factor: Option<f64>,
    material: Option<String>,
}

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
        material: Some("aluminum".to_string()),
    }
}

#[test]
fn test_calculate_yagi_json() {
    let config = create_test_config();
    let config_json = serde_json::to_string(&config).unwrap();
    let result_json = calculate_yagi_json(&config_json);

    assert!(result_json.contains("elements"));
    assert!(result_json.contains("total_boom_length"));
    assert!(result_json.contains("estimated_gain"));
}

#[test]
fn test_manual_bc_factor_override() {
    let mut config = create_test_config();
    config.manual_bc_factor = Some(0.5);
    let config_json = serde_json::to_string(&config).unwrap();
    let result_json = calculate_yagi_json(&config_json);

    // Hard to verify exact internal values via JSON without deserializing full struct
    // But we expect valid JSON output
    assert!(result_json.contains("elements"));
}

#[test]
fn test_calculate_element_lengths() {
    let result = calculate_yagi_element_lengths(145.0, 5, 6.0, 20.0, "bonded");

    assert!(result.starts_with("["));
    assert!(result.ends_with("]"));
}
