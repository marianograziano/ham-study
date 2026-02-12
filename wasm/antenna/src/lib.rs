use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn calculate_field(theta: f64, length: f64, traveling: bool) -> f64 {
    const PI: f64 = std::f64::consts::PI;
    const K: f64 = 2.0 * PI; // normalized
    let n = 200;
    let dz = length / n as f64;
    let cos_theta = theta.cos();

    let mut sum_re = 0.0;
    let mut sum_im = 0.0;

    for i in 0..=n {
        let z = i as f64 * dz;
        let (ir, ii) = if traveling {
            let kz = K * z;
            (kz.cos(), -kz.sin())
        } else {
            ( (K * (length - z)).sin(), 0.0 )
        };
        let phase = K * z * cos_theta;
        let kr = phase.cos();
        let ki = phase.sin();
        sum_re += ir * kr - ii * ki;
        sum_im += ir * ki + ii * kr;
    }

    sum_re *= dz;
    sum_im *= dz;
    let integral_mag = (sum_re * sum_re + sum_im * sum_im).sqrt();
    (theta.sin() * integral_mag).abs()
}
