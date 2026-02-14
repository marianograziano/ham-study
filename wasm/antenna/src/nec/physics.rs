use crate::nec::common::{Context, PCHCON, PI};
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
    // Porting tbf from calculations.c
    // Note: nec2c uses 1-based indexing for i, we use 0-based.

    // Reset jsno
    ctx.segj.jsno = 0;

    let mut pp = 0.0;
    let mut pm = 0.0;

    let ix = i;

    // jcox= data.icon1[ix];
    let mut jcox = ctx.geometry.icon1[ix];

    if jcox > PCHCON as i32 {
        jcox = (ix + 1) as i32;
    }

    let mut jend = -1;
    let mut iend = -1;
    let mut sig = -1.0;

    // Ensure capacity
    if ctx.segj.ax.len() < 30 {
        ctx.segj.ax.resize(30, 0.0);
        ctx.segj.bx.resize(30, 0.0);
        ctx.segj.cx.resize(30, 0.0);
        ctx.segj.jco.resize(30, 0);
    }

    let mut njun1 = 0;

    // First loop: connection at end 1
    loop {
        if jcox != 0 {
            if jcox < 0 {
                jcox = -jcox;
            } else {
                sig = -sig;
                jend = -jend;
            }

            let jcoxx = (jcox - 1) as usize; // 0-based index of current segment in loop
            ctx.segj.jsno += 1;
            let jsnox = ctx.segj.jsno - 1;

            // Ensure capacity
            if jsnox >= ctx.segj.jco.len() {
                let new_len = jsnox + 10;
                ctx.segj.ax.resize(new_len, 0.0);
                ctx.segj.bx.resize(new_len, 0.0);
                ctx.segj.cx.resize(new_len, 0.0);
                ctx.segj.jco.resize(new_len, 0);
            }

            ctx.segj.jco[jsnox] = jcox; // Store 1-based index

            let d = PI * ctx.geometry.si[jcoxx];
            let sdh = d.sin();
            let cdh = d.cos();
            let sd = 2.0 * sdh * cdh; // sin(2d)

            let omc: f64;
            if d <= 0.015 {
                let omc_sq = 4.0 * d * d;
                omc = ((1.3888889e-3 * omc_sq - 4.1666666667e-2) * omc_sq + 0.5) * omc_sq;
            } else {
                omc = 1.0 - cdh * cdh + sdh * sdh;
            }

            let aj = 1.0 / ((1.0 / (PI * ctx.geometry.bi[jcoxx])).ln() - 0.577215664);
            pp = pp - omc / sd * aj;

            ctx.segj.ax[jsnox] = aj / sd * sig;
            ctx.segj.bx[jsnox] = aj / (2.0 * cdh);
            ctx.segj.cx[jsnox] = -aj / (2.0 * sdh) * sig;

            if jcox != (ix + 1) as i32 {
                if jend == 1 {
                    jcox = ctx.geometry.icon2[jcoxx];
                } else {
                    jcox = ctx.geometry.icon1[jcoxx];
                }

                if jcox.abs() != (ix + 1) as i32 {
                    if jcox != 0 {
                        continue;
                    }
                    // Error would go here
                }
            } else {
                ctx.segj.bx[jsnox] = -ctx.segj.bx[jsnox];
            }

            if iend == 1 {
                break;
            }
        }

        pm = -pp;
        pp = 0.0;
        njun1 = ctx.segj.jsno;

        jcox = ctx.geometry.icon2[ix];
        if jcox > PCHCON as i32 {
            jcox = (ix + 1) as i32;
        }

        jend = 1;
        iend = 1;
        sig = -1.0;

        if jcox == 0 {
            break;
        }
    }

    let njun2 = ctx.segj.jsno - njun1;
    let jsnop = ctx.segj.jsno;

    // Ensure capacity for center segment
    if jsnop >= ctx.segj.jco.len() {
        ctx.segj.jco.resize(jsnop + 10, 0);
        ctx.segj.ax.resize(jsnop + 10, 0.0);
        ctx.segj.bx.resize(jsnop + 10, 0.0);
        ctx.segj.cx.resize(jsnop + 10, 0.0);
    }

    ctx.segj.jco[jsnop] = (ix + 1) as i32;

    let d = PI * ctx.geometry.si[ix];
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

    let ap = 1.0 / ((1.0 / (PI * ctx.geometry.bi[ix])).ln() - 0.577215664);
    let aj = ap;

    // Case 1: Open at start (njun1 == 0)
    if njun1 == 0 {
        if njun2 == 0 {
            // Isolated segment
            ctx.segj.bx[jsnop] = 0.0;
            let xxi = if icap == 0 {
                0.0
            } else {
                let qp_val = PI * ctx.geometry.bi[ix];
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
            let qp_val = PI * ctx.geometry.bi[ix];
            let xxi_val = qp_val * qp_val;
            qp_val * (1.0 - 0.5 * xxi_val) / (1.0 - xxi_val)
        };

        let denom = sd * (ap + xxi * pp) + cd * (xxi * ap - pp);
        let qp = -(omc + xxi * sd) / denom;

        let d_val = cd - xxi * sd;
        ctx.segj.bx[jsnop] = (sdh + ap * qp * (cdh - xxi * sdh)) / d_val;
        ctx.segj.cx[jsnop] = (cdh + ap * qp * (sdh + xxi * cdh)) / d_val;

        for i_end in 0..njun2 {
            // njun2 segments start at index equal to njun1 (which is 0)
            ctx.segj.ax[i_end] = -ctx.segj.ax[i_end] * qp;
            ctx.segj.bx[i_end] = ctx.segj.bx[i_end] * qp;
            ctx.segj.cx[i_end] = -ctx.segj.cx[i_end] * qp;
        }

        ctx.segj.jsno = jsnop + 1;
        ctx.segj.ax[jsnop] = -1.0;
        return;
    }

    // Case 2: Open at end (njun2 == 0)
    if njun2 == 0 {
        let qm_val = PI * ctx.geometry.bi[ix];
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
        ctx.segj.cx[idx] = -ctx.segj.cx[idx] * qp;
    }

    ctx.segj.ax[jsnop] = -1.0;
    ctx.segj.bx[jsnop] += (aj * qm + ap * qp) * sdh / sd;
    ctx.segj.cx[jsnop] += (aj * qm - ap * qp) * cdh / sd;

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

/// Compute e field of sine, cosine, and constant current filaments
/// Corresponds to `eksc`
fn eksc(
    s: f64,
    z: f64,
    rh: f64,
    xk: f64,
    ij: usize,
    ezs: &mut Complex64,
    ers: &mut Complex64,
    ezc: &mut Complex64,
    erc: &mut Complex64,
    ezk: &mut Complex64,
    erk: &mut Complex64,
) {
    let rhk = xk * rh;
    let tmi = TmiData {
        ij,
        zpk: xk * z,
        rkb2: rhk * rhk,
    };

    let sh = 0.5 * s;
    let shk = xk * sh;
    let ss = shk.sin();
    let cs = shk.cos();
    let z2a = sh - z;
    let z1a = -(sh + z);

    let (gz1, gp1) = gx(z1a, rh, xk);
    let (gz2, gp2) = gx(z2a, rh, xk);

    let mut gzp1 = gp1 * z1a;
    let mut gzp2 = gp2 * z2a;

    let c1 = 1.0;

    *ezs = c1 * ((gz2 - gz1) * cs * xk - (gzp2 + gzp1) * ss);
    *ezc = -c1 * ((gz2 + gz1) * ss * xk + (gzp2 - gzp1) * cs);
    *erk = c1 * (gp2 - gp1) * rh;

    let (cint, sint) = intx(-shk, shk, rhk, &tmi);
    *ezk = -c1 * (gzp2 - gzp1 + xk * xk * Complex64::new(cint, -sint));

    gzp1 = gzp1 * z1a;
    gzp2 = gzp2 * z2a;

    if rh >= 1.0e-10 {
        *ers = -c1 * ((gzp2 + gzp1 + gz2 + gz1) * ss - (z2a * gz2 - z1a * gz1) * cs * xk) / rh;
        *erc = -c1 * ((gzp2 - gzp1 + gz2 - gz1) * cs + (z2a * gz2 + z1a * gz1) * ss * xk) / rh;
    } else {
        *ers = Complex64::new(0.0, 0.0);
        *erc = Complex64::new(0.0, 0.0);
    }
}

/// Compute e field by extended thin wire approximation
/// Corresponds to `ekscx`
fn ekscx(
    bx: f64,
    s: f64,
    z: f64,
    rhx: f64,
    xk: f64,
    ij: usize,
    inx1: i32,
    inx2: i32,
    ezs: &mut Complex64,
    ers: &mut Complex64,
    ezc: &mut Complex64,
    erc: &mut Complex64,
    ezk: &mut Complex64,
    erk: &mut Complex64,
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
    let rhk = xk * rh;
    let tmi = TmiData {
        ij,
        zpk: xk * z,
        rkb2: rhk * rhk,
    };

    let shk = xk * sh;
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
        let res = gxx(z1a, rh, b, a2, xk, ira);
        gz1 = res.0;
        // gzp1 in C is g1p in gxx return? No.
        // gxx returns: g1, g1p, g2, g2p, g3, gzp
        // In ekscx: gcheck names:
        // C gxx args: &gz1, &gzp1, &gr1, &grp1, &grk1, &gzz1
        // Rust gxx returns: (g1, g1p, g2, g2p, g3, gzp)
        // Corresponds to: (gz1, gzp1, gr1, grp1, grk1, gzz1)
        gzp1 = res.1;
        gr1 = res.2;
        grp1 = res.3;
        grk1 = res.4;
        gzz1 = res.5;
    } else {
        let (gz, gzp) = gx(z1a, rhx, xk); // gx returns (gz, gzp)
        gz1 = gz;
        grk1 = gzp; // gx returns gzp in C is different from gxx gzp
                    // gx in C returns: &gz, &gzp
                    // gx implemented in Rust returns (gz, gzp)

        // In ekscx C code:
        // gx( z1a, rhx, xk, &gz1, &grk1);
        // gzp1= grk1* z1a;
        // gr1= gz1/ rhx;
        // ...

        gzp1 = grk1 * z1a;
        gr1 = gz1 / rhx;
        grp1 = gzp1 / rhx;
        grk1 = grk1 * rhx;
        gzz1 = Complex64::new(0.0, 0.0);
    }

    if inx2 != 2 {
        let res = gxx(z2a, rh, b, a2, xk, ira);
        gz2 = res.0;
        gzp2 = res.1;
        gr2 = res.2;
        grp2 = res.3;
        grk2 = res.4;
        gzz2 = res.5;
    } else {
        let (gz, gzp) = gx(z2a, rhx, xk);
        gz2 = gz;
        grk2 = gzp;

        gzp2 = grk2 * z2a;
        gr2 = gz2 / rhx;
        grp2 = gzp2 / rhx;
        grk2 = grk2 * rhx;
        gzz2 = Complex64::new(0.0, 0.0);
    }

    let c1 = 1.0;

    *ezs = c1 * ((gz2 - gz1) * cs * xk - (gzp2 + gzp1) * ss);
    *ezc = -c1 * ((gz2 + gz1) * ss * xk + (gzp2 - gzp1) * cs);
    *ers = -c1 * ((z2a * grp2 + z1a * grp1 + gr2 + gr1) * ss - (z2a * gr2 - z1a * gr1) * cs * xk);
    *erc = -c1 * ((z2a * grp2 - z1a * grp1 + gr2 - gr1) * cs + (z2a * gr2 + z1a * gr1) * ss * xk);
    *erk = c1 * (grk2 - grk1);

    let (cint, sint) = intx(-shk, shk, rhk, &tmi);
    let bk = b * xk;
    let bk2 = bk * bk * 0.25;
    *ezk = -c1
        * (gzp2 - gzp1 + xk * xk * (1.0 - bk2) * Complex64::new(cint, -sint) - bk2 * (gzz2 - gzz1));
}

/// Electric field evaluation.
/// Corresponds to `efld` in fields.c
pub fn efld(
    xi: f64,
    yi: f64,
    zi: f64,
    ai: f64,
    ij: usize,
    ctx: &Context,
) -> (Complex64, Complex64, Complex64) {
    // Basic implementation of efld
    // Calculates field at (xi, yi, zi)

    // For now, support only free space (no ground)

    // Let's retrieve source segment.
    let s_idx = ij;
    if s_idx >= ctx.geometry.n {
        return (
            Complex64::new(0.0, 0.0),
            Complex64::new(0.0, 0.0),
            Complex64::new(0.0, 0.0),
        );
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
    let rhox = xij - cabj * zp;
    let rhoy = yij - sabj * zp;
    let rhoz = zij - salpj * zp;
    let rh = (rhox * rhox + rhoy * rhoy + rhoz * rhoz + ai * ai).sqrt();

    // Call eksc or ekscx
    let k = 2.0 * PI_CONST;

    let mut tezs = Complex64::new(0.0, 0.0);
    let mut ters = Complex64::new(0.0, 0.0);
    let mut tezc = Complex64::new(0.0, 0.0);
    let mut terc = Complex64::new(0.0, 0.0);
    let mut tezk = Complex64::new(0.0, 0.0);
    let mut terk = Complex64::new(0.0, 0.0);

    // Dispatch logic approximated from nec2c
    // nec2c uses detailed overlap checks (ind1, ind2).
    // For now we use simpler proximity check

    let radius_s = ctx.geometry.bi[s_idx];
    // If distance is large compared to radius, use eksc
    // If close, use ekscx?
    // In ne2c:
    // ind1=0 -> eksc.
    // ind1!=0 -> ekscx.
    // ind1 is set if overlapping condition met.

    // For now always use eksc unless extremely close?
    // Let's implement full check logic later.
    // NEC2C logic:
    // If rh < radius_s (or close), then extended kernel logic needed?
    // Actually extended kernel is for "extended thin wire", i.e. radius not negligible.
    // Let's use eksc for now as default, keeping ekscx available.

    let use_extended = false; // logic would go here

    if !use_extended {
        eksc(
            len_s, zp, rh, k, s_idx, &mut tezs, &mut ters, &mut tezc, &mut terc, &mut tezk,
            &mut terk,
        );
    } else {
        let inx1 = 0; // determine overlap case
        let inx2 = 0;
        ekscx(
            radius_s, len_s, zp, rh, k, s_idx, inx1, inx2, &mut tezs, &mut ters, &mut tezc,
            &mut terc, &mut tezk, &mut terk,
        );
    }

    // Return result directly from eksc components for now (placeholder for transform)
    // Actually we need to transform back to be useful.
    (tezs, ters, tezk)
}
