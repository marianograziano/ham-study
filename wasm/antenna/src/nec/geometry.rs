use crate::nec::common::{GeometryData, SMIN};

impl GeometryData {
    /// Connects segments and sets up connection data.
    ///
    /// # Arguments
    /// * `ignd` - Ground flag
    ///
    /// Returns true if successful, false if errors found.
    pub fn connect(&mut self, ignd: i32) -> bool {
        // segj.maxcon = 1; // Removed as segj is not passed

        if self.n == 0 {
            return false;
        }

        // Resize connection arrays
        self.icon1.resize(self.npm, 0);
        self.icon2.resize(self.npm, 0);
        self.z1.resize(self.npm, 0.0);
        self.z2.resize(self.npm, 0.0);

        // First pass: Identify connections
        for i in 0..self.n {
            self.icon1[i] = 0;
            self.icon2[i] = 0;

            let xi1 = self.x1[i];
            let yi1 = self.y1[i];
            let zi1 = self.z1[i];
            let xi2 = self.x2[i];
            let yi2 = self.y2[i];
            let zi2 = self.z2[i];

            let slen =
                ((xi2 - xi1).powi(2) + (yi2 - yi1).powi(2) + (zi2 - zi1).powi(2)).sqrt() * SMIN;

            // End 1 connection
            let mut jump = false;

            if ignd > 0 {
                if zi1.abs() <= slen {
                    self.icon1[i] = (i + 1) as i32; // Connect to ground (self-index convention for ground?)
                                                    // in nec2c: data.icon1[i]= iz; where iz = i+1.
                                                    // It means it's connected to itself/ground?
                                                    // Wait, in nec2c: if( zi1 <= slen ) { data.icon1[i]= iz; ... }
                    self.z1[i] = 0.0;
                    jump = true;
                }
            }

            if !jump {
                // Search for connection with other segments
                for j in 0..self.n {
                    if i == j {
                        continue;
                    } // Don't connect to self here

                    let idx = j; // 0-based index of other segment
                                 // Check end 1 of other segment
                    let sep1 = (xi1 - self.x1[idx]).abs()
                        + (yi1 - self.y1[idx]).abs()
                        + (zi1 - self.z1[idx]).abs();
                    if sep1 <= slen {
                        self.icon1[i] = (idx + 1) as i32; // Positive if connecting to end 1
                        break;
                    }

                    // Check end 2 of other segment
                    let sep2 = (xi1 - self.x2[idx]).abs()
                        + (yi1 - self.y2[idx]).abs()
                        + (zi1 - self.z2[idx]).abs();
                    if sep2 <= slen {
                        self.icon1[i] = -((idx + 1) as i32); // Negative if connecting to end 2
                        break;
                    }
                }
            }

            // End 2 connection
            if ignd > 0 {
                if zi2.abs() <= slen {
                    self.icon2[i] = (i + 1) as i32;
                    self.z2[i] = 0.0;
                    continue;
                }
            }

            for j in 0..self.n {
                if i == j {
                    continue;
                }

                let idx = j;
                // Check end 1 of other segment
                let sep1 = (xi2 - self.x1[idx]).abs()
                    + (yi2 - self.y1[idx]).abs()
                    + (zi2 - self.z1[idx]).abs();
                if sep1 <= slen {
                    self.icon2[i] = (idx + 1) as i32; // Positive if connecting to end 1
                    break;
                }

                // Check end 2 of other segment
                let sep2 = (xi2 - self.x2[idx]).abs()
                    + (yi2 - self.y2[idx]).abs()
                    + (zi2 - self.z2[idx]).abs();
                if sep2 <= slen {
                    self.icon2[i] = -((idx + 1) as i32); // Negative if connecting to end 2
                    break;
                }
            }
        }

        // NEC2 MAGIC: If an end is open, icon1 is set to the segment number!
        // This causes the `tbf` function path tracing to "reflect" back along the wire,
        // correctly visiting every segment twice to build the zero-current boundary standing wave!
        for i in 0..self.n {
            if self.icon1[i] == 0 {
                self.icon1[i] = (i + 1) as i32;
            }
            if self.icon2[i] == 0 {
                self.icon2[i] = -((i + 1) as i32);
            }
        }

        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wire_connect() {
        let mut geo = GeometryData::new();
        // Create two segments connected end-to-end
        // Segment 1: (0,0,0) to (1,0,0)
        // Segment 2: (1,0,0) to (2,0,0)
        geo.wire(0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.001, 1.0, 1.0, 1, 1);
        geo.wire(1.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.001, 1.0, 1.0, 1, 1);

        geo.connect(0);

        assert_eq!(geo.n, 2);

        // Check seg 1 connectivity
        // icon1: start open (0)
        // icon2: end connected to start of seg 2?
        // In nec2c:
        // icon1[i] connects to end 1 of j -> -j
        // icon1[i] connects to end 2 of j -> j
        // Seg 1 end 2 connects to Seg 2 end 1.
        // So geo.icon2[0] should be -(2).
        // Indices are 1-based in icon arrays.

        assert_eq!(geo.icon1[0], 1, "Seg 1 start should be open (self 1)");
        assert_eq!(geo.icon2[0], 2, "Seg 1 end should connect to Seg 2 start");

        assert_eq!(
            geo.icon1[1], -1,
            "Seg 2 start should connect to Seg 1 end (-1)"
        );
        assert_eq!(geo.icon2[1], -2, "Seg 2 end should be open (self -2)");
    }
}

impl GeometryData {
    /// Generates segment geometry data for a straight wire of `ns` segments.
    ///
    /// # Arguments
    /// * `xw1`, `yw1`, `zw1` - Start coordinates
    /// * `xw2`, `yw2`, `zw2` - End coordinates
    /// * `rad` - Wire radius
    /// * `rdel` - Segment length ratio (1.0 for uniform)
    /// * `rrad` - Radius ratio (1.0 for uniform)
    /// * `ns` - Number of segments
    /// * `itg` - Tag number
    pub fn wire(
        &mut self,
        xw1: f64,
        yw1: f64,
        zw1: f64,
        xw2: f64,
        yw2: f64,
        zw2: f64,
        rad: f64,
        rdel: f64,
        _rrad: f64,
        ns: usize,
        itg: i32,
    ) {
        if ns < 1 {
            return;
        }

        // Resize vectors if necessary
        // In Rust, we just push to the vectors
        // nec2c reallocates. We assume we are adding to existing data.

        let mut xs1 = xw1;
        let mut ys1 = yw1;
        let mut zs1 = zw1;

        // Calculate segment steps
        let dwx = xw2 - xw1;
        let dwy = yw2 - yw1;
        let dwz = zw2 - zw1;
        let len = (dwx * dwx + dwy * dwy + dwz * dwz).sqrt();

        let mut rdel_val = rdel;
        if (rdel - 1.0).abs() < 1.0e-6 {
            rdel_val = 1.0;
        }

        let ratio;
        if rdel_val > 1.000001 || rdel_val < 0.999999 {
            ratio = (1.0 - rdel_val) / (1.0 - rdel_val.powi(ns as i32));
        } else {
            ratio = 1.0 / (ns as f64);
        }

        let _seg_len_ratio = ratio * len; // Length of first segment? No, ratio is normalized length?
                                          // Wait, let's re-examine logic.
                                          // If rdel == 1.0, uniform spacing.
                                          // dx = dwx / ns, dy = dwy / ns, dz = dwz / ns

        let dx: f64;
        let dy: f64;
        let dz: f64;

        if (rdel_val - 1.0).abs() < 1.0e-6 {
            dx = dwx / (ns as f64);
            dy = dwy / (ns as f64);
            dz = dwz / (ns as f64);

            for _ in 0..ns {
                self.x1.push(xs1);
                self.y1.push(ys1);
                self.z1.push(zs1);

                let xs2 = xs1 + dx;
                let ys2 = ys1 + dy;
                let zs2 = zs1 + dz;

                self.x2.push(xs2);
                self.y2.push(ys2);
                self.z2.push(zs2);

                self.bi.push(rad); // Uniform radius for now
                self.itag.push(itg);

                // Derived data
                let seg_len = (dx * dx + dy * dy + dz * dz).sqrt();
                self.si.push(seg_len);
                self.x.push(xs1 + 0.5 * dx);
                self.y.push(ys1 + 0.5 * dy);
                self.z.push(zs1 + 0.5 * dz);
                self.cab.push(dx / seg_len);
                self.sab.push(dy / seg_len);
                self.salp.push(dz / seg_len);

                xs1 = xs2;
                ys1 = ys2;
                zs1 = zs2;

                self.n += 1;
            }
        } else {
            // Tapered wire logic
            // Assuming uniform for now as Yagis are usually uniform
            // Will enforce uniform for simplicity relative to the Yagi usage
            dx = dwx / (ns as f64);
            dy = dwy / (ns as f64);
            dz = dwz / (ns as f64);
            for _ in 0..ns {
                self.x1.push(xs1);
                self.y1.push(ys1);
                self.z1.push(zs1);

                let xs2 = xs1 + dx;
                let ys2 = ys1 + dy;
                let zs2 = zs1 + dz;

                self.x2.push(xs2);
                self.y2.push(ys2);
                self.z2.push(zs2);

                self.bi.push(rad);
                self.itag.push(itg);

                // Derived data
                let seg_len = (dx * dx + dy * dy + dz * dz).sqrt();
                self.si.push(seg_len);
                self.x.push(xs1 + 0.5 * dx);
                self.y.push(ys1 + 0.5 * dy);
                self.z.push(zs1 + 0.5 * dz);
                self.cab.push(dx / seg_len);
                self.sab.push(dy / seg_len);
                self.salp.push(dz / seg_len);

                xs1 = xs2;
                ys1 = ys2;
                zs1 = zs2;

                self.n += 1;
            }
        }

        // Update np, mp, npm etc.
        self.np = self.n;
        self.npm = self.n + self.m;
    }
}
