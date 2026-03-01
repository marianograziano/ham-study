import { useEffect, useState } from "react";
import { type BufferGeometry, SphereGeometry, Vector3 } from "three";
import type { Nec2Context } from "~/utils/nec2-c-wasm";

interface RadiationPatternProps {
  context: Nec2Context | null;
  scale?: number;
  color?: string;
  opacity?: number;
}

export default function RadiationPattern({
  context,
  scale = 10,
  color = "#22c55e",
  opacity = 0.2,
}: RadiationPatternProps) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);

  useEffect(() => {
    if (!context) return;

    const generateGeometry = () => {
      const geo = new SphereGeometry(1, 60, 40);
      const posAttribute = geo.attributes.position;
      const vertex = new Vector3();

      const count = posAttribute.count;
      const thetas = new Float64Array(count);
      const phis = new Float64Array(count);
      const gains = new Float64Array(count);

      // Map Three.js sphere vertices to NEC2 coordinates
      for (let i = 0; i < count; i++) {
        vertex.fromBufferAttribute(posAttribute, i);
        vertex.normalize();

        // Theta: 0 is Up (+Y in Three.js, +Z in NEC)
        const theta = Math.acos(Math.max(-1, Math.min(1, vertex.y)));

        // Phi: 0 is NEC +X (Three.js +X)
        // atan2(Three Z, Three X) -> Three Z is NEC +Y, Three X is NEC +X
        let phi = Math.atan2(vertex.z, vertex.x);
        if (phi < 0) phi += 2 * Math.PI;

        thetas[i] = theta;
        phis[i] = phi;
      }

      context.calculate_far_field_pattern_3d(thetas, phis, gains);

      let maxLinearG = 0.01;
      for (let i = 0; i < count; i++) {
        if (gains[i] > maxLinearG) maxLinearG = gains[i];
      }

      // Visual scaling based on gain
      const maxDbi = context.get_max_gain();
      const visualBaseScale = scale * (0.8 + Math.max(0, maxDbi) * 0.05);

      for (let i = 0; i < count; i++) {
        const power = gains[i] / maxLinearG;
        // Apply power-based radius (with a small base radius for nulls)
        const rad = (0.1 + power * 0.9) * visualBaseScale;
        vertex.fromBufferAttribute(posAttribute, i);
        vertex.normalize();
        posAttribute.setXYZ(i, vertex.x * rad, vertex.y * rad, vertex.z * rad);
      }

      geo.computeVertexNormals();
      setGeometry(geo);
    };

    generateGeometry();
  }, [context, scale]);

  if (!geometry) return null;

  return (
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={color}
          wireframe={true}
          transparent={true}
          opacity={opacity}
        />
      </mesh>
    </group>
  );
}
