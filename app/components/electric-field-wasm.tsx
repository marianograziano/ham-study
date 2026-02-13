import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { type InstancedMesh, SphereGeometry } from "three";
import initWasm, {
  calculate_electric_field,
} from "wasm/antenna/pkg/antenna?init";

interface ElectricFieldWasmProps {
  antennaType: string;
  polarizationType: "vertical" | "horizontal" | "circular" | "elliptical";
  speed?: number;
  amplitudeScale?: number;
  isRHCP?: boolean;
  antennaLength?: number;
  radialAngle?: "60" | "135" | string;
  activeHarmonic?: number;
  isInvertedV?: boolean;
  rotation?: [number, number, number];
}

export function ElectricFieldWasm(props: ElectricFieldWasmProps) {
  const {
    antennaType,
    polarizationType,
    speed = 1.0,
    amplitudeScale = 1.0,
    isRHCP = true,
    antennaLength = 2.5,
    radialAngle,
    activeHarmonic,
    isInvertedV = false,
    rotation = [0, 0, 0],
  } = props;

  // WASM initialization state
  const [wasmReady, setWasmReady] = useState(false);
  const wasmInitRef = useRef<Promise<void> | null>(null);

  // Initialize WASM once
  useEffect(() => {
    if (!wasmInitRef.current) {
      wasmInitRef.current = initWasm()
        .then(() => {
          setWasmReady(true);
        })
        .catch((err) => {
          console.error("Failed to initialize WASM:", err);
        });
    }
    return () => {
      // Cleanup not needed for WASM
    };
  }, []);

  // Dense Grid for "Field Fabric"
  const gridSize = 100; // 100x100 = 10,000 particles
  const spacing = 40 / gridSize; // Cover 40 units
  const count = gridSize * gridSize;

  const meshRef = useRef<InstancedMesh>(null);

  // Time tracking
  const timeRef = useRef(0);

  // Buffers for calculation
  const matrixBuffer = useRef<Float32Array>(new Float32Array(count * 16));
  const colorBuffer = useRef<Float32Array>(new Float32Array(count * 3));

  // Buffers for Initial Render (Static)
  const initialColorArray = useMemo(() => new Float32Array(count * 3), [count]);

  // Small Spheres
  const geometry = useMemo(
    () => new SphereGeometry(0.05, 6, 6), // Low poly spheres
    [],
  );

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    // Optimization for demand mode:
    // If speed is 0 (static thumbnail), we can skip calculations
    if (speed === 0) return;
    if (!wasmReady) return;

    timeRef.current += delta * 1.0 * speed;

    try {
      // Call WASM function to calculate electric field
      calculate_electric_field(
        antennaType,
        polarizationType,
        speed,
        amplitudeScale,
        isRHCP,
        antennaLength,
        radialAngle ?? "",
        activeHarmonic ?? 1,
        isInvertedV,
        timeRef.current,
        gridSize,
        spacing,
        matrixBuffer.current,
        colorBuffer.current,
      );

      // Update Mesh with calculated data
      if (meshRef.current) {
        meshRef.current.instanceMatrix.array.set(matrixBuffer.current);
        meshRef.current.instanceMatrix.needsUpdate = true;

        if (meshRef.current.instanceColor) {
          meshRef.current.instanceColor.array.set(colorBuffer.current);
          meshRef.current.instanceColor.needsUpdate = true;
        }
      }
    } catch (err) {
      console.error("Error calculating electric field:", err);
    }
  });

  // Cleanup geometry on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      rotation={rotation}
    >
      <meshBasicMaterial toneMapped={false} />
      <instancedBufferAttribute
        attach="instanceColor"
        args={[initialColorArray, 3]}
      />
    </instancedMesh>
  );
}
