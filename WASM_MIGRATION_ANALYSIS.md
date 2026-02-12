# WASM 迁移分析报告

## 项目概述

这是一个业余无线电 (Ham Radio) 学习与可视化平台，使用 React + Three.js 进行 3D 渲染。目前已有部分电场计算迁移到了 WASM (Rust)。

## 现有 WASM 实现

### 已迁移的代码

1. **电场强度计算** (`wasm/antenna/src/lib.rs`)
   - 单角度电场计算 (`calculate_field`)
   - 批量电场计算 (`calculate_field_batch`)
   - 辐射图计算 (`calculate_radiation_pattern`)

2. **3D 电场可视化** (`wasm/antenna/src/electric_field.rs`)
   - 100x100 网格的实时电场计算
   - 支持多种天线类型 (Yagi, Quad, Moxon, HB9CV, 等)
   - 支持多种极化类型 (垂直、水平、圆极化、椭圆极化)
   - Windom 天线数值积分计算
   - HSL 到 RGB 颜色转换

---

## 已删除的未使用组件

以下组件已被删除，它们是遗留代码且未被任何页面引用：

- ~~`app/components/continuous-wave-surface.tsx`~~ ❌ 已删除
- ~~`app/components/radial-wave-lines.tsx`~~ ❌ 已删除

这些组件的功能已被 `electromagnetic-propagation-scene.tsx` 中的原生 Three.js 实现替代。

---

## 建议迁移到 WASM 的代码

### 🔴 高优先级 (计算密集型)

#### 1. 电离层传播场景计算 (`app/components/electromagnetic-propagation-scene.tsx`)

**当前状态**: 每帧计算球面几何体、射线相交、粒子动画

**计算内容**:
- **球面几何体生成**: `createSphericalSurfaceGeometry` (64x64 段 = 4,225 顶点)
  - 球坐标转换: `Math.sin(phi) * Math.sin(theta)` 等
  - UV 映射计算
  - 索引生成 (三角形)
- **射线-球体相交**: `intersectSphere` 函数
  - 向量点积、距离计算
  - 二次方程求解
- **信号路径计算**: `updateSignalPath`
  - 入射角计算: `Math.asin((EARTH_RADIUS / ionoR) * Math.cos(rad))`
  - MUF 计算: `CRITICAL_FREQUENCY_FOF2 / Math.cos(incidenceAngle)`
  - 射线反射/折射逻辑
- **动画循环**:
  - 脉冲粒子沿曲线运动 (Catmull-Rom 曲线采样)
  - 散射粒子更新 (15 粒子 x 速度向量)
  - 地面反射波纹动画

**迁移收益**:
- 支持更精细的地球/电离层网格
- 更复杂的射线追踪 (多径、散射)
- 更多粒子效果

**WASM 接口建议**:
```rust
// 球面几何体生成
pub fn generate_spherical_surface(
    radius: f64,
    max_angle: f64,
    spread_angle: f64,
    segments_r: i32,
    segments_w: i32,
    vertices_buffer: &mut [f32],
    uvs_buffer: &mut [f32],
    indices_buffer: &mut [u32],
);

// 射线与球体相交计算
pub fn intersect_sphere_batch(
    ray_origins: &[f32],      // [x, y, z, x, y, z, ...]
    ray_dirs: &[f32],
    sphere_center: &[f32; 3],
    sphere_radius: f64,
    results: &mut [f32],      // 输出交点 [x, y, z, t, ...]
);

// 信号路径计算
pub fn calculate_signal_path(
    mode: &str,               // "HF" | "UV"
    frequency: f64,
    angle: f64,
    iono_height: f64,
    earth_radius: f64,
    max_hops: i32,
    path_points: &mut [f32],  // 输出路径点
) -> i32;  // 返回实际点数
```

---

#### 2. Worker 中的电场计算 (`app/components/electric-field.worker.ts`)

**当前状态**: Web Worker 中运行，但仍是 JavaScript 计算

**计算内容**:
- 10,000 个粒子的位置和颜色计算
- Windom 天线数值积分 (40 段)
- End-Fed 天线方向性计算
- 多种天线类型的增益函数

**迁移收益**:
- 比 Worker 更快的计算速度
- 更精细的网格 (如 200x200 = 40,000 粒子)
- 更复杂的物理模型

**注意**: 已有 `electric-field-wasm.tsx` 组件，但 worker 版本仍在使用。建议统一使用 WASM 版本。

---

### 🟡 中优先级 (频繁调用)

#### 3. Yagi 天线计算器 (`app/lib/yagi-calc.ts`)

**当前状态**: 纯 TypeScript 计算

**计算内容**:
- DL6WU 间距模型
- 元素长度计算
- Boom 校正因子计算 (对数运算)
- 增益估算

**迁移收益**:
- 可以支持更复杂的优化算法
- 批量计算多个设计
- 更精确的电磁建模

**WASM 接口建议**:
```rust
pub fn calculate_yagi_design(
    frequency: f64,
    element_count: i32,
    element_diameter: f64,
    boom_diameter: f64,
    mount_method: &str,
    feed_gap: f64,
    driven_element_type: &str,
    spacing_type: &str,
    manual_spacing: f64,
) -> YagiDesign  // 返回序列化结构
```

---

#### 4. Moxon 天线计算器 (`app/lib/moxon-calc.ts`)

**当前状态**: 多项式回归计算

**计算内容**:
- 对数计算: `Math.log10(ratio)`
- 多项式计算: 3 次多项式 (4 项)
- 尺寸换算

**迁移收益**:
- 可以添加更复杂的 NEC2 数值模拟
- 支持批量参数扫描

---

#### 5. Poynting 向量场 (`app/components/poynting-vector-field.tsx`)

**当前状态**: 30x30 = 900 个箭头的矩阵计算

**计算内容**:
- 方向向量归一化
- 增益计算
- 四元数旋转计算
- 矩阵变换

**迁移收益**:
- 支持更密集的向量场
- 更复杂的矢量计算

---

### 🟢 低优先级 (优化空间小)

#### 6. CW 游戏粒子系统 (`app/components/tools/cw/game/useCwGameLogic.ts`)

**当前状态**: 粒子爆炸效果 (12 粒子 x 角度计算)

**计算内容**:
- 角度计算: `(Math.PI * 2 * i) / 12`
- 速度向量: `Math.cos(angle) * speed`

**迁移收益**: 较小，当前性能已足够

---

#### 7. 各天线场景的辐射图计算

**当前状态**: 多个场景组件中有类似的增益计算

**文件列表**:
- `yagi-antenna-scene.tsx`
- `quad-antenna-scene.tsx`
- `moxon-antenna-scene.tsx`
- `hb9cv-antenna-scene.tsx`
- `magnetic-loop-antenna-scene.tsx`
- `long-wire-antenna-scene.tsx`
- `windom-antenna-scene.tsx`
- `end-fed-antenna-scene.tsx`
- `inverted-v-scene.tsx`
- `positive-v-scene.tsx`
- `dipole-antenna-scene.tsx`

**计算内容**: 各天线类型的方向性函数

**建议**: 统一迁移到 WASM，提供一个通用的辐射图计算接口

---

## 推荐的 WASM 模块结构

```
wasm/
├── antenna/                    # 现有模块
│   ├── src/
│   │   ├── lib.rs             # 现有: 基础电场计算
│   │   ├── electric_field.rs  # 现有: 3D 电场可视化
│   │   ├── propagation.rs     # 新增: 电离层传播计算
│   │   ├── geometry.rs        # 新增: 球面几何体生成
│   │   ├── raytracing.rs      # 新增: 射线追踪
│   │   ├── calculators.rs     # 新增: Yagi/Moxon 计算器
│   │   └── radiation.rs       # 新增: 辐射图计算
│   └── ...
└── physics/                    # 可选: 更复杂的物理模拟
    └── ...
```

---

## 实施建议

### 阶段 1: 高优先级迁移

1. **电离层传播场景** (`electromagnetic-propagation-scene`)
   - 球面几何体生成 (可缓存)
   - 射线相交计算 (每帧调用)
   - 信号路径计算 (参数变化时调用)

2. **统一电场计算**
   - 合并 Worker 和 WASM 版本
   - 移除冗余的 JavaScript 实现

### 阶段 2: 中优先级迁移

3. **天线计算器**
   - 添加更复杂的建模选项
   - 支持批量计算

### 阶段 3: 优化

4. **辐射图统一**
   - 将所有天线方向性函数迁移到 WASM
   - 提供统一的 JavaScript API

---

## 性能预期

| 组件 | 当前 (JS) | 预期 (WASM) | 提升 |
|------|----------|------------|------|
| 球面几何体生成 (64x64) | ~3ms | ~0.5ms | 6x |
| 射线相交计算 | ~1ms | ~0.2ms | 5x |
| 电场网格 (100x100) | 已有 WASM | - | - |
| Yagi 计算 | <1ms | <0.2ms | 5x |

---

## 注意事项

1. **内存管理**: WASM 使用线性内存，需要注意:
   - 预分配足够大的缓冲区
   - 避免频繁的内存增长
   - 使用 `Transferable Objects` 传递大数组

2. **JS/WASM 边界开销**:
   - 批量计算比多次调用更高效
   - 使用 `&[f32]` 和 `&mut [f32]` 传递数组

3. **调试**:
   - 保留 JavaScript 实现作为 fallback
   - 添加性能监控对比

4. **构建**:
   - 确保 `wasm-pack` 配置优化 (`--release`)
   - 考虑使用 `wee_alloc` 减少 WASM 体积
