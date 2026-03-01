use antenna::*;

#[test]
fn test_calculate_pattern_gain_vertical() {
    // Vertical antenna should have uniform gain in all azimuth directions
    assert_eq!(calculate_pattern_gain("vertical", 1.0, 0.0, 0.0), 1.0);
    assert_eq!(calculate_pattern_gain("vertical", 0.0, 0.0, 1.0), 1.0);
    assert_eq!(calculate_pattern_gain("vertical", -1.0, 0.0, 0.0), 1.0);
    assert_eq!(calculate_pattern_gain("vertical", 0.0, 0.0, -1.0), 1.0);
}

#[test]
fn test_calculate_pattern_gain_dp() {
    // Horizontal dipole should have maximum gain perpendicular to wire (along Z)
    let gain_along_wire = calculate_pattern_gain("dp", 1.0, 0.0, 0.0);
    let gain_perpendicular = calculate_pattern_gain("dp", 0.0, 0.0, 1.0);

    assert!(gain_perpendicular > gain_along_wire);
    assert_eq!(gain_perpendicular, 1.0);
    assert_eq!(gain_along_wire, 0.0);
}

#[test]
fn test_calculate_pattern_gain_yagi() {
    // Yagi should have maximum gain along +X direction
    let gain_forward = calculate_pattern_gain("yagi", 1.0, 0.0, 0.0);
    let gain_backward = calculate_pattern_gain("yagi", -1.0, 0.0, 0.0);
    let gain_side = calculate_pattern_gain("yagi", 0.0, 0.0, 1.0);

    assert!(
        gain_forward > gain_backward,
        "Forward gain {} should be greater than backward gain {}",
        gain_forward,
        gain_backward
    );
    assert!(gain_forward > 0.9, "Forward gain should be high");
    // With new pattern side/back is not strictly constant 0.1 but low
    // actually antenna_pattern.rs is UNCHANGED so it acts as before
    assert_eq!(gain_backward, 0.1);
    assert_eq!(gain_side, 0.1);
}

#[test]
fn test_calculate_pattern_gain_moxon() {
    // Moxon should have broader forward pattern
    let gain_forward = calculate_pattern_gain("moxon", 0.0, 0.0, 1.0);
    let _gain_side = calculate_pattern_gain("moxon", 1.0, 0.0, 0.0);
    let gain_back = calculate_pattern_gain("moxon", 0.0, 0.0, -1.0);

    assert!(gain_forward > gain_back);
    assert_eq!(gain_forward, 1.0);
    assert_eq!(gain_back, 0.0);
}

#[test]
fn test_pattern_gain_grid() {
    let positions_x = vec![0.0, 1.0, -1.0, 0.0];
    let positions_z = vec![1.0, 0.0, 0.0, -1.0];
    let mut output = vec![0.0; 4];

    calculate_pattern_gain_grid("dp", &positions_x, &positions_z, 0.5, &mut output);

    // At (0, 1) - perpendicular to wire, should have gain
    assert!(output[0] > 0.0);

    // At (1, 0) - along wire, should have zero gain
    assert_eq!(output[1], 0.0);
}

#[test]
fn test_pattern_radiation() {
    let num_points = 360;
    let mut output = vec![0.0; num_points];

    calculate_pattern_radiation("yagi", num_points, 0.0, &mut output);

    // Check that all values are valid
    for (i, &gain) in output.iter().enumerate() {
        assert!(gain >= 0.0, "Gain at index {} should be non-negative", i);
        assert!(gain <= 1.0, "Gain at index {} should be <= 1", i);
    }

    // Find maximum gain
    let max_gain = output.iter().cloned().fold(0.0, f64::max);
    assert!(max_gain > 0.0, "Should have some non-zero gain");
}

#[test]
fn test_get_pattern_antenna_info() {
    let mut gain = vec![0.0];
    let mut beamwidth = vec![0.0];

    get_pattern_antenna_info("yagi", &mut gain, &mut beamwidth);

    assert!(gain[0] > 0.0);
    assert!(beamwidth[0] > 0.0 && beamwidth[0] <= 360.0);
}

#[test]
fn test_list_antenna_types() {
    let types = list_pattern_antenna_types();
    assert!(!types.is_empty());
    assert!(types.contains("vertical"));
    assert!(types.contains("yagi"));
    assert!(types.contains("moxon"));
}
