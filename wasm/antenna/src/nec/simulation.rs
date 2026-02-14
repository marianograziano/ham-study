use crate::nec::common::Context;
use crate::nec::solver::Solver;
use num_complex::Complex64;
use std::f64::consts::PI as PI_CONST;

pub struct NecSimulation {
    pub context: Context,
    pub solver: Solver,
    pub frequency_mhz: f64,
}

impl NecSimulation {
    pub fn new() -> Self {
        Self {
            context: Context::new(),
            solver: Solver::new(0),
            frequency_mhz: 300.0, // Default to something reasonable
        }
    }

    /// Initialize the simulation with a defined number of wires.
    /// This pre-allocates structures.
    pub fn initialize(&mut self, _num_wires: usize) {
        self.context.geometry.n = 0;
        self.context.geometry.m = 0;
        self.context.geometry.np = 0;
        self.context.geometry.mp = 0;

        // Reset vectors
        self.context.geometry.x1.clear();
        self.context.geometry.y1.clear();
        self.context.geometry.z1.clear();
        self.context.geometry.x2.clear();
        self.context.geometry.y2.clear();
        self.context.geometry.z2.clear();
        self.context.geometry.bi.clear();
        self.context.geometry.itag.clear();

        // Initialize solver with expected size
        // Note: geometry.wire() adds segments, so actual N might be > num_wires if segments > 1 per wire.
        // For now, we defer solver strict sizing until calculate().
    }

    /// Add a wire to the geometry.
    ///
    /// # Arguments
    /// * `x1, y1, z1` - Start coordinate
    /// * `x2, y2, z2` - End coordinate
    /// * `radius` - Wire radius
    /// * `segments` - Number of segments this wire is divided into
    /// * `tag` - Tag ID for this wire
    pub fn add_wire(
        &mut self,
        x1: f64,
        y1: f64,
        z1: f64,
        x2: f64,
        y2: f64,
        z2: f64,
        radius: f64,
        segments: usize,
        tag: i32,
    ) {
        self.context.geometry.wire(
            x1, y1, z1, x2, y2, z2, radius, 1.0, 1.0, // Uniform segmentation
            segments, tag,
        );
    }

    pub fn set_frequency(&mut self, mhz: f64) {
        self.frequency_mhz = mhz;
        let lambda = 299.792458 / mhz;
        self.context.geometry.wlam = lambda;
    }

    /// Add a voltage source to a specific segment.
    ///
    /// # Arguments
    /// * `tag` - Wire tag to place source on
    /// * `seg_on_wire` - Segment index relative to wire start (1-based usually in NEC inputs)
    /// * `real` - Real part of voltage
    /// * `imag` - Imaginary part of voltage
    pub fn add_voltage_source(&mut self, tag: i32, seg_on_wire: usize, real: f64, imag: f64) {
        // Find absolute segment index for (tag, seg_on_wire)
        // NEC2 indexing is global. We need to map tag -> segment range.

        // Simple search for now:
        // let mut current_idx = 0;
        let mut found_idx = None;

        // We lack a direct tag->range map in Geometry currently.
        // But we store tags in `itag`.
        // We need to iterate segments to find the nth segment with this tag.

        let mut seg_count_for_tag = 0;
        for (i, &t) in self.context.geometry.itag.iter().enumerate() {
            if t == tag {
                seg_count_for_tag += 1;
                if seg_count_for_tag == seg_on_wire {
                    found_idx = Some(i);
                    break;
                }
            }
        }

        if let Some(idx) = found_idx {
            self.context.vsorc.nsant += 1;
            self.context.vsorc.isant.push(idx);
            self.context.vsorc.vsant.push(Complex64::new(real, imag));
        } else {
            // Log error or ignore?
            // println!("Warning: Could not find segment for source at tag {}, seg {}", tag, seg_on_wire);
        }
    }

    /// Run the simulation.
    pub fn calculate(&mut self) -> Result<(), String> {
        let n = self.context.geometry.n;
        if n == 0 {
            return Err("No geometry defined".to_string());
        }

        // 1. Connectivity
        self.context.geometry.connect(0); // 0 = free space (no ground for now)

        // 2. Initialize Solver
        // If solver size assumes N, finalize it.
        if self.solver.nrow != n {
            self.solver = Solver::new(n);
        }

        // 3. Fill Matrix (Interaction)
        // Only Wire-Wire supported for now
        self.solver.fill_matrix_wire_wire(&mut self.context);

        // 4. Factor Matrix (LU Decomp)
        self.solver.factor()?;

        // 5. Fill Excitation (Voltage sources)
        let mut rhs = vec![Complex64::new(0.0, 0.0); n];
        self.solver.fill_excitation(&self.context, &mut rhs);

        // 6. Solve
        self.solver.solve(&mut rhs);

        // 7. Store currents
        // rhs now holds the solution (currents)
        self.context.current.cur = rhs;

        Ok(())
    }

    /// Calculate radiation pattern at specific angles.
    /// Returns gain in dBi? Or simple field magnitude?
    /// NEC2 `fld` calculation.
    ///
    /// For simplistic Yagi verification:
    /// Calculate E-field at large distance R.
    pub fn calculate_far_field(&self, theta: f64, phi: f64, _r_dist: f64) -> f64 {
        // Using `efld` or specialized far-field routine?
        // `efld` is for near field mostly.
        // `ffld` is usually used for far field patterns.

        // Let's implement a basic far-field summation here as `ffld` is not ported yet.
        // E = Sum( I_j * Field_Factor_j )

        let k = 2.0 * PI_CONST / self.context.geometry.wlam;
        // Actually `efld` expects `k` to be handled via `tbf`/geometry interactions.
        // But for far field:
        // E ~ Sum [ I_j * exp(j * k * r_j) * vector_orientation ]

        // Simplified implementation for verification:
        // Sum contributions of all segments.

        let mut e_theta = Complex64::new(0.0, 0.0);
        let mut e_phi = Complex64::new(0.0, 0.0);

        let cost = theta.cos();
        let sint = theta.sin();
        let cosp = phi.cos();
        let sinp = phi.sin();

        // Radial vector to observer:
        // rx = sint * cosp
        // ry = sint * sinp
        // rz = cost

        for i in 0..self.context.geometry.n {
            let cur = self.context.current.cur[i];
            let len = self.context.geometry.si[i];

            let xi = self.context.geometry.x[i];
            let yi = self.context.geometry.y[i];
            let zi = self.context.geometry.z[i];

            // Phase factor relative to origin: exp(j * k * (r . r'))
            // r . r' = xi * rx + yi * ry + zi * rz
            let phase_arg = k * (xi * sint * cosp + yi * sint * sinp + zi * cost);
            let phase = Complex64::new(phase_arg.cos(), phase_arg.sin());

            // Element pattern (short dipole approx or point source)
            // Project segment vector onto Theta/Phi unit vectors.
            // Segment vector s:
            // sx = cab * L (wait cab = cos(alpha)*cos(beta)?)
            // x2-x1/L
            let sx = (self.context.geometry.x2[i] - self.context.geometry.x1[i]) / len;
            let sy = (self.context.geometry.y2[i] - self.context.geometry.y1[i]) / len;
            let sz = (self.context.geometry.z2[i] - self.context.geometry.z1[i]) / len;

            // Theta unit vector: (cost cosp, cost sinp, -sint)
            let th_x = cost * cosp;
            let th_y = cost * sinp;
            let th_z = -sint;

            // Phi unit vector: (-sinp, cosp, 0)
            let ph_x = -sinp;
            let ph_y = cosp;
            let ph_z = 0.0;

            let dot_th = sx * th_x + sy * th_y + sz * th_z;
            let dot_ph = sx * ph_x + sy * ph_y + sz * ph_z;

            // Contribution: I * L * phase * dot
            // (Far field of short dipole ~ I * L * sin(angle_between_wire_and_r))
            // Actually E_theta ~ dot_th, E_phi ~ dot_ph
            // Factor j * eta * k / (4 pi r) * exp(-jkr) is common factor.
            // We return normalized field or gain.

            // Using current * length as moment
            let moment = cur * len * phase;
            e_theta = e_theta + moment * dot_th;
            e_phi = e_phi + moment * dot_ph;
        }

        let mag2 = e_theta.norm_sqr() + e_phi.norm_sqr();
        mag2.sqrt()
    }
}
