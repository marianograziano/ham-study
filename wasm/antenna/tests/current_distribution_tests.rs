use antenna::NecContext;

#[test]
fn test_dipole_1_5_lambda_currents() {
    let mut ctx = NecContext::new();
    // 300MHz -> lambda = 1.0m
    ctx.set_frequency(300.0);
    // 1.5 lambda length
    let length = 1.5;
    let segments = 33;
    let tag = 1;

    ctx.add_wire(
        0.0,
        0.0,
        -length / 2.0,
        0.0,
        0.0,
        length / 2.0,
        0.001,
        segments,
        tag,
    );
    let center_seg = (segments / 2) + 1;
    ctx.add_voltage_source(tag, center_seg, 1.0, 0.0);

    ctx.calculate().unwrap();

    let mut center_mag = 0.0;
    let mut max_mag = 0.0;
    let mut current_array = Vec::new();

    for i in 0..segments {
        let mag = ctx.get_current_magnitude(i as usize);
        current_array.push(mag);
        if i == segments / 2 {
            center_mag = mag;
        }
        if mag > max_mag {
            max_mag = mag;
        }
        println!("Segment {}: current mag = {}", i, mag);
    }

    println!("Center mag: {}, Max mag: {}", center_mag, max_mag);
    assert!(max_mag > 0.0);
}
