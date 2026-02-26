use crate::nec::common::Context;
use num_complex::Complex64;

pub struct Solver {
    pub matrix: Vec<Complex64>,
    pub ip: Vec<usize>, // Pivot indices
    pub nrow: usize,
    pub ncol: usize,
}

impl Solver {
    pub fn new(n: usize) -> Self {
        Self {
            matrix: vec![Complex64::new(0.0, 0.0); n * n],
            ip: vec![0; n],
            nrow: n,
            ncol: n,
        }
    }

    // Column-major indexing: M[row, col] = matrix[row + col * nrow]
    // Helper not needed if we compute inline to avoid borrow issues
    // fn idx(&self, row: usize, col: usize) -> usize {
    //    row + col * self.nrow
    // }

    /// Factor a matrix into a unit lower triangular matrix and an upper triangular matrix
    /// using the Gauss-Doolittle algorithm.
    /// Corresponds to `factr` in matrix.c
    /// Note: `matrix.c` comments say "matrix transposed", checking implementation it uses column-major.
    pub fn factor(&mut self) -> Result<(), String> {
        let n = self.nrow;
        if n == 0 {
            return Ok(());
        }

        let mut iflg = false;

        // In the C code, they allocate a scratch array `scm`.
        // We can use a Vec.
        let mut col_k_cache = vec![Complex64::new(0.0, 0.0); n];

        // Note: The C code loops r=0 to n.
        for r in 0..n {
            // Step 1: Copy column r to scratch (conceptually).
            // Actually C code copies a[k + r*ndim]. r is second index, so it is column r.
            // But wait, earlier analysis said column major.
            // C code: scm[k] = a[k+r*ndim]; -> k varies effectively. r is fixed.
            // This copies column r.
            for k in 0..n {
                col_k_cache[k] = self.matrix[k + r * n];
            }

            // Steps 2 and 3: Apply previous transformations to this column
            let rm1 = r; // Rust ranges simplify this
            if rm1 > 0 {
                // For j < r
                for j in 0..rm1 {
                    // Pivot index from previous step
                    let pj = self.ip[j]; // 0-based index? C code: ip[j]-1. We store 0-based.
                    let arj = col_k_cache[pj];

                    // Update matrix element (U part stored in place?)
                    self.matrix[j + r * n] = arj;

                    // Update scratch column (L part calculation?)
                    // scm[pj] = scm[j]; // logic from C
                    // Let's trace carefully.
                    // C code:
                    // pj = ip[j]-1;
                    // arj = scm[pj];
                    // a[j+r*ndim] = arj;
                    // scm[pj] = scm[j];
                    // jp1 = j+1;
                    // for i = jp1; i < n; i++ { scm[i] -= a[i+j*ndim] * arj; }

                    col_k_cache[pj] = col_k_cache[j];

                    for i in (j + 1)..n {
                        let a_ij = self.matrix[i + j * n]; // Column j, Row i.
                        col_k_cache[i] = col_k_cache[i] - a_ij * arj;
                    }
                }
            }

            // Step 4: Find pivot
            // dmax = magnitude of diagonal element candidate
            let mut dmax = col_k_cache[r].norm_sqr();
            let mut pivot_row = r;

            // Search below diagonal
            for i in (r + 1)..n {
                let mag = col_k_cache[i].norm_sqr();
                if mag >= dmax {
                    dmax = mag;
                    pivot_row = i;
                }
            }

            if dmax < 1.0e-20 {
                // 1.e-10 squared? C code says 1.e-10 but compares with magnitude squared?
                // C code: elmag= creal( scm[i]* conj(scm[i]) ); -> real part of z * z_conj = |z|^2
                // C code check: if( dmax < 1.e-10) iflg=TRUE;
                // So checking squared magnitude against 1e-10.
                iflg = true;
            }

            self.ip[r] = pivot_row;

            // Swap pivot to diagonal position in scratch
            let pr = pivot_row;
            self.matrix[r + r * n] = col_k_cache[pr];
            col_k_cache[pr] = col_k_cache[r];

            // Step 5: Divide by pivot
            if r + 1 < n {
                let diag = self.matrix[r + r * n];
                if diag.norm_sqr() < 1e-40 {
                    return Err("Zero pivot encountered".to_string());
                }
                let inv_diag = Complex64::new(1.0, 0.0) / diag;

                for i in (r + 1)..n {
                    self.matrix[i + r * n] = col_k_cache[i] * inv_diag;
                }
            }
        }

        if iflg {
            // In C code this just prints a warning.
            // We'll log it or ignore for now, not a hard error.
        }

        Ok(())
    }

    /// Solves the system LU * x = b.
    /// b is replaced by the solution.
    /// Corresponds to `solve` in matrix.c
    pub fn solve(&self, b: &mut [Complex64]) {
        let n = self.nrow;
        let mut scm = vec![Complex64::new(0.0, 0.0); n];

        // Forward substitution (Ly = b)
        for i in 0..n {
            let pia = self.ip[i]; // Pivot row from factor step
            scm[i] = b[pia];
            b[pia] = b[i]; // Swap

            for j in (i + 1)..n {
                // b[j] -= A[j, i] * scm[i]
                b[j] = b[j] - self.matrix[j + i * n] * scm[i];
            }
        }

        // Backward substitution (Ux = y)
        for k in 0..n {
            let i = n - 1 - k;
            let mut sum = Complex64::new(0.0, 0.0);

            for j in (i + 1)..n {
                sum = sum + self.matrix[i + j * n] * b[j];
            }

            b[i] = (scm[i] - sum) / self.matrix[i + i * n];
        }
    }

    /// Fills the interaction matrix for wire-wire interactions.
    /// This corresponds to `cmss`, `cmsw`, `cmws`, `cmww` logic combined for wire-only.
    pub fn fill_matrix_wire_wire(&mut self, ctx: &mut Context) {
        let n = self.nrow;

        // Loop over source basis functions (Columns j)
        for j in 0..n {
            // Calculate basis function coefficients for column j
            // Output stored in ctx.segj
            crate::nec::physics::tbf(j, 1, ctx);

            // Loop over observation segments (Rows i)
            for i in 0..n {
                let mut sum_term = Complex64::new(0.0, 0.0);

                let xi = ctx.geometry.x[i];
                let yi = ctx.geometry.y[i];
                let zi = ctx.geometry.z[i];
                let ai = ctx.geometry.bi[i];
                let cabi = ctx.geometry.cab[i];
                let sabi = ctx.geometry.sab[i];
                let salpi = ctx.geometry.salp[i];

                // Sum contributions from segments supporting basis function j
                for k in 0..ctx.segj.jsno {
                    // Segment index from jco (1-based, signed)
                    let jx_raw = ctx.segj.jco[k];
                    let ssnx = if jx_raw < 0 { -1.0 } else { 1.0 };
                    let jx = (jx_raw.abs() - 1) as usize;

                    // Calculate field at i due to segment jx
                    // Pass is_self = (i == jx)
                    use crate::nec::physics::efld;
                    let (es, ec, ek) = efld(xi, yi, zi, ai, jx, i == jx, ctx);

                    // Project field onto segment i orientation
                    let etk = ek.x * cabi + ek.y * sabi + ek.z * salpi;
                    let ets = es.x * cabi + es.y * sabi + es.z * salpi;
                    let etc = ec.x * cabi + ec.y * sabi + ec.z * salpi;

                    // Accumulate weighted by basis function coeff
                    let term = etk * ctx.segj.ax[k] * ssnx
                        + ets * ctx.segj.bx[k]
                        + etc * ctx.segj.cx[k] * ssnx;

                    sum_term = sum_term + term;
                }

                // Store in column-major matrix
                // matrix[row + col * nrow]
                self.matrix[i + j * n] = sum_term;
            }
        }
    }

    /// Fills the excitation vector (RHS) for voltage sources.
    /// Corresponds to `etmns` logic for voltage sources (ipr=0).
    pub fn fill_excitation(&self, ctx: &Context, rhs: &mut [Complex64]) {
        // Clear rhs
        for x in rhs.iter_mut() {
            *x = Complex64::new(0.0, 0.0);
        }

        // Fill from voltage sources
        for i in 0..ctx.vsorc.nsant {
            if i >= ctx.vsorc.isant.len() || i >= ctx.vsorc.vsant.len() {
                continue;
            }

            let seg_idx = ctx.vsorc.isant[i]; // 0-based index assumed in our storage
            let volt = ctx.vsorc.vsant[i];

            if seg_idx < rhs.len() {
                // NEC2C: e[is]= -vsorc.vsant[i]/( data.si[is]* data.wlam);
                // We assume stored vsant is already complex if needed, or V + j0.

                let len = ctx.geometry.si[seg_idx];
                let wlam = ctx.geometry.wlam;

                if wlam.abs() > 1e-20 && len.abs() > 1e-20 {
                    rhs[seg_idx] = -volt / (len * wlam);
                }
            }
        }
    }
}
