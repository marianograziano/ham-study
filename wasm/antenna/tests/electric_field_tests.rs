use antenna::*;

#[test]
fn test_calculate_electric_field_basic() {
    let grid_size = 10;
    let count = (grid_size * grid_size) as usize;
    let mut matrix_buffer = vec![0.0f32; count * 16];
    let mut color_buffer = vec![0.0f32; count * 3];

    calculate_electric_field(
        "vertical",
        "vertical",
        1.0,
        1.5,
        true,
        2.5,
        "60",
        1,
        false,
        0.0,
        0.0,
        grid_size,
        0.4,
        &mut matrix_buffer,
        &mut color_buffer,
    );

    // Check that buffers were filled (not all zeros)
    let matrix_sum: f32 = matrix_buffer.iter().sum();
    let color_sum: f32 = color_buffer.iter().sum();

    assert!(
        matrix_sum != 0.0,
        "Matrix buffer should contain non-zero values"
    );
    assert!(
        color_sum != 0.0,
        "Color buffer should contain non-zero values"
    );
}

#[test]
fn test_calculate_electric_field_center_zero() {
    let grid_size = 10;
    let count = (grid_size * grid_size) as usize;
    let mut matrix_buffer = vec![0.0f32; count * 16];
    let mut color_buffer = vec![0.0f32; count * 3];

    calculate_electric_field(
        "vertical",
        "vertical",
        1.0,
        1.5,
        true,
        2.5,
        "60",
        1,
        false,
        0.0,
        0.0,
        grid_size,
        0.4,
        &mut matrix_buffer,
        &mut color_buffer,
    );

    // Center point (index 0,0 is at x=0, z=0 in the middle)
    // The center offset calculation means the center is at grid_size/2
    let center_x = grid_size / 2;
    let center_z = grid_size / 2;
    let center_index = (center_x * grid_size + center_z) as usize;
    let offset = center_index * 16;

    // Center should have zero scale (dist < 1.0)
    assert_eq!(
        matrix_buffer[offset], 0.0,
        "Center point should have zero scale"
    );
}

#[test]
fn test_calculate_electric_field_different_antenna_types() {
    let antenna_types = vec![
        "vertical",
        "gp",
        "dp",
        "yagi",
        "quad",
        "moxon",
        "hb9cv",
        "magnetic-loop",
        "long-wire",
        "windom",
        "end-fed",
    ];

    for ant_type in antenna_types {
        let grid_size = 10;
        let count = (grid_size * grid_size) as usize;
        let mut matrix_buffer = vec![0.0f32; count * 16];
        let mut color_buffer = vec![0.0f32; count * 3];

        calculate_electric_field(
            ant_type,
            "vertical",
            1.0,
            1.5,
            true,
            2.5,
            "60",
            1,
            false,
            0.0,
            0.0,
            grid_size,
            0.4,
            &mut matrix_buffer,
            &mut color_buffer,
        );

        // All antenna types should produce valid output
        let matrix_sum: f32 = matrix_buffer.iter().sum();
        assert!(
            matrix_sum.is_finite(),
            "Antenna type {} produced non-finite values",
            ant_type
        );
    }
}

#[test]
fn test_calculate_electric_field_polarization_types() {
    let polarization_types = vec!["vertical", "horizontal", "circular", "elliptical"];

    for pol_type in polarization_types {
        let grid_size = 10;
        let count = (grid_size * grid_size) as usize;
        let mut matrix_buffer = vec![0.0f32; count * 16];
        let mut color_buffer = vec![0.0f32; count * 3];

        calculate_electric_field(
            "vertical",
            pol_type,
            1.0,
            1.5,
            true,
            2.5,
            "60",
            1,
            false,
            0.0,
            0.0,
            grid_size,
            0.4,
            &mut matrix_buffer,
            &mut color_buffer,
        );

        let matrix_sum: f32 = matrix_buffer.iter().sum();
        assert!(
            matrix_sum.is_finite(),
            "Polarization type {} produced non-finite values",
            pol_type
        );
    }
}

#[test]
fn test_calculate_electric_field_time_evolution() {
    let grid_size = 10;
    let count = (grid_size * grid_size) as usize;

    // Calculate at two different times
    let mut matrix_buffer_1 = vec![0.0f32; count * 16];
    let mut color_buffer_1 = vec![0.0f32; count * 3];

    let mut matrix_buffer_2 = vec![0.0f32; count * 16];
    let mut color_buffer_2 = vec![0.0f32; count * 3];

    calculate_electric_field(
        "vertical",
        "vertical",
        1.0,
        1.5,
        true,
        2.5,
        "60",
        1,
        false,
        0.0,
        0.0,
        grid_size,
        0.4,
        &mut matrix_buffer_1,
        &mut color_buffer_1,
    );

    calculate_electric_field(
        "vertical",
        "vertical",
        1.0,
        1.5,
        true,
        2.5,
        "60",
        1,
        false,
        1.0,
        0.0, // ground_height
        grid_size,
        0.4,
        &mut matrix_buffer_2,
        &mut color_buffer_2,
    );

    // Results should be different at different times
    let sum_1: f32 = matrix_buffer_1.iter().sum();
    let sum_2: f32 = matrix_buffer_2.iter().sum();

    assert_ne!(sum_1, sum_2, "Field should evolve over time");
}
