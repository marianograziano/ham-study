use antenna::nec::simulation::NecSimulation;
use std::f64::consts::PI;

#[test]
fn yagi_430mhz_far_field_debug() {
    let mut sim = NecSimulation::new();
    sim.initialize(3);
    sim.set_frequency(430.0);

    // 430 MHz, λ = 0.697m
    // Reflector (Tag 1): 0.50λ = 0.349m total, at x = -0.139
    sim.add_wire(-0.139, 0.0, -0.174, -0.139, 0.0, 0.174, 0.003, 11, 1);
    // Driven (Tag 2): 0.47λ = 0.328m total, at x = 0
    sim.add_wire(0.0, 0.0, -0.164, 0.0, 0.0, 0.164, 0.003, 11, 2);
    // Director (Tag 3): 0.44λ = 0.307m total, at x = 0.105
    sim.add_wire(0.105, 0.0, -0.153, 0.105, 0.0, 0.153, 0.003, 11, 3);

    sim.add_voltage_source(2, 6, 1.0, 0.0);
    sim.calculate().unwrap();

    // 1. Dump current distribution
    let n = sim.context.geometry.n;
    println!("\n=== Current Distribution ({} segments) ===", n);
    println!(
        "  Lambda = {:.4}m, k = {:.4}",
        sim.context.geometry.wlam,
        2.0 * PI / sim.context.geometry.wlam
    );

    for i in 0..n {
        let cur = sim.context.current.cur[i];
        let tag = sim.context.geometry.itag[i];
        let x = sim.context.geometry.x[i];
        let z = sim.context.geometry.z[i];
        let si = sim.context.geometry.si[i];
        println!(
            "  seg[{:2}] tag={} x={:+.4} z={:+.4} len={:.5} |I|={:.6} phase={:+.1}°",
            i,
            tag,
            x,
            z,
            si,
            cur.norm(),
            cur.arg().to_degrees()
        );
    }

    // 2. Far-field in XZ plane (theta=0, varying phi = azimuth)
    println!("\n=== Far Field: XZ plane (theta=0, phi varies) ===");
    let mut max_gain = 0.0f64;
    let mut gains = Vec::new();
    for deg in (0..360).step_by(15) {
        let phi = (deg as f64) * PI / 180.0;
        let theta = 0.0;
        let gain = sim.calculate_far_field(theta, phi, 1000.0);
        gains.push((deg, gain));
        if gain > max_gain {
            max_gain = gain;
        }
    }
    for (deg, gain) in &gains {
        let norm = if max_gain > 0.0 { gain / max_gain } else { 0.0 };
        let bar: String = std::iter::repeat('█')
            .take((norm * 40.0) as usize)
            .collect();
        println!("  {:3}°: gain={:.6} norm={:.3} | {}", deg, gain, norm, bar);
    }
    let fwd = gains.iter().find(|(d, _)| *d == 0).unwrap().1;
    let bwd = gains.iter().find(|(d, _)| *d == 180).unwrap().1;
    println!(
        "  Max: {:.6}, F/B: {:.2} ({:.1} dB)",
        max_gain,
        fwd / bwd.max(1e-10),
        20.0 * (fwd / bwd.max(1e-10)).log10()
    );

    // 3. Far-field in XY plane (phi=0, varying theta = elevation)
    println!("\n=== Far Field: XY plane (phi=0, theta varies) ===");
    let mut max_gain2 = 0.0f64;
    let mut gains2 = Vec::new();
    for deg in (-90..=90).step_by(15) {
        let theta = (deg as f64) * PI / 180.0;
        let phi = 0.0;
        let gain = sim.calculate_far_field(theta, phi, 1000.0);
        gains2.push((deg, gain));
        if gain > max_gain2 {
            max_gain2 = gain;
        }
    }
    for (deg, gain) in &gains2 {
        let norm = if max_gain2 > 0.0 {
            gain / max_gain2
        } else {
            0.0
        };
        let bar: String = std::iter::repeat('█')
            .take((norm * 40.0) as usize)
            .collect();
        println!(
            "  {:+4}° elev: gain={:.6} norm={:.3} | {}",
            deg, gain, norm, bar
        );
    }
}
