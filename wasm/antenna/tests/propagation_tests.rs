use antenna::*;

#[test]
fn test_signal_path_hf() {
    let mut params = PropagationParams::new();
    params.mode = PropagationMode::HF;
    params.frequency = 7.0; // Below MUF, should reflect
    params.angle = 30.0;
    params.iono_height = 300.0;
    params.earth_radius = 6371.0;
    params.max_hops = 2;
    params.critical_frequency = 7.0;

    let mut path = vec![0.0f32; 100];
    let mut impacts = vec![0u8; 100];

    let count = calculate_signal_path(&params, &mut path, &mut impacts);
    assert!(count > 2); // Should have at least start + some path points
}

#[test]
fn test_signal_path_uv() {
    let mut params = PropagationParams::new();
    params.mode = PropagationMode::UV;
    params.frequency = 100.0;
    params.angle = 30.0;
    params.iono_height = 300.0;
    params.earth_radius = 6371.0;
    params.max_hops = 2;
    params.critical_frequency = 7.0;

    let mut path = vec![0.0f32; 100];
    let mut impacts = vec![0u8; 100];

    let count = calculate_signal_path(&params, &mut path, &mut impacts);
    assert!(count >= 2); // UV mode should penetrate, shorter path
}

#[test]
fn test_ground_wave_strength() {
    // Low frequency strong ground wave
    let strength_3mhz = calculate_ground_wave_strength(3.0);
    assert!(strength_3mhz > 10.0);

    // High frequency weak ground wave
    let strength_30mhz = calculate_ground_wave_strength(30.0);
    assert!(strength_30mhz < 5.0);

    // UHF no ground wave
    let strength_100mhz = calculate_ground_wave_strength(100.0);
    assert_eq!(strength_100mhz, 0.0);
}
