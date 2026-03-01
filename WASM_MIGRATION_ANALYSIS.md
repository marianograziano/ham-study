# WASM 迁移分析报告 (已更新)

## 项目概述

这是一个业余无线电 (Ham Radio) 学习与可视化平台。为了提升计算性能，项目已完成从纯 JavaScript 到 WASM 的核心迁移。

## 现有 WASM 实现

目前项目使用两种 WASM 引擎：

### 1. NEC2 C 引擎 (核心引擎)
- **位置**: `public/wasm/nec2c.wasm` (由 `wasm/antenna/third_party/nec2c_repo` 编译)
- **用途**: 负责所有真实的天线物理模拟、3D 远场方向图、阻抗计算以及电流分布。
- **JS 封装**: `app/utils/nec2-c-wasm.ts` (`Nec2Context`)

### 2. Rust WASM 模块 (专用计算)
- **位置**: `wasm/antenna/`
- **用途**:
  - **天线尺寸设计**: Yagi (`yagi_calc.rs`) 和 Moxon (`moxon_calc.rs`) 的尺寸自动生成。
  - **电离层传播**: HF 信号路径追踪 (`propagation.rs`)。
  - **3D 电场可视化**: 极化场景下的实时粒子场计算 (`electric_field.rs`)。
  - **Poynting 向量场**: 快速方向图增益计算 (`antenna_pattern.rs`)。

---

## 已清理的冗余代码

为了保持 codebase 整洁，以下冗余/过时的实现已被移除：

1. **Rust NEC 实验性实现**: 早期尝试用 Rust 重写 NEC2 的代码 (`wasm/antenna/src/nec/`) 已删除，统一使用成熟的 `nec2c` C 引擎。
2. **经验公式封装**: 基于简化公式的 `radiation.rs` 和 `antenna-physics-wasm.ts` 已删除，现在统一使用 NEC2 模拟。
3. **遗留脚本**: `reproduce_yagi_calculate.js` 等依赖旧版 NecContext 的脚本已删除。

---

## 性能预期

| 组件 | 之前 (JS) | 当前 (WASM) | 提升 |
|------|----------|------------|------|
| NEC2 仿真 (19 段) | ~200ms | ~20ms | 10x |
| 电场网格 (100x100) | ~50ms | ~5ms | 10x |
| Yagi 尺寸计算 | ~1ms | ~0.1ms | 10x |

---

## 注意事项

1. **构建流程**:
   - 修改 Rust 代码后需运行 `wasm-pack build`。
   - 修改 `nec2c` C 代码后需运行 `./compile_nec2_wasm.sh`。

2. **调用效率**:
   - 对于电场粒子系统，通过 WASM 直接操作 `Float32Array` 缓冲区，避免 JS 对象的频繁分配。
