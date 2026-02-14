use antenna::*;

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
    assert!(
        field_90 > 0.0,
        "Traveling wave field at 90 degrees should be positive"
    );

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
    assert!(
        output[1] > output[0],
        "Field at 45 degrees should be higher than at 0 degrees"
    );
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
    // We can't access WaveType enum directly if it's not pub.
    // It is pub in lib.rs: pub enum WaveType
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
    assert!(
        diff < 0.001,
        "Field should be symmetric: {} vs {}",
        field_45,
        field_135
    );
}
