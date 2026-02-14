use wasm_bindgen::prelude::*;

/// 球面几何体生成参数
#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct SphericalSurfaceParams {
    pub radius: f64,
    pub max_angle: f64,
    pub spread_angle: f64,
    pub segments_r: i32,
    pub segments_w: i32,
}

#[wasm_bindgen]
impl SphericalSurfaceParams {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            radius: 50.0,
            max_angle: std::f64::consts::PI / 6.0,
            spread_angle: std::f64::consts::PI / 3.0,
            segments_r: 64,
            segments_w: 64,
        }
    }
}

impl Default for SphericalSurfaceParams {
    fn default() -> Self {
        Self::new()
    }
}

/// 生成球面几何体数据
///
/// 用于创建地波、电离层等球面效果
///
/// # Arguments
/// * `params` - 球面参数
/// * `vertices` - 顶点缓冲区输出 [x, y, z, x, y, z, ...]
/// * `uvs` - UV 缓冲区输出 [u, v, u, v, ...]
/// * `indices` - 索引缓冲区输出 [i0, i1, i2, i0, i1, i2, ...]
///
/// # Returns
/// 返回 (顶点数, 索引数)
#[wasm_bindgen]
pub fn generate_spherical_surface(
    params: &SphericalSurfaceParams,
    vertices: &mut [f32],
    uvs: &mut [f32],
    indices: &mut [u32],
) -> i32 {
    let segments_r = params.segments_r.max(1);
    let segments_w = params.segments_w.max(1);
    let radius = params.radius;
    let max_angle = params.max_angle;
    let spread_angle = params.spread_angle;

    let vertex_count = ((segments_r + 1) * (segments_w + 1)) as usize;
    let index_count = (segments_r * segments_w * 6) as usize;

    // 检查缓冲区大小
    if vertices.len() < vertex_count * 3
        || uvs.len() < vertex_count * 2
        || indices.len() < index_count
    {
        return -1; // 缓冲区不足
    }

    // 生成顶点和 UV
    for i in 0..=segments_r {
        let phi = (i as f64 / segments_r as f64) * max_angle;
        let sin_phi = phi.sin();
        let cos_phi = phi.cos();

        for j in 0..=segments_w {
            let theta = (j as f64 / segments_w as f64 - 0.5) * spread_angle;
            let sin_theta = theta.sin();
            let cos_theta = theta.cos();

            let idx = (i * (segments_w + 1) + j) as usize;

            // 球坐标转笛卡尔坐标
            // x = r * sin(phi) * sin(theta)
            // y = r * cos(phi)
            // z = r * sin(phi) * cos(theta)
            vertices[idx * 3] = (radius * sin_phi * sin_theta) as f32;
            vertices[idx * 3 + 1] = (radius * cos_phi) as f32;
            vertices[idx * 3 + 2] = (radius * sin_phi * cos_theta) as f32;

            // UV 坐标
            uvs[idx * 2] = j as f32 / segments_w as f32;
            uvs[idx * 2 + 1] = i as f32 / segments_r as f32;
        }
    }

    // 生成索引 (三角形)
    let mut idx = 0;
    for i in 0..segments_r {
        for j in 0..segments_w {
            let a = (i * (segments_w + 1) + j) as u32;
            let b = ((i + 1) * (segments_w + 1) + j) as u32;
            let c = ((i + 1) * (segments_w + 1) + (j + 1)) as u32;
            let d = (i * (segments_w + 1) + (j + 1)) as u32;

            // 第一个三角形: a, b, d
            indices[idx] = a;
            indices[idx + 1] = b;
            indices[idx + 2] = d;

            // 第二个三角形: b, c, d
            indices[idx + 3] = b;
            indices[idx + 4] = c;
            indices[idx + 5] = d;

            idx += 6;
        }
    }

    ((vertex_count << 16) | index_count) as i32
}

/// 计算所需缓冲区大小
#[wasm_bindgen]
pub fn get_spherical_surface_buffer_sizes(segments_r: i32, segments_w: i32) -> i64 {
    let vertex_count = ((segments_r + 1) * (segments_w + 1)) as i64;
    let index_count = (segments_r * segments_w * 6) as i64;

    // 打包返回: 高32位是顶点数，低32位是索引数
    (vertex_count << 32) | index_count
}

/// 向量3D (用于内部计算)
#[derive(Clone, Copy, Debug)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Vec3 {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }

    pub fn zero() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        }
    }

    pub fn dot(&self, other: &Vec3) -> f64 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    pub fn length_squared(&self) -> f64 {
        self.dot(self)
    }

    pub fn length(&self) -> f64 {
        self.length_squared().sqrt()
    }

    pub fn normalize(&self) -> Self {
        let len = self.length();
        if len > 1e-10 {
            Self {
                x: self.x / len,
                y: self.y / len,
                z: self.z / len,
            }
        } else {
            Self::zero()
        }
    }

    pub fn sub(&self, other: &Vec3) -> Self {
        Self {
            x: self.x - other.x,
            y: self.y - other.y,
            z: self.z - other.z,
        }
    }

    pub fn add(&self, other: &Vec3) -> Self {
        Self {
            x: self.x + other.x,
            y: self.y + other.y,
            z: self.z + other.z,
        }
    }

    pub fn mul_scalar(&self, s: f64) -> Self {
        Self {
            x: self.x * s,
            y: self.y * s,
            z: self.z * s,
        }
    }

    pub fn reflect(&self, normal: &Vec3) -> Self {
        // r = d - 2(d·n)n
        let dot = self.dot(normal);
        Self {
            x: self.x - 2.0 * dot * normal.x,
            y: self.y - 2.0 * dot * normal.y,
            z: self.z - 2.0 * dot * normal.z,
        }
    }
}

/// 射线结构
#[derive(Clone, Copy)]
pub struct Ray {
    pub origin: Vec3,
    pub direction: Vec3,
}

impl Ray {
    pub fn new(origin: Vec3, direction: Vec3) -> Self {
        Self {
            origin,
            direction: direction.normalize(),
        }
    }

    pub fn at(&self, t: f64) -> Vec3 {
        self.origin.add(&self.direction.mul_scalar(t))
    }
}

/// 球体结构
#[derive(Clone, Copy)]
pub struct Sphere {
    pub center: Vec3,
    pub radius: f64,
}

impl Sphere {
    pub fn new(center: Vec3, radius: f64) -> Self {
        Self { center, radius }
    }
}

/// 射线与球体相交测试
///
/// # Returns
/// 如果有交点，返回 (t1, t2) 两个参数，射线方程: P = origin + t * direction
/// 如果无交点，返回 None
///
/// 注意: 当射线起点在球内时，t1 为负数，此时应使用 t2
pub fn intersect_sphere(ray: &Ray, sphere: &Sphere) -> Option<(f64, f64)> {
    let l = sphere.center.sub(&ray.origin);
    let tca = l.dot(&ray.direction);
    let d2 = l.length_squared() - tca * tca;
    let r2 = sphere.radius * sphere.radius;

    if d2 > r2 {
        return None;
    }

    let thc = (r2 - d2).sqrt();
    let t1 = tca - thc;
    let t2 = tca + thc;

    // 如果 t1 < 0，说明起点在球内，返回 t2 作为第一个有效交点
    if t1 < 0.001 && t2 > 0.001 {
        return Some((t2, t2));
    }

    Some((t1, t2))
}

/// 批量射线与球体相交测试 (WASM 导出)
///
/// # Arguments
/// * `ray_origins` - 射线起点 [x, y, z, x, y, z, ...]
/// * `ray_dirs` - 射线方向 [x, y, z, x, y, z, ...]
/// * `sphere_center` - 球心 [x, y, z]
/// * `sphere_radius` - 球半径
/// * `results` - 输出结果 [t1, t2, t1, t2, ...]，无交点时 t1=t2=-1
#[wasm_bindgen]
pub fn intersect_sphere_batch(
    ray_origins: &[f32],
    ray_dirs: &[f32],
    sphere_center: &[f32],
    sphere_radius: f64,
    results: &mut [f32],
) {
    let ray_count = ray_origins.len() / 3;
    if ray_dirs.len() / 3 != ray_count || results.len() < ray_count * 2 {
        return;
    }

    let sphere = Sphere::new(
        Vec3::new(
            sphere_center[0] as f64,
            sphere_center[1] as f64,
            sphere_center[2] as f64,
        ),
        sphere_radius,
    );

    for i in 0..ray_count {
        let origin = Vec3::new(
            ray_origins[i * 3] as f64,
            ray_origins[i * 3 + 1] as f64,
            ray_origins[i * 3 + 2] as f64,
        );
        let direction = Vec3::new(
            ray_dirs[i * 3] as f64,
            ray_dirs[i * 3 + 1] as f64,
            ray_dirs[i * 3 + 2] as f64,
        );

        let ray = Ray::new(origin, direction);

        match intersect_sphere(&ray, &sphere) {
            Some((t1, t2)) => {
                results[i * 2] = t1 as f32;
                results[i * 2 + 1] = t2 as f32;
            }
            None => {
                results[i * 2] = -1.0;
                results[i * 2 + 1] = -1.0;
            }
        }
    }
}
