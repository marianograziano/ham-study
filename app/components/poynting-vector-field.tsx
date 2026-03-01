import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Color,
  type InstancedMesh,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import {
  calculatePatternGainGrid,
  initPatternWasm,
} from "~/utils/pattern-wasm";

interface PoyntingVectorFieldProps {
  antennaType:
    | "vertical"
    | "horizontal"
    | "circular"
    | "yagi"
    | "inverted-v"
    | "gp"
    | "positive-v"
    | "quad"
    | "moxon"
    | "elliptical"
    | "end-fed";
  amplitudeScale?: number;
}

export function PoyntingVectorField({
  antennaType,
  amplitudeScale = 1.0,
}: PoyntingVectorFieldProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const gridSize = 30;
  const spacing = 1.5;
  const wasmReady = useRef(false);

  useEffect(() => {
    initPatternWasm()
      .then(() => {
        wasmReady.current = true;
      })
      .catch(() => {
        wasmReady.current = false;
      });
  }, []);

  const gridPositions = useMemo(() => {
    const positions: Vector3[] = [];
    const offset = (gridSize * spacing) / 2;
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = i * spacing - offset;
        const z = j * spacing - offset;
        if (Math.abs(x) < 1 && Math.abs(z) < 1) continue;
        positions.push(new Vector3(x, 0, z));
      }
    }
    return positions;
  }, []);

  const dummy = useMemo(() => new Object3D(), []);

  useFrame(async () => {
    if (!meshRef.current) return;

    let gains: number[];

    if (!wasmReady.current) {
      gains = new Array(gridPositions.length).fill(0);
    } else {
      try {
        const positionsX = gridPositions.map((p) => p.x);
        const positionsZ = gridPositions.map((p) => p.z);
        gains = await calculatePatternGainGrid(
          antennaType,
          positionsX,
          positionsZ,
          0.5,
        );
      } catch {
        wasmReady.current = false;
        gains = new Array(gridPositions.length).fill(0);
      }
    }

    let idx = 0;

    for (let i = 0; i < gridPositions.length; i++) {
      const pos = gridPositions[i];
      const dir = pos.clone().normalize();
      const gain = gains[i];

      const dist = pos.length();
      const visualDecay = 5.0 / (dist + 2.0);
      const magnitude = gain * visualDecay * amplitudeScale;

      if (magnitude < 0.05) {
        dummy.scale.set(0, 0, 0);
      } else {
        dummy.position.copy(pos);

        const targetQ = new Quaternion().setFromUnitVectors(
          new Vector3(0, 1, 0),
          dir,
        );
        dummy.quaternion.copy(targetQ);

        const s = Math.min(0.8, magnitude * 2.0);
        dummy.scale.set(s, s * 2, s);
      }

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(idx, dummy.matrix);
      meshRef.current.setColorAt(idx, new Color(0.1, 0.1, 0.1));

      idx++;
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor)
      meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, gridPositions.length]}
    >
      <coneGeometry args={[0.2, 0.8, 8]} />
      <meshBasicMaterial color="#000000" />
    </instancedMesh>
  );
}
