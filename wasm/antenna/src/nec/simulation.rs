use crate::nec::common::Context;
use crate::nec::solver::Solver;
use num_complex::Complex64;
use std::f64::consts::PI as PI_CONST;

pub struct NecSimulation {
    pub context: Context,
    pub solver: Solver,
    pub frequency_mhz: f64,
    /// Height above perfectly conducting ground in wavelengths.
    /// If None, simulation is in free space.
    pub ground_height: Option<f64>,
}

impl NecSimulation {
    pub fn new() -> Self {
        Self {
            context: Context::new(),
            solver: Solver::new(0),
            frequency_mhz: 300.0, // Default to something reasonable
            ground_height: None,
        }
    }

    /// Set ground height in wavelengths (None for free space)
    pub fn set_ground(&mut self, height: Option<f64>) {
        self.ground_height = height;
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

        // Since frontend uses:
        // thetas.push(Math.asin(vertex.y)); // Elevation from XZ plane, Y is UP
        // phis.push(Math.atan2(vertex.z, vertex.x)); // Azimuth in XZ plane
        //
        // This means the observer vector (rx, ry, rz) is:
        // rx = cos(theta) * cos(phi)
        // ry = sin(theta)
        // rz = cos(theta) * sin(phi)

        let cost = theta.cos();
        let sint = theta.sin();
        let cosp = phi.cos();
        let sinp = phi.sin();

        let rx = cost * cosp;
        let ry = sint;
        let rz = cost * sinp;

        for i in 0..self.context.geometry.n {
            let cur = self.context.current.cur[i];
            let len = self.context.geometry.si[i];

            let xi = self.context.geometry.x[i];
            let yi = self.context.geometry.y[i];
            let zi = self.context.geometry.z[i];

            // Phase factor relative to origin: exp(j * k * (r . r'))
            // r . r' = xi * rx + yi * ry + zi * rz
            let phase_arg = k * (xi * rx + yi * ry + zi * rz);
            let phase = Complex64::new(phase_arg.cos(), phase_arg.sin());

            // Element pattern (short dipole approx or point source)
            let sx = (self.context.geometry.x2[i] - self.context.geometry.x1[i]) / len;
            let sy = (self.context.geometry.y2[i] - self.context.geometry.y1[i]) / len;
            let sz = (self.context.geometry.z2[i] - self.context.geometry.z1[i]) / len;

            // Theta unit vector (derivative of position vector with respect to theta)
            let th_x = -sint * cosp;
            let th_y = cost;
            let th_z = -sint * sinp;

            // Phi unit vector (derivative of position vector with respect to phi, normalized)
            let ph_x = -sinp;
            let ph_y = 0.0;
            let ph_z = cosp;

            let dot_th = sx * th_x + sy * th_y + sz * th_z;
            let dot_ph = sx * ph_x + sy * ph_y + sz * ph_z;

            // Moment of the primary element
            let moment = cur * len * phase;
            e_theta += moment * dot_th;
            e_phi += moment * dot_ph;

            // Ground Image processing
            if let Some(height_lambda) = self.ground_height {
                // If the ground is at Y = -height (assuming antenna is around Y=0)
                // Actually the standard orientation has the ground at Z=-height or Y=-height.
                // In our Three.js, Y is UP. So ground is at Y = -height.
                // The image source is at y_image = -yi - 2*height
                // Wait, if antenna is placed AT Y=0, and ground parameter is the height of antenna,
                // then the ground plane is at Y = -height. The image of a point (xi, yi, zi)
                // across the plane Y = -height is (xi, -yi - 2*height, zi).
                let height_meters = height_lambda * self.context.geometry.wlam;
                let y_image = -yi - 2.0 * height_meters;

                // Reflection coefficient for perfect ground.
                // Horizontal polarization (parallel to ground): reflected E is inverted (reflection coeff = -1)
                // Vertical polarization (normal to ground): reflected E is the same (reflection coeff = +1)

                // Let's break the segment vector into horizontal and vertical parts.
                // The horizontal part (X, Z) reflects and flips: sx_img = -sx, sz_img = -sz, sy_img = sy
                // Wait, the current direction in a mirrored image:
                // For a horizontally oriented wire (sx, 0, sz), the image current is perfectly opposite (-sx, 0, -sz)
                // For a vertically oriented wire (0, sy, 0), the image current points the SAME way (0, sy, 0)
                // So image segment vector is (-sx, sy, -sz).
                let sx_img = -sx;
                let sy_img = sy;
                let sz_img = -sz;

                let phase_arg_img = k * (xi * rx + y_image * ry + zi * rz);
                let phase_img = Complex64::new(phase_arg_img.cos(), phase_arg_img.sin());

                let dot_th_img = sx_img * th_x + sy_img * th_y + sz_img * th_z;
                let dot_ph_img = sx_img * ph_x + sy_img * ph_y + sz_img * ph_z;

                let moment_img = cur * len * phase_img;
                e_theta += moment_img * dot_th_img;
                e_phi += moment_img * dot_ph_img;
            }
        }

        let mag2 = e_theta.norm_sqr() + e_phi.norm_sqr();
        mag2.sqrt()
    }

    /// Get total current (complex) on a specific segment
    pub fn get_current(&self, index: usize) -> Complex64 {
        if index < self.context.current.cur.len() {
            self.context.current.cur[index]
        } else {
            Complex64::new(0.0, 0.0)
        }
    }

    /// Calculate Input Impedance for a source with a given tag.
    /// Returns Some(Z) if source found and current is non-zero.
    pub fn get_input_impedance(&self, tag: i32) -> Option<Complex64> {
        // Iterate over all voltage sources
        for (i, &seg_idx) in self.context.vsorc.isant.iter().enumerate() {
            // Check if this segment belongs to a wire with the requested tag
            if seg_idx < self.context.geometry.itag.len() {
                if self.context.geometry.itag[seg_idx] == tag {
                    // Found the source
                    let voltage = self.context.vsorc.vsant[i];
                    let current = self.context.current.cur[seg_idx];

                    if current.norm_sqr() > 1e-20 {
                        return Some(voltage / current);
                    } else {
                        return None; // Simulation not run or open circuit
                    }
                }
            }
        }
        None
    }
}
