use crate::nec::common::Context;
use num_complex::Complex64;

use std::f64::consts::PI as PI_CONST;

// Struct to hold TMI global data from nec2c (Transfer impedance/Integration data?)
// Used in gf and intx
struct TmiData {
    ij: usize,
    zpk: f64,
    rkb2: f64,
}

/// Calculates the basis function for segment i.
/// This corresponds to `tbf` in nec2c.
pub fn tbf(i: usize, icap: usize, ctx: &mut Context) {
    // Porting tbf from calculations.c with explicit loops for clarity.
    // NEC2 uses Sine/Cosine expansion.
    // Basis function J (centered at i) extends to connected segments.

    // Reset jsno
    ctx.segj.jsno = 0;

    let mut pp = 0.0;
    let pm;

    let ix = i;

    // Ensure capacity
    if ctx.segj.ax.len() < 30 {
        ctx.segj.ax.resize(30, 0.0);
        ctx.segj.bx.resize(30, 0.0);
        ctx.segj.cx.resize(30, 0.0);
        ctx.segj.jco.resize(30, 0);
    }

    // ---------------------------------------------------------
    // Phase 1: Trace End 1 (Left Arm)
    // ---------------------------------------------------------

    // Start from End 1 of ix
    // To trace "Left", we leave End 1 of current segment.

    let mut jcox = ctx.geometry.icon1[ix];
    let mut sig = -1.0;
    let _jend = -1; // Legacy sign tracking if needed? No, explicit 'sig' is enough.

    let njun1;
    let mut loop_idx = 0;

    loop {
        if jcox == 0 {
            break;
        }
        if loop_idx > 100 {
            break;
        } // Safety
        loop_idx += 1;

        let next_seg_idx = (jcox.abs() - 1) as usize;
        let entered_end = if jcox < 0 { 1 } else { 2 };

        // Update orientation sign
        // NEC logic: flipper sig if entered end 2 (against coord).
        if entered_end == 2 {
            sig = -sig;
        }

        // Add to basis
        ctx.segj.jsno += 1;
        let jsnox = ctx.segj.jsno - 1;

        if jsnox >= ctx.segj.jco.len() {
            let new_len = jsnox + 10;
            ctx.segj.ax.resize(new_len, 0.0);
            ctx.segj.bx.resize(new_len, 0.0);
            ctx.segj.cx.resize(new_len, 0.0);
            ctx.segj.jco.resize(new_len, 0);
        }

        // Store jcox (connection info)
        ctx.segj.jco[jsnox] = jcox;

        // Compute coeffs
        let d = PI_CONST * ctx.geometry.si[next_seg_idx];
        let sdh = d.sin();
        let cdh = d.cos();
        let sd = 2.0 * sdh * cdh;

        let omc: f64;
        if d <= 0.015 {
            let omc_sq = 4.0 * d * d;
            omc = ((1.3888889e-3 * omc_sq - 4.1666666667e-2) * omc_sq + 0.5) * omc_sq;
        } else {
            omc = 1.0 - cdh * cdh + sdh * sdh;
        }

        let aj = 1.0 / ((1.0 / (PI_CONST * ctx.geometry.bi[next_seg_idx])).ln() - 0.577215664);
        pp = pp - omc / sd * aj;

        ctx.segj.ax[jsnox] = aj / sd * sig;
        ctx.segj.bx[jsnox] = aj / (2.0 * cdh);
        ctx.segj.cx[jsnox] = -aj / (2.0 * sdh) * sig;

        // Check loop-back to source
        if next_seg_idx == ix {
            ctx.segj.bx[jsnox] = -ctx.segj.bx[jsnox];
            break;
        }

        // Prepare next step
        // We entered 'entered_end'. Must leave 'opposite'.
        let leaving_end = if entered_end == 1 { 2 } else { 1 };

        if leaving_end == 1 {
            jcox = ctx.geometry.icon1[next_seg_idx];
        } else {
            jcox = ctx.geometry.icon2[next_seg_idx];
        }
    }

    njun1 = ctx.segj.jsno;
    pm = -pp; // Swap pp/pm for End 2 logic?
              // In original: "pm = -pp; pp = 0.0;"
              // Then calculate End 2.
              // NEC accumulates 'pp' for first branch.
              // Then moves it to 'pm' (minus?).
              // Then accumulates 'pp' for second branch (End 2).
    pp = 0.0;

    // ---------------------------------------------------------
    // Phase 2: Trace End 2 (Right Arm)
    // ---------------------------------------------------------

    jcox = ctx.geometry.icon2[ix];
    sig = 1.0; // Corrected to 1.0 to ensure Positive Ax (Symmetric Basis).
               // Original -1.0 led to Negative Ax for Right Arm (Asymmetry).

    loop_idx = 0;

    loop {
        if jcox == 0 {
            break;
        }
        if loop_idx > 100 {
            break;
        }
        loop_idx += 1;

        let next_seg_idx = (jcox.abs() - 1) as usize;
        let entered_end = if jcox < 0 { 1 } else { 2 };

        if entered_end == 2 {
            sig = -sig;
        }

        ctx.segj.jsno += 1;
        let jsnox = ctx.segj.jsno - 1;

        if jsnox >= ctx.segj.jco.len() {
            let new_len = jsnox + 10;
            ctx.segj.ax.resize(new_len, 0.0);
            ctx.segj.bx.resize(new_len, 0.0);
            ctx.segj.cx.resize(new_len, 0.0);
            ctx.segj.jco.resize(new_len, 0);
        }

        ctx.segj.jco[jsnox] = jcox;

        // Check for loop back immediately? No, after calc.

        let d = PI_CONST * ctx.geometry.si[next_seg_idx];
        let sdh = d.sin();
        let cdh = d.cos();
        let sd = 2.0 * sdh * cdh;

        let omc: f64;
        if d <= 0.015 {
            let omc_sq = 4.0 * d * d;
            omc = ((1.3888889e-3 * omc_sq - 4.1666666667e-2) * omc_sq + 0.5) * omc_sq;
        } else {
            omc = 1.0 - cdh * cdh + sdh * sdh;
        }

        let aj = 1.0 / ((1.0 / (PI_CONST * ctx.geometry.bi[next_seg_idx])).ln() - 0.577215664);
        pp = pp - omc / sd * aj;

        ctx.segj.ax[jsnox] = aj / sd * sig;
        ctx.segj.bx[jsnox] = aj / (2.0 * cdh);
        ctx.segj.cx[jsnox] = -aj / (2.0 * sdh) * sig;

        if next_seg_idx == ix {
            ctx.segj.bx[jsnox] = -ctx.segj.bx[jsnox];
            break;
        }

        let leaving_end = if entered_end == 1 { 2 } else { 1 };

        if leaving_end == 1 {
            jcox = ctx.geometry.icon1[next_seg_idx];
        } else {
            jcox = ctx.geometry.icon2[next_seg_idx];
        }
    }

    // ---------------------------------------------------------
    // Phase 3: Center Segment and Junction Normalization
    // ---------------------------------------------------------

    let njun2 = ctx.segj.jsno - njun1;
    let jsnop = ctx.segj.jsno;

    if jsnop >= ctx.segj.jco.len() {
        ctx.segj.jco.resize(jsnop + 10, 0);
        ctx.segj.ax.resize(jsnop + 10, 0.0);
        ctx.segj.bx.resize(jsnop + 10, 0.0);
        ctx.segj.cx.resize(jsnop + 10, 0.0);
    }

    // Add center segment
    // Note: Store as 1-based index
    ctx.segj.jco[jsnop] = (ix + 1) as i32;

    let d = PI_CONST * ctx.geometry.si[ix];
    let sdh = d.sin();
    let cdh = d.cos();
    let sd = 2.0 * sdh * cdh;
    let cd = cdh * cdh - sdh * sdh;

    let omc = if d <= 0.015 {
        let omc_sq = 4.0 * d * d;
        ((1.3888889e-3 * omc_sq - 4.1666666667e-2) * omc_sq + 0.5) * omc_sq
    } else {
        1.0 - cd
    };

    let ap = 1.0 / ((1.0 / (PI_CONST * ctx.geometry.bi[ix])).ln() - 0.577215664);
    let aj = ap;

    // Calculate qm, qp and normalize coeffs

    // Case 1: Open at start (njun1 == 0)
    if njun1 == 0 {
        if njun2 == 0 {
            // Isolated segment
            ctx.segj.bx[jsnop] = 0.0;
            let xxi = if icap == 0 {
                0.0
            } else {
                let qp_val = PI_CONST * ctx.geometry.bi[ix];
                let xxi_val = qp_val * qp_val;
                qp_val * (1.0 - 0.5 * xxi_val) / (1.0 - xxi_val)
            };

            ctx.segj.cx[jsnop] = 1.0 / (cdh - xxi * sdh);
            ctx.segj.jsno = jsnop + 1;
            ctx.segj.ax[jsnop] = -1.0;
            return;
        }

        let xxi = if icap == 0 {
            0.0
        } else {
            let qp_val = PI_CONST * ctx.geometry.bi[ix];
            let xxi_val = qp_val * qp_val;
            qp_val * (1.0 - 0.5 * xxi_val) / (1.0 - xxi_val)
        };

        let denom = sd * (ap + xxi * pp) + cd * (xxi * ap - pp);
        let qp = -(omc + xxi * sd) / denom;

        let d_val = cd - xxi * sd;
        ctx.segj.bx[jsnop] = (sdh + ap * qp * (cdh - xxi * sdh)) / d_val;
        ctx.segj.cx[jsnop] = (cdh + ap * qp * (sdh + xxi * cdh)) / d_val;

        for i_end in 0..njun2 {
            let idx = njun1 + i_end;
            ctx.segj.ax[idx] = -ctx.segj.ax[idx] * qp;
            ctx.segj.bx[idx] = ctx.segj.bx[idx] * qp;
            ctx.segj.cx[idx] = -ctx.segj.cx[idx] * qp;
        }

        ctx.segj.jsno = jsnop + 1;
        ctx.segj.ax[jsnop] = -1.0;
        return;
    }

    // Case 2: Open at end (njun2 == 0)
    if njun2 == 0 {
        let qm_val = PI_CONST * ctx.geometry.bi[ix];
        let xxi = qm_val * qm_val;
        let xxi_val = qm_val * (1.0 - 0.5 * xxi) / (1.0 - xxi);

        let denom = sd * (aj - xxi_val * pm) + cd * (pm + xxi_val * aj);
        let qm = (omc + xxi_val * sd) / denom;

        for i_start in 0..njun1 {
            ctx.segj.ax[i_start] = ctx.segj.ax[i_start] * qm;
            ctx.segj.bx[i_start] = ctx.segj.bx[i_start] * qm;
            ctx.segj.cx[i_start] = ctx.segj.cx[i_start] * qm;
        }

        ctx.segj.ax[jsnop] = -1.0;
        let d_val = cd - xxi_val * sd;
        ctx.segj.bx[jsnop] += (aj * qm * (cdh - xxi_val * sdh) - sdh) / d_val;
        ctx.segj.cx[jsnop] += (cdh - aj * qm * (sdh + xxi_val * cdh)) / d_val;
        ctx.segj.jsno = jsnop + 1;
        return;
    }

    // Case 3: Junction at both ends
    let qp_denom = sd * (pm * pp + aj * ap) + cd * (pm * ap - pp * aj);
    let qm = (ap * omc - pp * sd) / qp_denom;
    let qp = -(aj * omc + pm * sd) / qp_denom;

    for i_start in 0..njun1 {
        ctx.segj.ax[i_start] = ctx.segj.ax[i_start] * qm;
        ctx.segj.bx[i_start] = ctx.segj.bx[i_start] * qm;
        ctx.segj.cx[i_start] = ctx.segj.cx[i_start] * qm;
    }

    for i_end in 0..njun2 {
        let idx = njun1 + i_end;
        ctx.segj.ax[idx] = -ctx.segj.ax[idx] * qp;
        ctx.segj.bx[idx] = ctx.segj.bx[idx] * qp;
        ctx.segj.cx[idx] = -ctx.segj.cx[idx] * qp; // Note: -qp for end 2
    }

    ctx.segj.ax[jsnop] = -1.0;
    ctx.segj.bx[jsnop] = (aj * qm + ap * qp) * sdh / sd;
    ctx.segj.cx[jsnop] = (aj * qm - ap * qp) * cdh / sd;

    ctx.segj.jsno = jsnop + 1;
}

/// Computes the integrand exp(jkr)/(kr).
/// Corresponds to `gf` in calculations.c
fn gf(zk: f64, tmi: &TmiData) -> (f64, f64) {
    let zdk = zk - tmi.zpk;
    let rk = (tmi.rkb2 + zdk * zdk).sqrt();

    // To implement si = sin(rk)/rk, handle rk -> 0
    let si;
    if rk.abs() < 1e-12 {
        si = 1.0;
    } else {
        si = rk.sin() / rk;
    }

    let co;

    if tmi.ij != 0 {
        if rk.abs() < 1e-12 {
            co = 1.0 / rk; // Singular but handled physically by separation
        } else {
            co = rk.cos() / rk;
        }
        return (co, si);
    }

    if rk >= 0.2 {
        co = (rk.cos() - 1.0) / rk;
        return (co, si);
    }

    let rks = rk * rk;
    co = ((-1.38888889e-3 * rks + 4.16666667e-2) * rks - 0.5) * rk;

    (co, si)
}

/// Test for convergence in numerical integration
/// Corresponds to `test` in calculations.c
fn test_conv(f1r: f64, f2r: f64, f1i: f64, f2i: f64, dmin: f64) -> (f64, f64) {
    let den = f2r.abs().max(f2i.abs()).max(dmin);

    if den < 1.0e-37 {
        return (0.0, 0.0);
    }

    let tr = (f1r - f2r).abs() / den;
    let ti = (f1i - f2i).abs() / den;

    (tr, ti)
}

/// Performs numerical integration of exp(jkr)/r
/// Corresponds to `intx` in calculations.c
fn intx(el1: f64, el2: f64, b: f64, tmi: &TmiData) -> (f64, f64) {
    let nx = 1;
    let nma = 65536;
    let nts = 4;
    let rx = 1.0e-4;

    let mut z = el1;
    let mut ze = el2;
    if tmi.ij == 0 {
        ze = 0.0;
    }

    let s = ze - z;
    let ep = s / (10.0 * nma as f64);
    let zend = ze - ep;

    let mut sgr = 0.0;
    let mut sgi = 0.0;
    let mut ns = nx;
    let mut nt = 0;

    // Initial point
    let (mut g1r, mut g1i) = gf(z, tmi);

    // Romberg integration loop
    loop {
        // Step size
        let mut dz = s / (ns as f64);
        let mut zp = z + dz;

        if zp > ze {
            dz = ze - z;
            if dz.abs() <= ep {
                if tmi.ij == 0 {
                    let term = ((b * b + s * s).sqrt() + s) / b;
                    sgr = 2.0 * (sgr + term.ln());
                    sgi = 2.0 * sgi;
                }
                return (sgr, sgi);
            }
        }

        let dzot = dz * 0.5;
        zp = z + dzot;
        let (g3r, g3i) = gf(zp, tmi);
        zp = z + dz;
        let (g5r, g5i) = gf(zp, tmi);

        // 3-point Simpson/Romberg step
        let t00r = (g1r + g5r) * dzot;
        let t00i = (g1i + g5i) * dzot;
        let t01r = (t00r + dz * g3r) * 0.5;
        let t01i = (t00i + dz * g3i) * 0.5;
        let t10r = (4.0 * t01r - t00r) / 3.0;
        let t10i = (4.0 * t01i - t00i) / 3.0;

        let (te1r, te1i) = test_conv(t01r, t10r, t01i, t10i, 0.0);

        if te1i <= rx && te1r <= rx {
            sgr += t10r;
            sgi += t10i;
            nt += 2;
            z += dz;
            if z >= zend {
                if tmi.ij == 0 {
                    let term = ((b * b + s * s).sqrt() + s) / b;
                    sgr = 2.0 * (sgr + term.ln());
                    sgi = 2.0 * sgi;
                }
                return (sgr, sgi);
            }

            g1r = g5r;
            g1i = g5i;

            if nt >= nts && ns > nx {
                ns /= 2;
                nt = 1;
            }
            continue;
        }

        // 5-point step
        zp = z + dz * 0.25;
        let (g2r, g2i) = gf(zp, tmi);
        zp = z + dz * 0.75;
        let (g4r, g4i) = gf(zp, tmi);

        let t02r = (t01r + dzot * (g2r + g4r)) * 0.5;
        let t02i = (t01i + dzot * (g2i + g4i)) * 0.5;
        let t11r = (4.0 * t02r - t01r) / 3.0;
        let t11i = (4.0 * t02i - t01i) / 3.0;
        let t20r = (16.0 * t11r - t10r) / 15.0;
        let t20i = (16.0 * t11i - t10i) / 15.0;

        let (te2r, te2i) = test_conv(t11r, t20r, t11i, t20i, 0.0);

        if te2i > rx || te2r > rx {
            // failed convergence, halve step
            nt = 0;
            if ns >= nma {
                // Step size limited
            } else {
                ns *= 2;
                // Reuse nothing for simplicity, recompute in next iter
                continue;
            }
        }

        sgr += t20r;
        sgi += t20i;
        nt += 1;
        z += dz;

        if z >= zend {
            if tmi.ij == 0 {
                let term = ((b * b + s * s).sqrt() + s) / b;
                sgr = 2.0 * (sgr + term.ln());
                sgi = 2.0 * sgi;
            }
            return (sgr, sgi);
        }

        g1r = g5r;
        g1i = g5i;

        if nt >= nts && ns > nx {
            ns /= 2;
            nt = 1;
        }
    }
}

/// Segment end contributions for thin wire approx.
/// Corresponds to `gx`
fn gx(zz: f64, rh: f64, xk: f64) -> (Complex64, Complex64) {
    let r2 = zz * zz + rh * rh;
    let r = r2.sqrt();
    let rkz = xk * r;

    let gz = Complex64::new(rkz.cos(), -rkz.sin()) / r;
    let gzp = -Complex64::new(1.0, rkz) * gz / r2;

    (gz, gzp)
}

/// Segment end contributions for extended thin wire approx.
/// Corresponds to `gxx`
fn gxx(
    zz: f64,
    rh: f64,
    a: f64,
    a2: f64,
    xk: f64,
    ira: i32,
) -> (
    Complex64,
    Complex64,
    Complex64,
    Complex64,
    Complex64,
    Complex64,
) {
    let r2 = zz * zz + rh * rh;
    let r = r2.sqrt();
    let r4 = r2 * r2;
    let rk = xk * r;
    let rk2 = rk * rk;
    let rh2 = rh * rh;

    let t1 = 0.25 * a2 * rh2 / r4;
    let t2 = 0.5 * a2 / r2;

    let c1 = Complex64::new(1.0, rk);
    let c2 = 3.0 * c1 - rk2;
    let c3 = Complex64::new(6.0, rk) * rk2 - 15.0 * c1;

    let mut gz = Complex64::new(rk.cos(), -rk.sin()) / r;
    let mut g2 = gz * (1.0 + t1 * c2);
    let g1 = g2 - t2 * c1 * gz;

    gz = gz / r2;
    let mut g2p = gz * (t1 * c3 - c1);
    let mut gzp = t2 * c2 * gz;
    let mut g3 = g2p + gzp;
    let g1p = g3 * zz;

    if ira != 1 {
        g3 = (g3 + gzp) * rh;
        gzp = -zz * c1 * gz;

        if rh <= 1.0e-10 {
            g2 = Complex64::new(0.0, 0.0);
            g2p = Complex64::new(0.0, 0.0);
            return (g1, g1p, g2, g2p, g3, gzp);
        }

        g2 = g2 / rh;
        g2p = g2p * zz / rh;
        return (g1, g1p, g2, g2p, g3, gzp);
    }

    let t2_val = 0.5 * a;
    g2 = -t2_val * c1 * gz;
    g2p = t2_val * gz * c2 / r2;
    g3 = rh2 * g2p - a * gz * c1;
    g2p = g2p * zz;
    gzp = -zz * c1 * gz;

    (g1, g1p, g2, g2p, g3, gzp)
}

// Constants from nec2c.h
const CONST1: Complex64 = Complex64::new(0.0, 4.771341189);
// const CONST4: Complex64 = Complex64::new(0.0, 188.365);

/// Compute E-field of sine, cosine, and constant current filaments by thin wire approximation.
/// Returns (Ez_sine, Er_sine, Ez_cos, Er_cos, Ez_const, Er_const)
pub fn eksc(
    s: f64,
    z: f64,
    rh: f64,
    k: f64,
    ij: usize,
) -> (
    Complex64,
    Complex64,
    Complex64,
    Complex64,
    Complex64,
    Complex64,
) {
    let sh = 0.5 * s;
    let shk = k * sh;
    let ss = shk.sin();
    let cs = shk.cos();
    let z2a = sh - z;
    let z1a = -(sh + z);

    let (gz1, gp1) = gx(z1a, rh, k);
    let (gz2, gp2) = gx(z2a, rh, k);

    let gzp1 = gp1 * z1a;
    let gzp2 = gp2 * z2a;

    let ezs = CONST1 * ((gz2 - gz1) * cs * k - (gzp2 + gzp1) * ss);
    let ezc = -CONST1 * ((gz2 + gz1) * ss * k + (gzp2 - gzp1) * cs);
    let erk = CONST1 * (gp2 - gp1) * rh;

    // intx call
    let tmi = TmiData {
        ij,
        zpk: k * z,
        rkb2: (k * rh) * (k * rh),
    };
    let (cint, sint) = intx(-shk, shk, k * rh, &tmi);

    let ezk = -CONST1 * (gzp2 - gzp1 + k * k * Complex64::new(cint, -sint));

    // Recalculate gzp for ers/erc (based on C logic reassignment)
    let gzp1_val = gzp1 * z1a;
    let gzp2_val = gzp2 * z2a;

    let ers: Complex64;
    let erc: Complex64;

    if rh >= 1.0e-10 {
        ers = -CONST1 * ((gzp2_val + gzp1_val + gz2 + gz1) * ss - (z2a * gz2 - z1a * gz1) * cs * k)
            / rh;
        erc = -CONST1 * ((gzp2_val - gzp1_val + gz2 - gz1) * cs + (z2a * gz2 + z1a * gz1) * ss * k)
            / rh;
    } else {
        ers = Complex64::new(0.0, 0.0);
        erc = Complex64::new(0.0, 0.0);
    }

    (ezs, ers, ezc, erc, ezk, erk)
}

/// Compute e field by extended thin wire approximation.
/// Returns (Ez_sine, Er_sine, Ez_cos, Er_cos, Ez_const, Er_const)
fn ekscx(
    bx: f64,
    s: f64,
    z: f64,
    rhx: f64,
    k: f64,
    ij: usize,
    inx1: i32,
    inx2: i32,
) -> (
    Complex64,
    Complex64,
    Complex64,
    Complex64,
    Complex64,
    Complex64,
) {
    let rh;
    let b;
    let ira;

    if rhx >= bx {
        rh = rhx;
        b = bx;
        ira = 0;
    } else {
        rh = bx;
        b = rhx;
        ira = 1;
    }

    let sh = 0.5 * s;
    let shk = k * sh;
    let ss = shk.sin();
    let cs = shk.cos();
    let z2a = sh - z;
    let z1a = -(sh + z);
    let a2 = b * b;

    let gz1;
    let gzp1;
    let gr1;
    let grp1;
    let mut grk1;
    let gzz1;
    let gz2;
    let gzp2;
    let gr2;
    let grp2;
    let mut grk2;
    let gzz2;

    if inx1 != 2 {
        let res = gxx(z1a, rh, b, a2, k, ira);
        gz1 = res.0;
        gzp1 = res.1;
        gr1 = res.2;
        grp1 = res.3;
        grk1 = res.4;
        gzz1 = res.5;
    } else {
        let (gz, gzp) = gx(z1a, rhx, k);
        gz1 = gz;
        grk1 = gzp;
        gzp1 = grk1 * z1a;
        gr1 = gz1 / rhx;
        grp1 = gzp1 / rhx;
        grk1 = grk1 * rhx;
        gzz1 = Complex64::new(0.0, 0.0);
    }

    if inx2 != 2 {
        let res = gxx(z2a, rh, b, a2, k, ira);
        gz2 = res.0;
        gzp2 = res.1;
        gr2 = res.2;
        grp2 = res.3;
        grk2 = res.4;
        gzz2 = res.5;
    } else {
        let (gz, gzp) = gx(z2a, rhx, k);
        gz2 = gz;
        grk2 = gzp;
        gzp2 = grk2 * z2a;
        gr2 = gz2 / rhx;
        grp2 = gzp2 / rhx;
        grk2 = grk2 * rhx;
        gzz2 = Complex64::new(0.0, 0.0);
    }

    let ezs = CONST1 * ((gz2 - gz1) * cs * k - (gzp2 + gzp1) * ss);
    let ezc = -CONST1 * ((gz2 + gz1) * ss * k + (gzp2 - gzp1) * cs);
    let ers =
        -CONST1 * ((z2a * grp2 + z1a * grp1 + gr2 + gr1) * ss - (z2a * gr2 - z1a * gr1) * cs * k);
    let erc =
        -CONST1 * ((z2a * grp2 - z1a * grp1 + gr2 - gr1) * cs + (z2a * gr2 + z1a * gr1) * ss * k);
    let erk = CONST1 * (grk2 - grk1);

    let tmi = TmiData {
        ij,
        zpk: k * z,
        rkb2: (k * rh) * (k * rh),
    };
    let (cint, sint) = intx(-shk, shk, k * rh, &tmi);

    let bk = b * k;
    let bk2 = bk * bk * 0.25;
    let ezk = -CONST1
        * (gzp2 - gzp1 + k * k * (1.0 - bk2) * Complex64::new(cint, -sint) - bk2 * (gzz2 - gzz1));

    (ezs, ers, ezc, erc, ezk, erk)
}

/// Helper struct for 3D Complex vector
#[derive(Clone, Copy, Debug)]
pub struct CVec3 {
    pub x: Complex64,
    pub y: Complex64,
    pub z: Complex64,
}

impl CVec3 {
    pub fn new() -> Self {
        Self {
            x: Complex64::new(0.0, 0.0),
            y: Complex64::new(0.0, 0.0),
            z: Complex64::new(0.0, 0.0),
        }
    }
}

/// Electric field evaluation.
/// Corresponds to `efld` in fields.c
/// Returns full vector components: (E_Sine, E_Cosine, E_Constant)
pub fn efld(
    xi: f64,
    yi: f64,
    zi: f64,
    ai: f64,
    s_idx: usize,
    is_self: bool,
    ctx: &Context,
) -> (CVec3, CVec3, CVec3) {
    // Basic implementation of efld
    // Calculates field at (xi, yi, zi)

    // For now, support only free space (no ground)

    if s_idx >= ctx.geometry.n {
        return (CVec3::new(), CVec3::new(), CVec3::new());
    }

    // Load source segment geometry
    let xc = (ctx.geometry.x1[s_idx] + ctx.geometry.x2[s_idx]) * 0.5;
    let yc = (ctx.geometry.y1[s_idx] + ctx.geometry.y2[s_idx]) * 0.5;
    let zc = (ctx.geometry.z1[s_idx] + ctx.geometry.z2[s_idx]) * 0.5;
    let len_s = ctx.geometry.si[s_idx];
    let cabj = (ctx.geometry.x2[s_idx] - ctx.geometry.x1[s_idx]) / len_s;
    let sabj = (ctx.geometry.y2[s_idx] - ctx.geometry.y1[s_idx]) / len_s;
    let salpj = (ctx.geometry.z2[s_idx] - ctx.geometry.z1[s_idx]) / len_s;

    // Coordinate transformation to local system
    let xij = xi - xc;
    let yij = yi - yc;
    let zij = zi - zc;

    let zp = xij * cabj + yij * sabj + zij * salpj;
    let mut rhox = xij - cabj * zp;
    let mut rhoy = yij - sabj * zp;
    let mut rhoz = zij - salpj * zp;
    let rh = (rhox * rhox + rhoy * rhoy + rhoz * rhoz + ai * ai).sqrt();

    if rh > 1.0e-10 {
        rhox = rhox / rh;
        rhoy = rhoy / rh;
        rhoz = rhoz / rh;
    } else {
        rhox = 0.0;
        rhoy = 0.0;
        rhoz = 0.0;
    }

    // Call eksc or ekscx
    let k = 2.0 * PI_CONST;
    let radius_s = ctx.geometry.bi[s_idx];

    // Determine flag for eksc/intx (0 means singular/self)
    let ij_flag = if is_self { 0 } else { 1 };

    // For now always use eksc unless extremely close
    let use_extended = false; // logic checks ind1/ind2 etc.

    let (tezs, ters, tezc, terc, tezk, terk) = if !use_extended {
        eksc(len_s, zp, rh, k, ij_flag)
    } else {
        let inx1 = 0;
        let inx2 = 0;
        ekscx(radius_s, len_s, zp, rh, k, ij_flag, inx1, inx2)
    };

    // Transform to cartesian components (Free Space)
    // txs = tezs * cabj + ters * rhox
    let mut es = CVec3::new();
    es.x = tezs * cabj + ters * rhox;
    es.y = tezs * sabj + ters * rhoy;
    es.z = tezs * salpj + ters * rhoz;

    let mut ek = CVec3::new();
    ek.x = tezk * cabj + terk * rhox;
    ek.y = tezk * sabj + terk * rhoy;
    ek.z = tezk * salpj + terk * rhoz;

    let mut ec = CVec3::new();
    ec.x = tezc * cabj + terc * rhox;
    ec.y = tezc * sabj + terc * rhoy;
    ec.z = tezc * salpj + terc * rhoz;

    (es, ec, ek)
}
