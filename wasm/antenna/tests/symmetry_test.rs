use antenna::nec::simulation::NecSimulation;
use antenna::nec::solver::Solver;

#[test]
fn test_matrix_filling_symmetry() {
    let mut sim = NecSimulation::new();
    sim.initialize(1);
    sim.set_frequency(300.0); // Lambda = 1.0m
                              // 5 segments (odd number)
    sim.add_wire(0.0, 0.0, -0.25, 0.0, 0.0, 0.25, 0.001, 5, 1);

    // CRITICAL: Must set wlam before connect(), so si/bi get normalized to wavelength units
    sim.context.geometry.wlam = 299.792458 / 300.0; // ~1.0 m
                                                    // CRITICAL: Must connect geometry to initialize icon1/icon2 arrays!
    sim.context.geometry.connect(0);

    let n = sim.context.geometry.n;
    assert_eq!(n, 5);

    // Manually initialize solver and fill matrix
    sim.solver = Solver::new(n);
    sim.solver.fill_matrix_wire_wire(&mut sim.context);

    println!("=== Matrix Symmetry Check (Before Factor) ===");
    println!("  Lambda (wlam) = {:.4}", sim.context.geometry.wlam);

    let mut max_diff = 0.0;
    for i in 0..n {
        for j in 0..n {
            let val_ij = sim.solver.matrix[i + j * n];
            let val_ji = sim.solver.matrix[j + i * n];
            let diff = (val_ij - val_ji).norm();
            if diff > max_diff {
                max_diff = diff;
            }
        }
    }

    // Print the matrix for inspection
    for i in 0..n {
        for j in 0..n {
            let val_ij = sim.solver.matrix[i + j * n];
            print!("({:.2e} + j{:.2e}) ", val_ij.re, val_ij.im);
        }
        println!();
    }

    println!("Max asymmetry: {:.4e}", max_diff);

    // For a single straight wire, the interaction matrix MUST be symmetric.
    assert!(
        max_diff < 1e-10,
        "Matrix should be symmetric for this simple dipole. Max diff was {:.4e}",
        max_diff
    );
}
