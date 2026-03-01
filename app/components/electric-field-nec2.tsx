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
  powerExponent?: number;
  lowCutoff?: number;
  /**
   * Whether the visualization plane should tilt to follow the antenna's main lobe.
   */
  followMainLobe?: boolean;
}

export function ElectricFieldNec2({
  context,
  speed = 1.0,
  amplitudeScale = 1.0,
  rotation = [0, 0, 0],
  plane = "XZ",
  visualScale = 10,
  color,
  particleScale = 0.5,
  powerExponent = 0.5,
  lowCutoff = 0.15,
  followMainLobe = false,
}: ElectricFieldNec2Props) {
  const gridSize = 60;
  const spacing = 45 / gridSize;
  const count = gridSize * gridSize;

  const meshRef = useRef<InstancedMesh>(null);
  const timeRef = useRef(0);

  const { maxFieldRef, gainScale, lobeDir } = useMemo(() => {
    const maxGain = context.get_max_gain();
    const gScale = 1.0 + Math.max(0, maxGain) * 0.04;
    const ref = context.get_max_field_reference();
    const dir = context.get_max_gain_direction
      ? context.get_max_gain_direction()
      : { theta: 90, phi: 0 };
    return {
      maxFieldRef: ref,
      gainScale: gScale,
      lobeDir: dir,
    };
  }, [context]);

  const geometry = useMemo(() => new SphereGeometry(0.08, 8, 8), []);
  const dummyMatrix = useMemo(() => new Matrix4(), []);
  const dummyColor = new Color();
  const baseColor = useMemo(() => (color ? new Color(color) : null), [color]);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    timeRef.current += delta * 4.0 * speed;

    const center = context.get_center();
    const freq = context.get_frequency();
    const lambda = 299.79 / freq;
    const k_wave = (2.0 * Math.PI) / lambda;

    // Pre-calculate lobe plane vectors
    const thetaRad = (lobeDir.theta * Math.PI) / 180;
    const phiRad = (lobeDir.phi * Math.PI) / 180;

    // Peak direction vector (Radial)
    const sinT = Math.sin(thetaRad);
    const cosT = Math.cos(thetaRad);
    const sinP = Math.sin(phiRad);
    const cosP = Math.cos(phiRad);

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const idx = i * gridSize + j;
        const c1 = (i - (gridSize - 1) / 2) * spacing;
        const c2 = (j - (gridSize - 1) / 2) * spacing;

        let x_m = center.x;
        let y_m = center.y;
        let z_m = center.z;

        let x_3js = c1;
        let y_3js = 0;
        let z_3js = c2;

        if (followMainLobe) {
          // Grid c1 is "Forward/Backward" along the lobe axis
          // Grid c2 is "Side-to-Side"
          x_m =
            center.x +
            (c1 / visualScale) * sinT * cosP -
            (c2 / visualScale) * sinP;
          y_m =
            center.y +
            (c1 / visualScale) * sinT * sinP +
            (c2 / visualScale) * cosP;
          z_m = center.z + (c1 / visualScale) * cosT;
        } else {
          if (plane === "XZ") {
            x_m = center.x + c1 / visualScale;
            y_m = center.y + c2 / visualScale;
            z_m = center.z;
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
        }

        const dx = x_m - center.x;
        const dy = y_m - center.y;
        const dz = z_m - center.z;
        const r_dist_m = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const { amplitude } = context.calculate_field_and_amplitude(
          x_m,
          y_m,
          z_m,
          timeRef.current,
        );

        const compensatedAmplitude = amplitude * (r_dist_m + 0.1);
        const rawWeight = compensatedAmplitude / (maxFieldRef + 1e-8);
        const visualWeight =
          Math.max(0, Math.min(1.5, rawWeight)) ** powerExponent;
        const ampWeight = Math.max(
          0,
          Math.min(1.5, visualWeight * amplitudeScale),
        );

        const phase = timeRef.current - k_wave * r_dist_m;
        const sinPhase = Math.sin(phase);
        const displayWeight = Math.min(
          1,
          ampWeight * (0.05 + 0.95 * Math.abs(sinPhase)),
        );

        if (baseColor) {
          dummyColor.copy(baseColor);
          const hsl = { h: 0, s: 0, l: 0 };
          dummyColor.getHSL(hsl);
          dummyColor.setHSL(hsl.h, hsl.s, 0.15 + displayWeight * 0.7);
        } else {
          let hue = 0.66;
          if (displayWeight < lowCutoff) {
            hue = 0.66;
          } else if (displayWeight < 0.45) {
            hue =
              0.66 - ((displayWeight - lowCutoff) / (0.45 - lowCutoff)) * 0.33;
          } else if (displayWeight < 0.75) {
            hue = 0.33 - ((displayWeight - 0.45) / 0.3) * 0.17;
          } else {
            hue = 0.16 - Math.min(1, (displayWeight - 0.75) / 0.25) * 0.16;
          }
          hue = Math.max(0, Math.min(0.66, hue));
          let lightness = 0.3;
          if (displayWeight < 0.5) lightness = 0.3 + displayWeight * 0.4;
          else lightness = 0.5;
          dummyColor.setHSL(hue, 1.0, lightness);
        }

        meshRef.current.setColorAt(idx, dummyColor);

        const waveAmp = ampWeight * gainScale * 2.0;
        const instantaneousHeight = waveAmp * sinPhase;
        const scale =
          particleScale *
          (0.3 + Math.min(1, ampWeight) * 1.5) *
          (0.8 + 0.2 * Math.abs(sinPhase));

        dummyMatrix.makeScale(scale, scale, scale);

        if (followMainLobe) {
          // Three.js visual coordinates:
          // We still want to show a horizontal-ish grid for intuition,
          // but its *position* and *offset* reflect the tilt.
          // Or better: we tilt the THREE.JS mesh to match the NEC plane.
          dummyMatrix.setPosition(x_3js, instantaneousHeight, z_3js);
        } else {
          if (plane === "XZ")
            dummyMatrix.setPosition(x_3js, instantaneousHeight, z_3js);
          else if (plane === "XY")
            dummyMatrix.setPosition(x_3js, y_3js, instantaneousHeight);
          else if (plane === "YZ")
            dummyMatrix.setPosition(instantaneousHeight, y_3js, z_3js);
        }

        meshRef.current.setMatrixAt(idx, dummyMatrix);
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor)
      meshRef.current.instanceColor.needsUpdate = true;
  });

  // Calculate visual rotation for the entire instanced mesh if following main lobe
  const visualRotation: [number, number, number] = useMemo(() => {
    if (!followMainLobe) return rotation;
    // NEC Theta=90 (Horizontal) -> Three.js Rotation=0
    // NEC Theta=75 (15 deg up) -> Three.js Rotation = -15 deg around Z
    // (Assuming boom is X, we rotate around Side-to-Side axis Y or Z)
    // In our XZ plane mapping, boom is X, side is Z. Rotation should be around Z.
    const elevation = (90 - lobeDir.theta) * (Math.PI / 180);
    return [0, 0, elevation];
  }, [followMainLobe, lobeDir, rotation]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      rotation={visualRotation}
    >
      <meshBasicMaterial toneMapped={false} transparent opacity={0.8} />
    </instancedMesh>
  );
}
