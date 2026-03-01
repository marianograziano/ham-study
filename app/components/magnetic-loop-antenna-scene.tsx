import { Camera } from "@phosphor-icons/react";
import { ArcballControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  type BufferGeometry,
  Color,
  type InstancedMesh,
  Matrix4,
  SphereGeometry,
  Vector3,
} from "three";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Switch } from "~/components/ui/switch";
import { Nec2Context } from "~/utils/nec2-c-wasm";

/**
 * Specialized field renderer for Magnetic Loop.
 */
function MagneticLoopElectricField({
  context,
  speed = 1.0,
  visualScale = 4.0,
  particleScale = 0.9,
  offsetX = 0.0,
}: {
  context: Nec2Context;
  speed?: number;
  visualScale?: number;
  particleScale?: number;
  offsetX?: number;
}) {
  const gridSize = 64;
  const spacing = 50 / gridSize;
  const count = gridSize * gridSize;

  const meshRef = useRef<InstancedMesh>(null);
  const timeRef = useRef(0);

  // Pre-calculate visual normalization constants once per simulation update
  const { maxGainLin, localMaxField } = useMemo(() => {
    if (!context) return { maxGainLin: 1.0, localMaxField: 1.0 };
    const maxDbi = context.get_max_gain();
    const center = context.get_center();

    // Robust sampling of lobe peaks across the vertical plane
    let maxV = 1e-9;
    const testPoints = [
      { x: 0, z: 1.5 },
      { x: 1.2, z: 1.2 },
      { x: -1.2, z: 1.2 },
      { x: 0, z: 2.5 },
    ];
    for (const pt of testPoints) {
      const { amplitude } = context.calculate_field_and_amplitude(
        center.x + pt.x,
        center.y,
        center.z + pt.z,
        0,
      );
      if (amplitude > maxV) maxV = amplitude;
    }

    return {
      maxGainLin: 10 ** (maxDbi / 10),
      localMaxField: Math.max(1e-6, maxV * 1.2),
    };
  }, [context]);

  const geometry = useMemo(() => new SphereGeometry(0.12, 6, 6), []);
  const dummyMatrix = useMemo(() => new Matrix4(), []);
  const dummyColor = new Color();

  useFrame((_state, delta) => {
    if (!meshRef.current || !context) return;
    timeRef.current += delta * 15.0 * speed;

    const center = context.get_center();
    const freq = context.get_frequency();
    const lambda = 299.79 / freq;
    const k_wave_visual = (2.0 * Math.PI) / (lambda * 0.12);

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const idx = i * gridSize + j;
        const cX = (i - (gridSize - 1) / 2) * spacing;
        const cY = (j - (gridSize - 1) / 2) * spacing;

        const r_visual = Math.sqrt(cX * cX + cY * cY);
        const r_dist_m = r_visual / visualScale + 0.1;

        // 1. Angular sampling for Far-Field alignment
        const theta_rad = Math.acos(
          Math.max(-1, Math.min(1, cY / (r_visual + 1e-6))),
        );
        const theta_deg = Math.round((theta_rad * 180) / Math.PI / 5) * 5;
        const phi_deg = cX >= 0 ? 0 : 180;

        // 2. Combine Near-field amplitude with Far-field gain pattern
        const { instantaneous, amplitude } =
          context.calculate_field_and_amplitude(
            center.x + cX / visualScale,
            center.y,
            center.z + cY / visualScale,
            timeRef.current,
          );

        const gainLin = context.get_gain_at?.(theta_deg, phi_deg) ?? 1.0;
        const gainWeight = 0.35 + 0.65 * Math.sqrt(gainLin / maxGainLin);

        // 3. Normalization and Contrast
        const norm = Math.min(
          1.8,
          (amplitude * (r_dist_m * 0.5 + 0.2)) / (localMaxField + 1e-12),
        );

        // --- FIXED MASK LOGIC ---
        // Hide only the very center inductive field where r < 0.15m (physical)
        const mask = r_dist_m < 0.2 ? 0 : 1.0;

        // Balanced contrast: clear background subtraction (baseline 0.25)
        const visualWeight =
          Math.max(0, (norm - 0.25) / 0.75) ** 1.5 * gainWeight * mask;
        const ampWeight = visualWeight * 20.0;

        const phase = timeRef.current - k_wave_visual * r_dist_m;
        const sinPhase = Math.sin(phase);
        const displayWeight = Math.min(
          1.0,
          ampWeight * (0.15 + 0.85 * Math.abs(sinPhase)),
        );

        // Color mapping: Blue (0.66) -> Green -> Yellow -> Red (0.0)
        let hue = 0.66;
        if (displayWeight > 0.05) {
          // Accelerate transition to reach Red (0.0) faster
          hue = 0.66 - Math.min(0.66, ((displayWeight - 0.05) / 0.65) * 0.66);
        }

        // Lower max lightness to 0.5 to keep colors saturated (Red, not Pink)
        const lightness = displayWeight < 0.01 ? 0 : 0.1 + displayWeight * 0.4;
        dummyColor.setHSL(Math.max(0, Math.min(0.66, hue)), 1.0, lightness);
        meshRef.current.setColorAt(idx, dummyColor);

        // Transform
        const s = particleScale * (0.15 + Math.min(0.85, ampWeight * 0.6));
        dummyMatrix.makeScale(s, s, s);

        const waveAmp = ampWeight * 0.05;
        const zDisplacement = (instantaneous / (amplitude + 1e-8)) * waveAmp;

        dummyMatrix.setPosition(cX, cY, zDisplacement + offsetX);
        meshRef.current.setMatrixAt(idx, dummyMatrix);
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor)
      meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]}>
      <meshBasicMaterial toneMapped={false} transparent opacity={0.8} />
    </instancedMesh>
  );
}

function MagneticLoopAntenna({
  radius = 2,
  scale = 1,
}: {
  radius?: number;
  scale?: number;
}) {
  return (
    <group scale={[scale, scale, scale]}>
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[radius, 0.05, 16, 100]} />
        <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.8} />
      </mesh>
      <group position={[0, radius, 0]}>
        <mesh>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
      </group>
      <group position={[0, -radius, 0]}>
        <mesh position={[0, radius * 0.2, 0]}>
          <torusGeometry args={[radius * 0.2, 0.03, 16, 50]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      </group>
      <mesh position={[0, -radius - 1, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 2, 16]} />
        <meshStandardMaterial color="#444" />
      </mesh>
    </group>
  );
}

function RadiationPattern({ context }: { context: Nec2Context | null }) {
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
      for (let i = 0; i < count; i++) {
        vertex.fromBufferAttribute(posAttribute, i);
        vertex.normalize();
        const theta = Math.acos(Math.max(-1, Math.min(1, vertex.y)));
        let phi = Math.atan2(vertex.z, vertex.x);
        if (phi < 0) phi += 2 * Math.PI;
        thetas[i] = theta;
        phis[i] = phi;
      }
      context.calculate_far_field_pattern_3d(thetas, phis, gains);
      let maxLinearG = 0.01;
      for (let i = 0; i < count; i++)
        if (gains[i] > maxLinearG) maxLinearG = gains[i];
      const maxDbi = context.get_max_gain();
      const visualBaseScale = 7.5 + Math.max(0, maxDbi) * 0.7;
      for (let i = 0; i < count; i++) {
        const power = gains[i] / maxLinearG;
        const rad = (0.2 + power * 0.8) * visualBaseScale;
        vertex.fromBufferAttribute(posAttribute, i);
        vertex.normalize();
        posAttribute.setXYZ(i, vertex.x * rad, vertex.y * rad, vertex.z * rad);
      }
      geo.computeVertexNormals();
      setGeometry(geo);
    };
    generateGeometry();
  }, [context]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color="#22c55e"
        wireframe={true}
        transparent={true}
        opacity={0.2}
      />
    </mesh>
  );
}

export default function MagneticLoopAntennaScene({
  isThumbnail = false,
  isHovered = false,
}: {
  isThumbnail?: boolean;
  isHovered?: boolean;
}) {
  const { t } = useTranslation("scene");
  const [groundHeight, setGroundHeight] = useState(0.0);
  const [material, setMaterial] = useState<string>("copper");
  const [showWaves, setShowWaves] = useState(true);
  const [showPattern, setShowPattern] = useState(true);
  const [speedMode, setSpeedMode] = useState<"slow" | "medium" | "fast">(
    "medium",
  );
  const [context, setContext] = useState<Nec2Context | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [impedance, setImpedance] = useState<{ re: number; im: number } | null>(
    null,
  );
  const [maxGain, setMaxGain] = useState<number>(0);
  const uniqueId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const radius = 0.6;
  const visualScale = 4.0;

  useEffect(() => {
    let active = true;
    const runSimulation = async () => {
      setIsCalculating(true);
      try {
        const ctx = new Nec2Context();
        ctx.initialize(1);
        const freq = 14.2;
        ctx.set_frequency(freq);
        ctx.set_material(material);
        const lambda = 299.79 / freq;
        const h_m = groundHeight * lambda;
        if (groundHeight > 0) ctx.set_ground(groundHeight);
        const z_offset = groundHeight > 0 ? h_m + radius : radius + 1.0;
        const sides = 40;
        const points: [number, number, number][] = [];
        const segmentAngle = (2 * Math.PI) / sides;
        for (let i = 0; i <= sides; i++) {
          const angle = i * segmentAngle - Math.PI / 2 - segmentAngle / 2;
          points.push([
            radius * Math.cos(angle),
            0,
            radius * Math.sin(angle) + z_offset,
          ]);
        }
        for (let i = 0; i < sides; i++) {
          ctx.add_wire(
            points[i][0],
            points[i][1],
            points[i][2],
            points[i + 1][0],
            points[i + 1][1],
            points[i + 1][2],
            0.01,
            3,
            i + 1,
          );
        }
        const L_approx =
          4e-7 * Math.PI * radius * (Math.log((8 * radius) / 0.01) - 2);
        const XL = 2 * Math.PI * freq * 1e6 * L_approx;
        ctx.add_load(0, 21, 2, 0.0, -XL);
        ctx.add_voltage_source(1, 2, 100.0, 0.0);
        await ctx.calculate();
        if (active) {
          const zArr = ctx.get_impedance(1);
          setImpedance({ re: zArr[0], im: zArr[1] });
          setMaxGain(ctx.get_max_gain());
          setContext(ctx);
        }
      } catch (err) {
        console.error("NEC Error:", err);
      } finally {
        if (active) setIsCalculating(false);
      }
    };
    const timer = setTimeout(runSimulation, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [groundHeight, material]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement("a");
      link.download = "magnetic-loop-antenna.png";
      link.href = canvasRef.current.toDataURL("image/png");
      link.click();
    }
  };

  const effectiveSpeed =
    isThumbnail && !isHovered
      ? 0
      : { slow: 0.3, medium: 0.6, fast: 1.0 }[speedMode];
  const gridY = -radius - (groundHeight > 0 ? 0 : 1);

  const LegendPanel = () => (
    <div className="p-4 bg-black/70 text-white rounded-lg md:max-w-xs h-full border border-white/5">
      <h2 className="text-lg font-bold mb-2">
        {t("magneticLoopAntenna.title")}
      </h2>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        <Trans
          ns="scene"
          i18nKey="magneticLoopAntenna.desc"
          components={{ br: <br /> }}
        />
      </p>
      <div className="space-y-1.5 text-xs border-t border-gray-600 pt-2 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-sm" />
          <span>{t("magneticLoopAntenna.loop")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-300 rounded-sm" />
          <span>{t("magneticLoopAntenna.capacitor")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-green-500 rounded-sm" />
          <span>{t("magneticLoopAntenna.pattern")}</span>
        </div>
      </div>
      <div className="mt-2 pt-3 border-t border-gray-600">
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
            {t("common.simulation.strength")}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-blue-600 via-green-500 via-yellow-400 to-red-600" />
      </div>
    </div>
  );

  const ControlsPanel = () => (
    <div className="p-4 bg-black/70 text-white rounded-lg w-full h-full border border-white/5">
      <div className="flex flex-col space-y-4">
        <div className="bg-zinc-900/50 p-3 rounded border border-white/5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] text-zinc-400 mb-0.5">
                {t("common.simulation.peakGain")}
              </div>
              <div className="text-xs font-mono text-green-400">
                {isCalculating ? "..." : `${maxGain.toFixed(2)} dBi`}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-400 mb-0.5">
                {t("common.simulation.impedance")}
              </div>
              <div className="text-xs font-mono text-zinc-300">
                {isCalculating
                  ? "..."
                  : impedance
                    ? `${impedance.re.toFixed(1)}Ω`
                    : "--"}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-300">
              {t("common.simulation.material")}
            </div>
            <RadioGroup
              value={material}
              onValueChange={setMaterial}
              className="flex gap-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="copper"
                  id={`${uniqueId}m-cu`}
                  className="peer size-3"
                />
                <Label
                  htmlFor={`${uniqueId}m-cu`}
                  className="text-[11px] text-zinc-400 peer-data-[state=checked]:text-white"
                >
                  {t("common.simulation.copper")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="aluminum"
                  id={`${uniqueId}m-al`}
                  className="peer size-3"
                />
                <Label
                  htmlFor={`${uniqueId}m-al`}
                  className="text-[11px] text-zinc-400 peer-data-[state=checked]:text-white"
                >
                  {t("common.simulation.aluminum")}
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="pt-2 border-t border-white/5">
            <div className="mb-2 text-xs font-medium text-zinc-300">
              {t("common.simulation.groundHeight")}
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={groundHeight}
                onChange={(e) =>
                  setGroundHeight(Number.parseFloat(e.target.value))
                }
                className="w-full accent-blue-500 h-1"
              />
              <span className="text-[10px] text-zinc-400 w-8 text-right font-mono">
                {groundHeight === 0
                  ? t("common.simulation.freeSpace")
                  : groundHeight.toFixed(1)}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-white/5">
            <div className="mb-2 text-xs font-medium text-zinc-300">
              {t("common.controls.speed")}
            </div>
            <RadioGroup
              value={speedMode}
              onValueChange={(v) =>
                setSpeedMode(v as "slow" | "medium" | "fast")
              }
              className="flex gap-3"
            >
              {["slow", "medium", "fast"].map((s) => (
                <div key={s} className="flex items-center space-x-1.5">
                  <RadioGroupItem
                    value={s}
                    id={`${uniqueId}r-${s}`}
                    className="peer size-3 border-zinc-500 data-[state=checked]:border-white data-[state=checked]:text-white"
                  />
                  <Label
                    htmlFor={`${uniqueId}r-${s}`}
                    className="text-[11px] cursor-pointer text-zinc-400 peer-data-[state=checked]:text-white"
                  >
                    {t(`common.controls.${s}` as any)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="pt-2 border-t border-white/5 flex flex-col space-y-2 pb-2">
            <div className="flex items-center justify-between group">
              <Label
                htmlFor={`${uniqueId}wave-mode`}
                className="text-[11px] text-zinc-400"
              >
                {t("common.controls.showWaves")}
              </Label>
              <Switch
                id={`${uniqueId}wave-mode`}
                checked={showWaves}
                onCheckedChange={setShowWaves}
                className="scale-75"
              />
            </div>
            <div className="flex items-center justify-between group">
              <Label
                htmlFor={`${uniqueId}pattern-mode`}
                className="text-[11px] text-zinc-400"
              >
                {t("common.controls.showPattern")}
              </Label>
              <Switch
                id={`${uniqueId}pattern-mode`}
                checked={showPattern}
                onCheckedChange={setShowPattern}
                className="scale-75"
              />
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="w-full h-8 text-[11px]"
          onClick={handleDownload}
        >
          <Camera className="mr-2 size-3.5" /> {t("common.controls.download")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`relative w-full ${isThumbnail ? "h-full" : "h-[450px] md:h-[600px]"} border rounded-lg overflow-hidden bg-black touch-none`}
      >
        <Canvas
          ref={canvasRef}
          gl={{ preserveDrawingBuffer: true }}
          camera={{ position: [24, 16, 32], fov: 45 }}
          frameloop={isThumbnail && !isHovered ? "demand" : "always"}
        >
          <color attach="background" args={["#111111"]} />
          <fog attach="fog" args={["#111111", 100, 1000]} />
          {!isThumbnail && <ArcballControls target={[0, 0, 0]} makeDefault />}
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 10]} intensity={1} />
          <axesHelper args={[5]} />
          <gridHelper
            args={[20, 20, 0x333333, 0x222222]}
            position={[0, gridY, 0]}
          />
          <group position={[0, 0, 0]}>
            <MagneticLoopAntenna radius={radius} scale={visualScale} />
            {showPattern && context && <RadiationPattern context={context} />}
            {showWaves && context && (
              <MagneticLoopElectricField
                context={context}
                speed={effectiveSpeed}
                visualScale={visualScale}
                offsetX={0.0}
              />
            )}
          </group>
        </Canvas>
        {!isThumbnail && (
          <>
            <div className="absolute top-4 left-4 pointer-events-none select-none md:block hidden">
              <LegendPanel />
            </div>
            <div className="absolute bottom-4 right-4 pointer-events-auto w-64 max-h-[85%] overflow-y-auto md:block hidden">
              <ControlsPanel />
            </div>
          </>
        )}
      </div>
      {!isThumbnail && (
        <div className="flex flex-col gap-4 md:hidden px-4 pb-4">
          <LegendPanel />
          <ControlsPanel />
        </div>
      )}
    </div>
  );
}
