use wasm_bindgen::prelude::*;
use crate::geometry::{Vec3, Ray, Sphere, intersect_sphere};

/// 传播模式
#[wasm_bindgen]
#[derive(Clone, Copy, PartialEq)]
pub enum PropagationMode {
    HF,
    UV,
}

impl From<&str> for PropagationMode {
    fn from(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "UV" => PropagationMode::UV,
            _ => PropagationMode::HF,
        }
    }
}

/// 信号路径点
#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct PathPoint {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub is_impact: bool,  // 是否是撞击点(电离层或地面)
}

/// 传播计算参数
#[wasm_bindgen]
pub struct PropagationParams {
    pub mode: PropagationMode,
    pub frequency: f64,       // MHz
    pub angle: f64,           // 发射角度 (度)
    pub iono_height: f64,     // 电离层高度 (单位与地球半径一致)
    pub earth_radius: f64,
    pub max_hops: i32,
    pub critical_frequency: f64,  // f0F2 (MHz)
}

#[wasm_bindgen]
impl PropagationParams {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            mode: PropagationMode::HF,
            frequency: 14.0,
            angle: 30.0,
            iono_height: 20.0,
            earth_radius: 50.0,
            max_hops: 3,
            critical_frequency: 7.0,
        }
    }
}

impl Default for PropagationParams {
    fn default() -> Self {
        Self::new()
    }
}

/// 计算入射角 (弧度)
/// 
/// 根据发射角度和电离层高度计算射线到达电离层时的入射角
fn calculate_incidence_angle(elevation_angle: f64, earth_radius: f64, iono_radius: f64) -> f64 {
    // 使用球面几何关系
    // sin(incidence) = (R_earth / R_iono) * cos(elevation)
    let elevation_rad = elevation_angle.to_radians();
    let cos_elevation = elevation_rad.cos();
    
    let sin_incidence = (earth_radius / iono_radius) * cos_elevation;
    sin_incidence.min(1.0).max(-1.0).asin()
}

/// 计算 MUF (最大可用频率)
/// 
/// MUF = critical_frequency / cos(incidence_angle)
fn calculate_muf(critical_frequency: f64, incidence_angle: f64) -> f64 {
    critical_frequency / incidence_angle.cos()
}

/// 计算信号路径
/// 
/// 根据传播参数计算射线路径点
/// 
/// # Arguments
/// * `params` - 传播参数
/// * `path_buffer` - 路径点缓冲区 [x, y, z, x, y, z, ...]
/// * `impact_buffer` - 撞击点标记缓冲区 (0=普通点, 1=撞击点)
/// 
/// # Returns
/// 返回实际路径点数，如果缓冲区不足返回 -1
#[wasm_bindgen]
pub fn calculate_signal_path(
    params: &PropagationParams,
    path_buffer: &mut [f32],
    impact_buffer: &mut [u8],
) -> i32 {
    let max_points = path_buffer.len() / 3;
    if impact_buffer.len() < max_points {
        return -1;
    }
    
    let earth_radius = params.earth_radius;
    let iono_radius = earth_radius + params.iono_height;
    let elevation_rad = params.angle.to_radians();
    
    // 计算入射角和 MUF
    let incidence_angle = calculate_incidence_angle(params.angle, earth_radius, iono_radius);
    let muf = calculate_muf(params.critical_frequency, incidence_angle);
    let is_penetrating = params.mode == PropagationMode::UV || params.frequency > muf;
    
    // 初始位置和方向
    let start_pos = Vec3::new(0.0, earth_radius, 0.0);
    let direction = Vec3::new(
        elevation_rad.cos(),
        elevation_rad.sin(),
        0.0,
    ).normalize();
    
    let mut current_pos = start_pos;
    let mut current_dir = direction;
    let mut point_count = 0;
    
    // 添加起点
    if point_count < max_points {
        path_buffer[point_count * 3] = current_pos.x as f32;
        path_buffer[point_count * 3 + 1] = current_pos.y as f32;
        path_buffer[point_count * 3 + 2] = current_pos.z as f32;
        impact_buffer[point_count] = 0;
        point_count += 1;
    }
    
    let earth_sphere = Sphere::new(Vec3::new(0.0, 0.0, 0.0), earth_radius);
    let iono_sphere = Sphere::new(Vec3::new(0.0, 0.0, 0.0), iono_radius);
    
    if is_penetrating {
        // 穿透模式: 发射 -> 电离层(撞击) -> 太空
        let ray = Ray::new(current_pos, current_dir);
        
        if let Some((t1, _)) = intersect_sphere(&ray, &iono_sphere) {
            if t1 > 0.001 && point_count < max_points {
                let hit_point = ray.at(t1);
                path_buffer[point_count * 3] = hit_point.x as f32;
                path_buffer[point_count * 3 + 1] = hit_point.y as f32;
                path_buffer[point_count * 3 + 2] = hit_point.z as f32;
                impact_buffer[point_count] = 1;  // 电离层撞击点
                point_count += 1;
                
                // 延伸到太空
                if point_count < max_points {
                    let space_point = ray.at(t1 + 80.0);
                    path_buffer[point_count * 3] = space_point.x as f32;
                    path_buffer[point_count * 3 + 1] = space_point.y as f32;
                    path_buffer[point_count * 3 + 2] = space_point.z as f32;
                    impact_buffer[point_count] = 0;
                    point_count += 1;
                }
            }
        } else {
            // 未击中电离层，直接延伸到太空
            if point_count < max_points {
                let space_point = current_pos.add(&current_dir.mul_scalar(80.0));
                path_buffer[point_count * 3] = space_point.x as f32;
                path_buffer[point_count * 3 + 1] = space_point.y as f32;
                path_buffer[point_count * 3 + 2] = space_point.z as f32;
                impact_buffer[point_count] = 0;
                point_count += 1;
            }
        }
    } else {
        // 反射模式: 发射 -> 电离层 -> 地面 -> 电离层 -> 地面 ...
        let mut hops = 0;
        
        while hops < params.max_hops && point_count < max_points - 1 {
            let ray = Ray::new(current_pos, current_dir);
            
            // 射向电离层
            if let Some((t1, _)) = intersect_sphere(&ray, &iono_sphere) {
                if t1 > 0.001 {
                    let hit_iono = ray.at(t1);
                    path_buffer[point_count * 3] = hit_iono.x as f32;
                    path_buffer[point_count * 3 + 1] = hit_iono.y as f32;
                    path_buffer[point_count * 3 + 2] = hit_iono.z as f32;
                    impact_buffer[point_count] = 1;  // 电离层撞击点
                    point_count += 1;
                    
                    // 反射: 关于法线反射
                    let normal = hit_iono.normalize();
                    current_dir = current_dir.reflect(&normal.neg());
                    current_pos = hit_iono;
                    
                    // 射向地面
                    let ray_to_earth = Ray::new(current_pos, current_dir);
                    if let Some((t1, _)) = intersect_sphere(&ray_to_earth, &earth_sphere) {
                        if t1 > 0.001 && point_count < max_points {
                            let hit_earth = ray_to_earth.at(t1);
                            path_buffer[point_count * 3] = hit_earth.x as f32;
                            path_buffer[point_count * 3 + 1] = hit_earth.y as f32;
                            path_buffer[point_count * 3 + 2] = hit_earth.z as f32;
                            impact_buffer[point_count] = 1;  // 地面撞击点
                            point_count += 1;
                            
                            // 地面反射
                            let normal = hit_earth.normalize();
                            current_dir = current_dir.reflect(&normal);
                            current_pos = hit_earth;
                            hops += 1;
                        } else {
                            break;
                        }
                    } else {
                        // 未击中地面，延伸到远处
                        if point_count < max_points {
                            let far_point = current_pos.add(&current_dir.mul_scalar(60.0));
                            path_buffer[point_count * 3] = far_point.x as f32;
                            path_buffer[point_count * 3 + 1] = far_point.y as f32;
                            path_buffer[point_count * 3 + 2] = far_point.z as f32;
                            impact_buffer[point_count] = 0;
                            point_count += 1;
                        }
                        break;
                    }
                } else {
                    break;
                }
            } else {
                // 未击中电离层
                if point_count < max_points {
                    let far_point = current_pos.add(&current_dir.mul_scalar(60.0));
                    path_buffer[point_count * 3] = far_point.x as f32;
                    path_buffer[point_count * 3 + 1] = far_point.y as f32;
                    path_buffer[point_count * 3 + 2] = far_point.z as f32;
                    impact_buffer[point_count] = 0;
                    point_count += 1;
                }
                break;
            }
        }
    }
    
    point_count as i32
}

/// 计算地波强度
/// 
/// 地波强度随频率增加而衰减
#[wasm_bindgen]
pub fn calculate_ground_wave_strength(frequency: f64) -> f64 {
    // 经验公式: 强度 = max(0, 15 - frequency * 0.4)
    (15.0 - frequency * 0.4).max(0.0)
}

/// 计算地波最大角度 (弧度)
#[wasm_bindgen]
pub fn calculate_ground_wave_angle(strength: f64) -> f64 {
    strength * 0.06
}

/// 获取传播计算所需的缓冲区大小建议
#[wasm_bindgen]
pub fn get_propagation_buffer_size(max_hops: i32) -> i32 {
    // 每个 hop 最多产生 2 个点 (电离层 + 地面)
    // 加上起点和可能的终点
    (max_hops * 2 + 3) * 3
}

/// 计算传播路径的统计信息
#[wasm_bindgen]
pub fn calculate_propagation_stats(
    params: &PropagationParams,
) -> PropagationStats {
    let earth_radius = params.earth_radius;
    let iono_radius = earth_radius + params.iono_height;
    let elevation_rad = params.angle.to_radians();
    
    let incidence_angle = calculate_incidence_angle(params.angle, earth_radius, iono_radius);
    let muf = calculate_muf(params.critical_frequency, incidence_angle);
    let is_penetrating = params.mode == PropagationMode::UV || params.frequency > muf;
    
    PropagationStats {
        incidence_angle: incidence_angle.to_degrees(),
        muf,
        is_penetrating,
        ground_wave_strength: if params.mode == PropagationMode::HF {
            calculate_ground_wave_strength(params.frequency)
        } else {
            0.0
        },
    }
}

/// 传播统计信息
#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct PropagationStats {
    pub incidence_angle: f64,  // 度
    pub muf: f64,              // MHz
    pub is_penetrating: bool,
    pub ground_wave_strength: f64,
}

impl Vec3 {
    fn neg(&self) -> Self {
        Self {
            x: -self.x,
            y: -self.y,
            z: -self.z,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_incidence_angle_calculation() {
        // 垂直发射 (90度仰角) 到 300km 高度 (地球半径 6371km)
        // 仰角90度 = 垂直向上，此时入射角应该接近0度(垂直入射)
        let angle = calculate_incidence_angle(90.0, 6371.0, 6371.0 + 300.0);
        // 应该接近 0 (垂直入射)
        assert!(angle.abs() < 0.1);
        
        // 低仰角发射 (10度) - 接近水平
        // 射线以很小的仰角发射，到达电离层时入射角会较大
        let angle = calculate_incidence_angle(10.0, 6371.0, 6371.0 + 300.0);
        // 入射角应该大于60度(约1.05弧度)，但小于90度
        assert!(angle > 1.0 && angle < 1.5); // 约60-85度
        
        // 45度仰角发射
        let angle = calculate_incidence_angle(45.0, 6371.0, 6371.0 + 300.0);
        // 入射角应该在30-60度之间
        assert!(angle > 0.5 && angle < 1.0); // 约30-60度
    }

    #[test]
    fn test_muf_calculation() {
        // 垂直入射时 MUF = 临界频率
        let muf = calculate_muf(7.0, 0.0);
        assert!((muf - 7.0).abs() < 0.001);
        
        // 45度入射时 MUF = 临界频率 / cos(45°) ≈ 9.9
        let muf = calculate_muf(7.0, std::f64::consts::PI / 4.0);
        assert!(muf > 9.0 && muf < 10.0);
    }

    #[test]
    fn test_signal_path_hf() {
        let params = PropagationParams {
            mode: PropagationMode::HF,
            frequency: 7.0,  // 低于 MUF，应该反射
            angle: 30.0,
            iono_height: 300.0,
            earth_radius: 6371.0,
            max_hops: 2,
            critical_frequency: 7.0,
        };
        
        let mut path = vec![0.0f32; 100];
        let mut impacts = vec![0u8; 100];
        
        let count = calculate_signal_path(&params, &mut path, &mut impacts);
        assert!(count > 2);  // 至少应该有起点 + 一些路径点
    }

    #[test]
    fn test_signal_path_uv() {
        let params = PropagationParams {
            mode: PropagationMode::UV,
            frequency: 100.0,
            angle: 30.0,
            iono_height: 300.0,
            earth_radius: 6371.0,
            max_hops: 2,
            critical_frequency: 7.0,
        };
        
        let mut path = vec![0.0f32; 100];
        let mut impacts = vec![0u8; 100];
        
        let count = calculate_signal_path(&params, &mut path, &mut impacts);
        assert!(count >= 2);  // UV 模式应该穿透，路径较短
    }

    #[test]
    fn test_ground_wave_strength() {
        // 低频地波强
        let strength_3mhz = calculate_ground_wave_strength(3.0);
        assert!(strength_3mhz > 10.0);
        
        // 高频地波弱
        let strength_30mhz = calculate_ground_wave_strength(30.0);
        assert!(strength_30mhz < 5.0);
        
        // 超高频无地波
        let strength_100mhz = calculate_ground_wave_strength(100.0);
        assert_eq!(strength_100mhz, 0.0);
    }
}
