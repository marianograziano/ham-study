import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type InstancedMesh, Matrix4, SphereGeometry } from "three";
import type { Nec2Context } from "~/utils/nec2-c-wasm";

interface ElectricFieldNec2Props {
  context: Nec2Context;
  speed?: number;
  amplitudeScale?: number;
  rotation?: [number, number, number];
}

export function ElectricFieldNec2({
  context,
  speed = 1.0,
  amplitudeScale = 1.0,
  rotation = [0, 0, 0],
}: ElectricFieldNec2Props) {
  const gridSize = 60; 
  const spacing = 45 / gridSize;
  const count = gridSize * gridSize;

  const meshRef = useRef<InstancedMesh>(null);
  const timeRef = useRef(0);

  const { maxFieldRef, gainScale } = useMemo(() => {
    const maxGain = context.get_max_gain();
    // 缩减增益对视觉的影响，避免过曝
    const gScale = 1.0 + Math.max(0, maxGain) * 0.04;
    return {
      maxFieldRef: context.get_max_field_reference(),
      gainScale: gScale
    };
  }, [context]);

  const geometry = useMemo(() => new SphereGeometry(0.08, 6, 6), []);
  const dummyMatrix = useMemo(() => new Matrix4(), []);
  const dummyColor = new Color();

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    
    timeRef.current += delta * 5.0 * speed; 

    const currents = context.get_currents();
    if (currents.length === 0) return;

    const center = context.get_center();
    const sceneScale = 0.1;
    const cx = center.x / sceneScale;
    const cy = center.y / sceneScale;
    const cz = center.z / sceneScale;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const idx = i * gridSize + j;
        const c1 = (i - gridSize / 2) * spacing;
        const c2 = (j - gridSize / 2) * spacing;

        const x_nec = cx + c1;
        const y_nec = cy + c2;
        const z_nec = cz;
        const x_3js = c1;
        const z_3js = c2;

        const { instantaneous, amplitude } = context.calculate_field_and_amplitude(
            x_nec, y_nec, z_nec, timeRef.current
        );
        
        // 1. 计算权重
        const normRatio = (amplitude / (maxFieldRef + 1e-6)) * amplitudeScale;
        const weight = Math.max(0, Math.min(1, Math.pow(normRatio, 1.2)));
        
        /**
         * 2. 精确色彩映射 (HSL)
         * 蓝(0.66) -> 绿(0.33) -> 黄(0.16) -> 橙(0.08) -> 红(0.0)
         */
        let hue = 0.66;
        if (weight < 0.3) {
            // 蓝 -> 绿
            hue = 0.66 - (weight / 0.3) * 0.33;
        } else if (weight < 0.6) {
            // 绿 -> 黄
            hue = 0.33 - ((weight - 0.3) / 0.3) * 0.17;
        } else if (weight < 0.8) {
            // 黄 -> 橙
            hue = 0.16 - ((weight - 0.6) / 0.2) * 0.08;
        } else {
            // 橙 -> 红
            hue = 0.08 - ((weight - 0.8) / 0.2) * 0.08;
        }

        // 限制 Hue 范围防止溢出到紫色
        hue = Math.max(0, Math.min(0.66, hue));

        // 3. 锁定亮度：0.5 是最纯的颜色。
        // 低强度时稍微暗一点增加深邃感，高强度时保持 0.5 确保“正红”
        const lightness = 0.35 + weight * 0.15;
        
        dummyColor.setHSL(hue, 1.0, lightness);
        meshRef.current.setColorAt(idx, dummyColor);

        // 4. 波浪起伏
        const waveAmp = (instantaneous / (maxFieldRef + 1e-6)) * amplitudeScale * gainScale;
        
        // 5. 粒子大小
        const scale = (0.12 + weight * 1.1) * (0.85 + gainScale * 0.15);
        
        dummyMatrix.makeScale(scale, scale, scale);
        dummyMatrix.setPosition(x_3js, waveAmp * 2.5, z_3js);
        meshRef.current.setMatrixAt(idx, dummyMatrix);
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
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
