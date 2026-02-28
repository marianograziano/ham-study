import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type InstancedMesh, Matrix4, SphereGeometry } from "three";
import type { Nec2Context } from "~/utils/nec2-c-wasm";

interface ElectricFieldNec2Props {
  context: Nec2Context;
  speed?: number;
  amplitudeScale?: number;
  rotation?: [number, number, number];
  plane?: "XY" | "YZ" | "XZ";
  visualScale?: number;
  color?: string;
  particleScale?: number;
}

export function ElectricFieldNec2({
  context,
  speed = 1.0,
  amplitudeScale = 1.0,
  rotation = [0, 0, 0],
  plane = "XZ",
  visualScale = 10,
  color,
  particleScale = 1.0,
}: ElectricFieldNec2Props) {
  const gridSize = 60;
  const spacing = 45 / gridSize;
  const count = gridSize * gridSize;

  const meshRef = useRef<InstancedMesh>(null);
  const timeRef = useRef(0);

  const { maxFieldRef, gainScale } = useMemo(() => {
    // 恢复使用动态参考场强，防止场强过小导致波形完全消失
    const maxGain = context.get_max_gain();
    const gScale = 1.0 + Math.max(0, maxGain) * 0.04;
    return {
      maxFieldRef: context.get_max_field_reference(),
      gainScale: gScale,
    };
  }, [context]);

  const geometry = useMemo(() => new SphereGeometry(0.12, 8, 8), []);
  const dummyMatrix = useMemo(() => new Matrix4(), []);
  const dummyColor = new Color();
  const baseColor = useMemo(() => (color ? new Color(color) : null), [color]);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    timeRef.current += delta * 4.0 * speed;

    const center = context.get_center();
    // Use the actual frequency from the context to calculate k_wave
    const freq = context.get_frequency ? context.get_frequency() : (context as any).frequency || 300.0;
    const lambda = 299.79 / freq;
    const k_wave = (2.0 * Math.PI) / lambda;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const idx = i * gridSize + j;
        const c1 = (i - (gridSize - 1) / 2) * spacing;
        const c2 = (j - (gridSize - 1) / 2) * spacing;

        // 计算物理米单位的坐标
        let x_m = center.x;
        let y_m = center.y;
        let z_m = center.z;

        // Three.js 视觉坐标
        let x_3js = 0;
        let y_3js = 0;
        let z_3js = 0;

        if (plane === "XZ") {
          x_m = center.x + c1 / visualScale;
          y_m = center.y + c2 / visualScale;
          z_m = center.z;
          x_3js = c1;
          z_3js = c2;
          y_3js = 0;
        } else if (plane === "XY") {
          x_m = center.x + c1 / visualScale;
          y_m = center.y;
          z_m = center.z + c2 / visualScale;
          x_3js = c1;
          y_3js = c2;
          z_3js = 0;
        } else if (plane === "YZ") {
          x_m = center.x;
          y_m = center.y + c1 / visualScale;
          z_m = center.z + c2 / visualScale;
          x_3js = 0;
          y_3js = c2;
          z_3js = c1;
        }

        const dx = x_m - center.x;
        const dy = y_m - center.y;
        const dz = z_m - center.z;
        const r_dist_m = Math.sqrt(dx * dx + dy * dy + dz * dz); // 物理距离，单位米(也是波长)

        // 传入物理米坐标计算场强
        const { amplitude } = context.calculate_field_and_amplitude(
          x_m,
          y_m,
          z_m,
          timeRef.current,
        );

        // 补偿距离衰减 (E-field drops as 1/r in far field).
        const compensatedAmplitude = amplitude * (r_dist_m + 0.1);

        // 使用开方映射 (Square root mapping) 压缩动态范围。
        // 这会让较弱的区域（如离馈电点较远的顶部）也呈现出较暖的颜色（黄/橙）。
        const rawWeight = compensatedAmplitude / (maxFieldRef + 1e-8);
        const visualWeight = Math.sqrt(Math.max(0, Math.min(1.5, rawWeight)));
        
        const ampWeight = Math.max(
          0,
          Math.min(1.5, visualWeight * amplitudeScale),
        );

        // 相位 (r_dist_m 等同于波长数，因为 300MHz 对应 1m)
        const phase = timeRef.current - k_wave * r_dist_m;
        const sinPhase = Math.sin(phase);

        // 颜色反馈：热力图映射
        const displayWeight = Math.min(
          1,
          ampWeight * (0.3 + 0.7 * Math.abs(sinPhase)),
        );

        if (baseColor) {
          dummyColor.copy(baseColor);
          const hsl = { h: 0, s: 0, l: 0 };
          dummyColor.getHSL(hsl);
          dummyColor.setHSL(hsl.h, hsl.s, 0.15 + displayWeight * 0.7);
        } else {
          // 优化后的热力图映射：让红色和黄色区域更宽
          let hue = 0.66; // 默认深蓝
          
          if (displayWeight < 0.15) {
            hue = 0.66; // 蓝
          } else if (displayWeight < 0.4) {
            hue = 0.66 - ((displayWeight - 0.15) / 0.25) * 0.33; // 蓝 -> 绿
          } else if (displayWeight < 0.7) {
            hue = 0.33 - ((displayWeight - 0.4) / 0.3) * 0.17; // 绿 -> 黄
          } else {
            hue = 0.16 - Math.min(1, (displayWeight - 0.7) / 0.3) * 0.16; // 黄 -> 红
          }

          hue = Math.max(0, Math.min(0.66, hue));

          // 修正导致“粉色”的问题：
          // 之前亮度(lightness)随强度增加而无脑增加，导致红色的亮度过高 (接近0.8)，
          // 在 HSL 中，高亮度的红色就是粉色/白色。
          // 纯正的红色，亮度应该保持在 0.5 左右，饱和度 1.0。

          // 基础亮度是 0.3 (暗色)
          let lightness = 0.3;

          if (displayWeight < 0.5) {
            // 弱场区(蓝绿)，可以稍微亮一点增加可见度
            lightness = 0.3 + displayWeight * 0.4; // 0.3 到 0.5
          } else {
            // 强场区(黄红)，亮度锁定在最鲜艳的 0.5，避免发白变粉
            lightness = 0.5;
          }

          // 如果场强极大，稍微降低一点饱和度或者保持纯红
          const saturation = 1.0;

          dummyColor.setHSL(hue, saturation, lightness);
        }

        meshRef.current.setColorAt(idx, dummyColor);

        // 物理高度起伏
        const waveAmp = ampWeight * gainScale * 2.0;
        const instantaneousHeight = waveAmp * sinPhase;

        // 粒子大小：反映能量密度
        const scale =
          particleScale *
          (0.3 + Math.min(1, ampWeight) * 1.5) *
          (0.8 + 0.2 * Math.abs(sinPhase));

        dummyMatrix.makeScale(scale, scale, scale);

        if (plane === "XZ") {
          dummyMatrix.setPosition(x_3js, instantaneousHeight, z_3js);
        } else if (plane === "XY") {
          dummyMatrix.setPosition(x_3js, y_3js, instantaneousHeight);
        } else if (plane === "YZ") {
          dummyMatrix.setPosition(instantaneousHeight, y_3js, z_3js);
        }

        meshRef.current.setMatrixAt(idx, dummyMatrix);
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor)
      meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      rotation={rotation}
    >
      <meshBasicMaterial toneMapped={false} transparent opacity={0.8} />
    </instancedMesh>
  );
}
