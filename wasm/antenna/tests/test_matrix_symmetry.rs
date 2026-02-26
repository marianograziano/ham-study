use antenna::NecContext;

#[test]
fn test_matrix_symmetry() {
    let mut ctx = NecContext::new();
    ctx.set_frequency(300.0);
    // 3 segments
    let segments = 3;
    let length = 1.0;
    let tag = 1;
    ctx.add_wire(0.0, 0.0, -length/2.0, 0.0, 0.0, length/2.0, 0.001, segments, tag);
    ctx.add_voltage_source(tag, 2, 1.0, 0.0);
    
    ctx.calculate().unwrap();
}
