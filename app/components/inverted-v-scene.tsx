import { Camera } from "@phosphor-icons/react";
import { ArcballControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  type BufferGeometry,
  DoubleSide,
  SphereGeometry,
  Vector3,
} from "three";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Switch } from "~/components/ui/switch";
import { Nec2Context } from "~/utils/nec2-c-wasm";
import { ElectricFieldNec2 } from "./electric-field-nec2";

const frequency = 300.0;
const lambda = 299.79 / frequency;

function InvertedVAntenna({
  length,
  angle,
  mastHeight,
}: {
  length: number;
  angle: number;
  mastHeight: number;
}) {
  const armLength = length / 2;
  // 计算末端坐标 (左右伸展 X，向下垂 Y)
  const xTip = armLength * Math.sin(angle);
  const yTip = -armLength * Math.cos(angle);

  return (
    <group position={[0, mastHeight, 0]}>
      {/* Mast */}
      <mesh position={[0, -mastHeight / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, mastHeight, 16]} />
        <meshStandardMaterial color="#666" />
      </mesh>

      {/* Feedpoint */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.15, 0.15, 0.15]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Left Leg */}
      <mesh position={[-xTip / 2, yTip / 2, 0]} rotation={[0, 0, -angle]}>
        <cylinderGeometry args={[0.02, 0.02, armLength, 16]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>

      {/* Right Leg */}
      <mesh position={[xTip / 2, yTip / 2, 0]} rotation={[0, 0, angle]}>
        <cylinderGeometry args={[0.02, 0.02, armLength, 16]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

function RadiationPattern({
  context,
  mastHeight,
}: {
  context: Nec2Context | null;
  mastHeight: number;
}) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);

  useEffect(() => {
    if (!context) return;

    const generateGeometry = () => {
      const geo = new SphereGeometry(1, 60, 30);
      const posAttribute = geo.attributes.position;
      const vertex = new Vector3();
      const scale = 5;

      const count = posAttribute.count;
      const thetas = new Float64Array(count);
      const phis = new Float64Array(count);
      const gains = new Float64Array(count);

      for (let i = 0; i < count; i++) {
        vertex.fromBufferAttribute(posAttribute, i);
        vertex.normalize();
        // Theta 从 Y 轴起算 (Three.js 垂直轴)
        thetas[i] = Math.acos(Math.max(-1, Math.min(1, vertex.y)));
        let phi = Math.atan2(vertex.z, vertex.x);
        if (phi < 0) phi += 2 * Math.PI;
        phis[i] = phi;
      }

      context.calculate_far_field_pattern_3d(thetas, phis, gains);

      let maxG = 0.01;
      for (let i = 0; i < count; i++) {
        if (gains[i] > maxG) maxG = gains[i];
      }

      for (let i = 0; i < count; i++) {
        vertex.fromBufferAttribute(posAttribute, i);
        vertex.normalize();
        const power = gains[i] / maxG;
        const rad = (0.1 + power * 0.9) * scale;
        posAttribute.setXYZ(i, vertex.x * rad, vertex.y * rad, vertex.z * rad);
      }

      geo.computeVertexNormals();
      setGeometry(geo);
    };

    generateGeometry();
  }, [context]);

  if (!geometry) return null;

  return (
    <group position={[0, mastHeight, 0]}>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color="#22c55e"
          wireframe
          transparent
          opacity={0.3}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

export default function InvertedVAntennaScene({
  isThumbnail = false,
  isHovered = false,
}: {
  isThumbnail?: boolean;
  isHovered?: boolean;
}) {
  const { t } = useTranslation("scene");
  const [showWaves, setShowWaves] = useState(true);
  const [showPattern, setShowPattern] = useState(true);
  const [lengthFactor, setLengthFactor] = useState(0.5);
  const [groundHeight, setGroundHeight] = useState(0.0);
  const [speedMode, setSpeedMode] = useState<"slow" | "medium" | "fast">(
    "medium",
  );
  const [armAngleDeg, setArmAngleDeg] = useState(45);

  const [context, setContext] = useState<Nec2Context | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [impedance, setImpedance] = useState<{ re: number; im: number } | null>(
    null,
  );
  const [maxGain, setMaxGain] = useState<number>(0);

  const uniqueId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const visualScale = 4;
  const armAngleRad = (armAngleDeg * Math.PI) / 180;

  // Use groundHeight if > 0, otherwise default to 0.3 lambda for visualization
  const effectiveHeightLambda = groundHeight > 0 ? groundHeight : 0.3;

  // 视觉天线高度固定为 3，配合 visualScale=4 确保天线振子末端不会穿透地面
  const visualMastHeight = 3;

  const physicalLength = lengthFactor * visualScale;
  // Logic to prevent antenna tips from going below ground
  // h_m + yTip >= 0.01*lambda => h_m - armLength * cos(angle) >= 0.01*lambda
  // cos(angle) <= (h_m - 0.01*lambda) / armLength
  const simArmLength = (lengthFactor * lambda) / 2;
  const d_sim = 0.005;
  const maxCos =
    groundHeight > 0
      ? (effectiveHeightLambda - 0.01) / (simArmLength - d_sim)
      : 1.0;

  const effectiveAngleRad =
    Math.cos(armAngleRad) > maxCos
      ? Math.acos(Math.max(-1, Math.min(1, maxCos)))
      : armAngleRad;

  useEffect(() => {
    let active = true;
    const runSimulation = async () => {
      setIsCalculating(true);
      try {
        const ctx = new Nec2Context();
        ctx.initialize(3);
        ctx.set_frequency(frequency);
        if (groundHeight > 0) ctx.set_ground(groundHeight);

        const armLength = (lengthFactor * lambda) / 2;
        const d = 0.005;
        let armSegments = Math.floor((armLength - d) / 0.02);
        if (armSegments < 1) armSegments = 1;

        const h_m = groundHeight > 0 ? groundHeight * lambda : 0.3 * lambda;

        const xTip = (armLength - d) * Math.sin(effectiveAngleRad);
        const yTip = -(armLength - d) * Math.cos(effectiveAngleRad);

        ctx.add_wire(-d, 0, h_m, d, 0, h_m, 0.001, 1, 1);
        ctx.add_wire(d, 0, h_m, xTip + d, 0, h_m + yTip, 0.001, armSegments, 2);
        ctx.add_wire(
          -d,
          0,
          h_m,
          -xTip - d,
          0,
          h_m + yTip,
          0.001,
          armSegments,
          3,
        );

        ctx.add_voltage_source(1, 1, 1.0, 0.0);
        await ctx.calculate();

        if (active) {
          const zArr = ctx.get_impedance(1);
          setImpedance({ re: zArr[0], im: zArr[1] });
          setMaxGain(ctx.get_max_gain());
          setContext(ctx);
        }
      } catch (err) {
        console.error("NEC Simulation Error:", err);
      } finally {
        if (active) setIsCalculating(false);
      }
    };

    const timer = setTimeout(runSimulation, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [lengthFactor, effectiveAngleRad, groundHeight]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement("a");
      link.download = "inverted-v-scene.png";
      link.href = canvasRef.current.toDataURL("image/png");
      link.click();
    }
  };

  const speedMultiplier = {
    slow: 0.3,
    medium: 0.6,
    fast: 1.0,
  }[speedMode];

  const effectiveSpeed = isThumbnail && !isHovered ? 0 : speedMultiplier;

  const LegendPanel = () => (
    <div className="p-4 bg-black/70 text-white rounded-lg md:max-w-xs h-full border border-white/5">
      <h2 className="text-lg font-bold mb-2">{t("invertedVAntenna.title")}</h2>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        <Trans
          ns="scene"
          i18nKey="invertedVAntenna.desc"
          components={{ br: <br /> }}
        />
      </p>
      <div className="space-y-1.5 text-xs border-t border-gray-600 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-sm" />
          <span>{t("invertedVAntenna.active")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-400 rounded-sm" />
          <span>{t("invertedVAntenna.passiveOrGround")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-green-500 rounded-sm" />
          <span>{t("invertedVAntenna.pattern")}</span>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-gray-600">
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
            {t("common.simulation.strength")}
          </span>
          <span className="text-[9px] text-zinc-500 italic">
            Normalized (E·r)
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full"
          style={{
            background:
              "linear-gradient(to right, #3b82f6, #10b981, #eab308, #ef4444)",
          }}
        />
      </div>
    </div>
  );

  const ControlsPanel = () => (
    <div className="p-4 bg-black/70 text-white rounded-lg w-full h-full border border-white/5">
      <div className="flex flex-col space-y-4">
        <div className="bg-zinc-900/50 p-3 rounded border border-white/5">
          <div className="mb-2 text-[10px] uppercase font-bold tracking-wider text-zinc-500">
            {t("common.simulation.analysis")}
          </div>
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
          <div className="pt-1">
            <div className="mb-2 text-xs font-medium text-zinc-300">
              {t("common.controls.length")}
            </div>
            <RadioGroup
              value={lengthFactor.toString()}
              onValueChange={(v) => setLengthFactor(Number.parseFloat(v))}
              className="flex flex-row md:flex-col gap-3 md:gap-1.5"
            >
              {[0.5, 1.0, 1.5].map((val) => (
                <div key={val} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={val.toString()}
                    id={`${uniqueId}l-${val}`}
                    className="peer size-3 border-zinc-500 data-[state=checked]:border-white data-[state=checked]:text-white"
                  />
                  <Label
                    htmlFor={`${uniqueId}l-${val}`}
                    className="text-[11px] cursor-pointer text-zinc-400 peer-data-[state=checked]:text-white"
                  >
                    {val}λ
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="pt-2 border-t border-white/5">
            <div className="mb-2 text-xs font-medium text-zinc-300">
              V-Angle: {armAngleDeg}°
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="30"
                max="150"
                step="5"
                value={armAngleDeg}
                onChange={(e) =>
                  setArmAngleDeg(Number.parseFloat(e.target.value))
                }
                className="w-full accent-blue-500 h-1"
              />
            </div>
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

          <div className="pt-2 border-t border-white/5">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between group">
                <Label
                  htmlFor={`${uniqueId}wave-mode`}
                  className="text-[11px] text-zinc-400 cursor-pointer peer-data-[state=checked]:text-white order-first"
                >
                  {t("common.controls.showWaves")}
                </Label>
                <Switch
                  id={`${uniqueId}wave-mode`}
                  checked={showWaves}
                  onCheckedChange={setShowWaves}
                  className="peer scale-75 data-[state=unchecked]:bg-zinc-700 data-[state=checked]:bg-blue-500"
                />
              </div>
              <div className="flex items-center justify-between group">
                <Label
                  htmlFor={`${uniqueId}pattern-mode`}
                  className="text-[11px] text-zinc-400 cursor-pointer peer-data-[state=checked]:text-white order-first"
                >
                  {t("common.controls.showPattern")}
                </Label>
                <Switch
                  id={`${uniqueId}pattern-mode`}
                  checked={showPattern}
                  onCheckedChange={setShowPattern}
                  className="peer scale-75 data-[state=unchecked]:bg-zinc-700 data-[state=checked]:bg-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="w-full h-8 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-none"
          onClick={handleDownload}
        >
          <Camera className="mr-2 size-3.5" />
          {t("common.controls.download")}
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
          camera={{ position: [3, 6, 18], fov: 45 }}
          frameloop={isThumbnail && !isHovered ? "demand" : "always"}
        >
          <color attach="background" args={["#111111"]} />
          <fog attach="fog" args={["#111111", 100, 1000]} />

          {!isThumbnail && <ArcballControls target={[0, 1.5, 0]} makeDefault />}

          <ambientLight intensity={0.5} color={0x404040} />
          <directionalLight
            position={[10, 10, 10]}
            intensity={1}
            color={0xffffff}
          />

          <axesHelper args={[5]} />
          <gridHelper
            args={[20, 20, 0x333333, 0x222222]}
            position={[0, 0, 0]}
          />

          <InvertedVAntenna
            length={physicalLength}
            angle={effectiveAngleRad}
            mastHeight={visualMastHeight}
          />
          <Suspense fallback={null}>
            {showPattern && (
              <RadiationPattern
                context={context}
                mastHeight={visualMastHeight}
              />
            )}
            {showWaves && context && (
              <group position={[0, visualMastHeight, 0]}>
                <ElectricFieldNec2
                  context={context}
                  plane="XY"
                  visualScale={visualScale}
                  amplitudeScale={2.5}
                  speed={effectiveSpeed}
                  particleScale={0.6}
                  powerExponent={1.8}
                />
              </group>
            )}{" "}
          </Suspense>
        </Canvas>

        {!isThumbnail && (
          <div className="hidden md:block">
            <div className="absolute top-4 left-4 pointer-events-none select-none">
              <LegendPanel />
            </div>
            <div className="absolute bottom-4 right-4 pointer-events-auto w-64 max-h-[85%] overflow-y-auto">
              <ControlsPanel />
            </div>
            <div className="absolute bottom-4 left-4 text-gray-400 text-xs pointer-events-none select-none">
              {t("common.created")}
            </div>
          </div>
        )}
      </div>

      {!isThumbnail && (
        <div className="flex flex-col gap-4 md:hidden">
          <LegendPanel />
          <ControlsPanel />
        </div>
      )}
    </div>
  );
}
