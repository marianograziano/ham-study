use antenna::*;
// use wasm_bindgen_test::*; // Using bindgen test if needed, but standard test for logic is fine

#[test]
fn test_calculate_antenna_gain_yagi_pattern() {
    // Test forward gain (theta=0, phi=0)
    let gain_forward = calculate_antenna_gain("yagi", 0.0, 0.0, 1.0, 1, false, "60", None);

    // Test side gain (theta=0, phi=PI/2)
    let pi_2 = std::f64::consts::PI / 2.0;
    let gain_side = calculate_antenna_gain("yagi", 0.0, pi_2, 1.0, 1, false, "60", None);

    // Test back gain (theta=0, phi=PI)
    let pi = std::f64::consts::PI;
    let gain_back = calculate_antenna_gain("yagi", 0.0, pi, 1.0, 1, false, "60", None);

    assert!(gain_forward > 0.9, "Forward gain should be high");
    assert!(gain_side < 0.2, "Side gain should be low (null)");
    assert!(gain_back < 0.21, "Back gain should be low");

    // Check side lobe existence (e.g. at 60 degrees)
    // 3*phi = 180 -> cos(180) = -1. Side lobe max is around 60 deg?
    // cos(3*60) = cos(180) = -1. abs=1. * 0.15 = 0.15.
    // Main lobe at 60 deg: cos(60)=0.5. 0.5^2.5 ~ 0.17.
    // Total ~ 0.32.
    let deg_60 = pi / 3.0;
    let gain_60 = calculate_antenna_gain("yagi", 0.0, deg_60, 1.0, 1, false, "60", None);

    // 0.32 is significant compared to 0.1 side null
    // Just verify it calculates without error and is within range
    assert!(gain_60 > 0.0 && gain_60 < 1.0);
}

#[test]
fn test_calculate_antenna_gain_material_loss() {
    // Baseline (Aluminum)
    let gain_al = calculate_antenna_gain("yagi", 0.0, 0.0, 1.0, 1, false, "60", None);

    // Stainless Steel
    let gain_ss = calculate_antenna_gain(
        "yagi",
        0.0,
        0.0,
        1.0,
        1,
        false,
        "60",
        Some("stainless_steel".to_string()),
    );

    // Lossy material
    let gain_fiber = calculate_antenna_gain(
        "yagi",
        0.0,
        0.0,
        1.0,
        1,
        false,
        "60",
        Some("fiberglass".to_string()),
    );

    assert!(
        gain_ss < gain_al,
        "Stainless steel should have lower gain than Aluminum"
    );
    assert!(
        (gain_ss - gain_al * 0.85).abs() < 0.001,
        "SS should be ~85% efficient"
    );
    assert!(gain_fiber < 0.1, "Fiberglass should have very low gain");
}
