import re

with open("src/nec/physics.rs", "r") as f:
    code = f.read()

# I will just write a new tbf function entirely, it's safer.
new_tbf = """pub fn tbf(i: usize, icap: usize, ctx: &mut Context) {
    ctx.segj.jsno = 0;
    let mut pp = 0.0;
    let mut pm = 0.0;
    let ix = i;
    let ix1 = (i + 1) as i32; // 1-based index

    // Ensure capacity
    if ctx.segj.ax.len() < 30 {
        ctx.segj.ax.resize(30, 0.0);
        ctx.segj.bx.resize(30, 0.0);
        ctx.segj.cx.resize(30, 0.0);
        ctx.segj.jco.resize(30, 0);
    }

    let mut jcox = ctx.geometry.icon1[ix];
    let mut jend = -1;
    let mut iend = -1;
    let mut sig = -1.0;
    
    let njun1;
    let mut loop_idx = 0;

    loop {
        if jcox != 0 {
            if jcox < 0 {
                jcox = -jcox;
            } else {
                sig = -sig;
                jend = -jend;
            }

            let jcoxx = (jcox - 1) as usize;
            
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

            let d = PI_CONST * ctx.geometry.si[jcoxx];
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

            let aj = 1.0 / ((1.0 / (PI_CONST * ctx.geometry.bi[jcoxx])).ln() - 0.577215664);
            pp = pp - omc / sd * aj;

            ctx.segj.ax[jsnox] = aj / sd * sig;
            ctx.segj.bx[jsnox] = aj / (2.0 * cdh);
            ctx.segj.cx[jsnox] = -aj / (2.0 * sdh) * sig;

            if jcox != ix1 {
                if jend == 1 {
                    jcox = ctx.geometry.icon2[jcoxx];
                } else {
                    jcox = ctx.geometry.icon1[jcoxx];
                }
                
                if jcox.abs() != ix1 {
                    if jcox == 0 {
                        // Error condition, segment connection
                        break;
                    }
                }
            } else {
                ctx.segj.bx[jsnox] = -ctx.segj.bx[jsnox];
            }

            if iend == 1 {
                break;
            }
        } else {
            pm = -pp;
            pp = 0.0;
            njun1 = ctx.segj.jsno;
            
            jcox = ctx.geometry.icon2[ix];
            jend = 1;
            iend = 1;
            sig = -1.0;
            
            if jcox == 0 {
                break;
            }
        }
        
        loop_idx += 1;
        if loop_idx > 100 { break; } // Safety
    }

    // Now phase 3
    let njun2 = ctx.segj.jsno - njun1;
    let jsnop = ctx.segj.jsno;

    if jsnop >= ctx.segj.jco.len() {
        ctx.segj.jco.resize(jsnop + 10, 0);
        ctx.segj.ax.resize(jsnop + 10, 0.0);
        ctx.segj.bx.resize(jsnop + 10, 0.0);
        ctx.segj.cx.resize(jsnop + 10, 0.0);
    }

    ctx.segj.jco[jsnop] = ix1;

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

    if njun1 == 0 {
        if njun2 == 0 {
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

    if njun2 == 0 {
        let xxi;
        let mut qm = 0.0;
        if icap == 0 {
            xxi = 0.0;
        } else {
            qm = PI_CONST * ctx.geometry.bi[ix];
            xxi = qm * qm;
            xxi = qm * (1.0 - 0.5 * xxi) / (1.0 - xxi);
        }

        let denom = sd * (aj - xxi * pm) + cd * (pm + xxi * aj);
        qm = (omc + xxi * sd) / denom;
        let d_val = cd - xxi * sd;
        
        ctx.segj.bx[jsnop] = (aj * qm * (cdh - xxi * sdh) - sdh) / d_val;
        ctx.segj.cx[jsnop] = (cdh - aj * qm * (sdh + xxi * cdh)) / d_val;

        for i_start in 0..njun1 {
            ctx.segj.ax[i_start] = ctx.segj.ax[i_start] * qm;
            ctx.segj.bx[i_start] = ctx.segj.bx[i_start] * qm;
            ctx.segj.cx[i_start] = ctx.segj.cx[i_start] * qm;
        }

        ctx.segj.jsno = jsnop + 1;
        ctx.segj.ax[jsnop] = -1.0;
        return;
    }

    let qp_denom = sd * (pm * pp + aj * ap) + cd * (pm * ap - pp * aj);
    let qm = (ap * omc - pp * sd) / qp_denom;
    let qp = -(aj * omc + pm * sd) / qp_denom;
    
    ctx.segj.bx[jsnop] = (aj * qm + ap * qp) * sdh / sd;
    ctx.segj.cx[jsnop] = (aj * qm - ap * qp) * cdh / sd;

    for i_start in 0..njun1 {
        ctx.segj.ax[i_start] = ctx.segj.ax[i_start] * qm;
        ctx.segj.bx[i_start] = ctx.segj.bx[i_start] * qm;
        ctx.segj.cx[i_start] = ctx.segj.cx[i_start] * qm;
    }

    for i_end in njun1..ctx.segj.jsno {
        ctx.segj.ax[i_end] = -ctx.segj.ax[i_end] * qp;
        ctx.segj.bx[i_end] = ctx.segj.bx[i_end] * qp;
        ctx.segj.cx[i_end] = -ctx.segj.cx[i_end] * qp;
    }

    ctx.segj.jsno = jsnop + 1;
    ctx.segj.ax[jsnop] = -1.0;
}"""

p = re.compile(r'pub fn tbf\(i: usize, icap: usize, ctx: &mut Context\) \{.*?\n\}\n(?=\n/// Computes the integrand)', re.DOTALL)
new_code = p.sub(new_tbf + "\n", code)

with open("src/nec/physics.rs", "w") as f:
    f.write(new_code)
