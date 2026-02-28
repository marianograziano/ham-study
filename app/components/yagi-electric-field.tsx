import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type InstancedMesh, Matrix4, SphereGeometry } from "three";
import type { Nec2Context } from "~/utils/nec2-c-wasm";

interface YagiElectricFieldProps {
  context: Nec2Context;
  speed?: number;
  amplitudeScale?: number;
  rotation?: [number, number, number];
}

export function YagiElectricField({
  context,
  speed = 1.0,
  amplitudeScale = 1.0,
  rotation = [0, 0, 0],
}: YagiElectricFieldProps) {
  const gridSize = 60; 
  const spacing = 40 / gridSize;
  const count = gridSize * gridSize;

  const meshRef = useRef<InstancedMesh>(null);
  const timeRef = useRef(0);

  // 预计算最大场强参考值，用于规定什么是“红色”
  const maxFieldRef = useMemo(() => {
    return context.get_max_field_reference();
  }, [context]);

  const geometry = useMemo(() => new SphereGeometry(0.08, 6, 6), []);
  const dummyMatrix = useMemo(() => new Matrix4(), []);
  const dummyColor = useMemo(() => new Color(), []);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    
    timeRef.current += delta * 5.0 * speed; 

    const currents = context.get_currents();
    if (currents.length === 0) return;

    // 获取天线的物理高度
    const antennaHeightMeters = currents[0].z;
    const sceneScale = 0.1;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const idx = i * gridSize + j;
        const x_3js = (i - gridSize / 2) * spacing;
        const z_3js = (j - gridSize / 2) * spacing;

        // 计算物理场
        const { instantaneous, amplitude } = context.calculate_field_and_amplitude(
            x_3js, 
            z_3js, 
            antennaHeightMeters / sceneScale, 
            timeRef.current
        );
        
        /**
         * 动态归一化配色逻辑：
         * 我们将当前点的幅度 amplitude 与全场参考最大值 maxFieldRef 进行比较。
         * 
         * normRatio = 1.0 代表这里是全场最强点（红色）。
         * normRatio = 0.0 代表这里几乎没有信号（蓝色）。
         */
        let normRatio = amplitude / (maxFieldRef + 0.001);
        // 使用 power 调整让强弱对比更明显
        normRatio = Math.pow(normRatio, 0.5) * amplitudeScale;
        const weight = Math.max(0, Math.min(1, normRatio));
        
        // 映射 HSL：从 0.6 (蓝色) 减到 0.0 (红色)
        const hue = 0.6 * (1.0 - weight);
        dummyColor.setHSL(hue, 1.0, 0.4);
        meshRef.current.setColorAt(idx, dummyColor);

        // 波动逻辑
        const displayY = (instantaneous / (amplitude + 0.01)) * weight * 2.0;
        const scale = 0.2 + weight * 1.2;
        
        dummyMatrix.makeScale(scale, scale, scale);
        dummyMatrix.setPosition(x_3js, displayY, z_3js);
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
