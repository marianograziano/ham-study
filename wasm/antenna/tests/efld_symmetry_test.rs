use antenna::nec::physics::efld;
use antenna::nec::simulation::NecSimulation;

#[test]
fn test_efld_symmetry() {
    let mut sim = NecSimulation::new();
    sim.initialize(1);
    sim.set_frequency(300.0);
    sim.add_wire(0.0, 0.0, -0.5, 0.0, 0.0, 0.5, 0.001, 10, 1);
    sim.context.geometry.connect(0);

    let i = 4;
    let j = 6;

    let xi = sim.context.geometry.x[i];
    let yi = sim.context.geometry.y[i];
    let zi = sim.context.geometry.z[i];
    let ai = sim.context.geometry.bi[i];

    let xj = sim.context.geometry.x[j];
    let yj = sim.context.geometry.y[j];
    let zj = sim.context.geometry.z[j];
    let aj = sim.context.geometry.bi[j];

    println!("Testing efld symmetry between seg {} and seg {}", i, j);
    println!(
        "  Seg {}: pos=({:.3},{:.3},{:.3}) r={:.3}",
        i, xi, yi, zi, ai
    );
    println!(
        "  Seg {}: pos=({:.3},{:.3},{:.3}) r={:.3}",
        j, xj, yj, zj, aj
    );

    let (es_ij, ec_ij, ek_ij) = efld(xi, yi, zi, ai, j, false, &sim.context);
    let (es_ji, ec_ji, ek_ji) = efld(xj, yj, zj, aj, i, false, &sim.context);

    println!(
        "  efld(i, j) -> CONST.z = {:.4e} + j{:.4e}",
        ek_ij.z.re, ek_ij.z.im
    );
    println!(
        "  efld(j, i) -> CONST.z = {:.4e} + j{:.4e}",
        ek_ji.z.re, ek_ji.z.im
    );

    let diff = (ek_ij.z - ek_ji.z).norm();
    println!("  Diff: {:.4e}", diff);
    assert!(
        diff < 1e-10,
        "efld should be symmetric for identical segments on the same wire"
    );
}
