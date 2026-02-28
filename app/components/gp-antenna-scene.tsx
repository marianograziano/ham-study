import { Camera } from "@phosphor-icons/react";
import { ArcballControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useId, useState, useRef, Suspense } from "react";
import { Trans, useTranslation } from "react-i18next";
import { type BufferGeometry, SphereGeometry, Vector3, DoubleSide } from "three";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Switch } from "~/components/ui/switch";
import { Nec2Context } from "~/utils/nec2-c-wasm";
import { ElectricFieldNec2 } from "./electric-field-nec2";

function GPAntenna({ radialAngle, mastHeight }: { radialAngle: "60" | "135", mastHeight: number }) {
  const radials = 4;
  const radialLen = 2; // visual length
  const angleFromVertical =
    radialAngle === "135" ? (135 * Math.PI) / 180 : (60 * Math.PI) / 180;

  return (
    <group position={[0, mastHeight, 0]}>
      {/* Vertical Radiator */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 2, 16]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>

      {/* Feedpoint */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshBasicMaterial color="#fff" />
      </mesh>

      {/* Radials */}
      {Array.from({ length: radials }).map((_, i) => {
        const angle = (i / radials) * Math.PI * 2;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: Static array length
          <group key={`radial-${i}`} rotation={[0, angle, 0]}>
            <group rotation={[0, 0, -angleFromVertical]}>
              <mesh position={[0, radialLen / 2, 0]}>
                <cylinderGeometry args={[0.015, 0.015, radialLen, 16]} />
                <meshStandardMaterial color="#3b82f6" />
              </mesh>
            </group>
          </group>
        );
      })}

      {/* Mast */}
      <mesh position={[0, -mastHeight / 2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, mastHeight, 16]} />
        <meshStandardMaterial color="#444" />
      </mesh>
    </group>
  );
}

function RadiationPattern({ context, mastHeight }: { context: Nec2Context | null, mastHeight: number }) {
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

export default function GPAntennaScene({
  isThumbnail = false,
  isHovered = false,
}: {
  isThumbnail?: boolean;
  isHovered?: boolean;
}) {
  const { t } = useTranslation("scene");
  const [showWaves, setShowWaves] = useState(true);
  const [showPattern, setShowPattern] = useState(true);
  const [radialAngle, setRadialAngle] = useState<"60" | "135">("135");
  const [groundHeight, setGroundHeight] = useState(0.0);
  const [speedMode, setSpeedMode] = useState<"slow" | "medium" | "fast">("medium");

  const [context, setContext] = useState<Nec2Context | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [impedance, setImpedance] = useState<{ re: number; im: number } | null>(null);
  const [maxGain, setMaxGain] = useState<number>(0);

  const uniqueId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const visualScale = 4;
  const frequency = 300.0;
  const lambda = 299.79 / frequency;
  const radiatorLength = 0.25 * lambda;
  const radialLength = 0.25 * lambda;

  const effectiveHeightLambda = groundHeight > 0 ? groundHeight : 0.3;
  const visualMastHeight = 3;

  const angleRad = radialAngle === "135" ? (135 * Math.PI) / 180 : (60 * Math.PI) / 180;
  
  // Logic to prevent radials from going below ground
  const d_sim = 0.005;
  const minCos = groundHeight > 0 ? (0.01 - effectiveHeightLambda) / (radialLength - d_sim) : -1.0;
  const effectiveAngleRad = Math.cos(angleRad) < minCos 
    ? Math.acos(Math.max(-1, Math.min(1, minCos)))
    : angleRad;

  useEffect(() => {
    let active = true;
    const runSimulation = async () => {
      setIsCalculating(true);
      try {
        const ctx = new Nec2Context();
        ctx.initialize(5); // 1 feed + 1 radiator + 4 radials = 6 wires
        ctx.set_frequency(frequency);
        if (groundHeight > 0) ctx.set_ground(groundHeight);

        const h_m = groundHeight > 0 ? groundHeight * lambda : 0.3 * lambda;
        
        // 1. Feed wire
        ctx.add_wire(0, 0, h_m - d_sim, 0, 0, h_m + d_sim, 0.002, 1, 1);
        ctx.add_voltage_source(1, 1, 1.0, 0.0);

        // 2. Radiator
        const radSegments = Math.max(1, Math.floor((radiatorLength - d_sim) / 0.02));
        ctx.add_wire(0, 0, h_m + d_sim, 0, 0, h_m + radiatorLength, 0.002, radSegments, 2);

        // 3. Radials
        const numRadials = 4;
        const radLen = radialLength - d_sim;
        const radialSegs = Math.max(1, Math.floor(radLen / 0.02));
        for (let i = 0; i < numRadials; i++) {
          const phi = (i / numRadials) * Math.PI * 2;
          const dz = radLen * Math.cos(effectiveAngleRad);
          const rxy = radLen * Math.sin(effectiveAngleRad);
          const dx = rxy * Math.cos(phi);
          const dy = rxy * Math.sin(phi);
          
          ctx.add_wire(0, 0, h_m - d_sim, dx, dy, h_m - d_sim + dz, 0.002, radialSegs, 3 + i);
        }

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
  }, [radialAngle, effectiveAngleRad, groundHeight]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement("a");
      link.download = "gp-antenna-scene.png";
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
      <h2 className="text-lg font-bold mb-2">{t("gpAntenna.title")}</h2>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        <Trans
          ns="scene"
          i18nKey="gpAntenna.desc"
          components={{ br: <br /> }}
        />
      </p>
      <div className="space-y-1.5 text-xs border-t border-gray-600 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-sm" />
          <span>{t("gpAntenna.radiator")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-sm" />
          <span>{t("gpAntenna.radials")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-green-500 rounded-sm" />
          <span>{t("gpAntenna.pattern")}</span>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-gray-600">
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">{t("common.simulation.strength")}</span>
          <span className="text-[9px] text-zinc-500 italic">Normalized (E·r)</span>
        </div>
        <div className="h-2 w-full rounded-full" style={{ background: "linear-gradient(to right, #3b82f6, #10b981, #eab308, #ef4444)" }} />
      </div>
    </div>
  );

  const ControlsPanel = () => (
    <div className="p-4 bg-black/70 text-white rounded-lg w-full h-full border border-white/5">
      <div className="flex flex-col space-y-4">
        <div className="bg-zinc-900/50 p-3 rounded border border-white/5">
          <div className="mb-2 text-[10px] uppercase font-bold tracking-wider text-zinc-500">{t("common.simulation.analysis")}</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] text-zinc-400 mb-0.5">{t("common.simulation.peakGain")}</div>
              <div className="text-xs font-mono text-green-400">{isCalculating ? "..." : `${maxGain.toFixed(2)} dBi`}</div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-400 mb-0.5">{t("common.simulation.impedance")}</div>
              <div className="text-xs font-mono text-zinc-300">
                {isCalculating ? "..." : impedance ? `${impedance.re.toFixed(1)}Ω` : "--"}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="pt-1">
            <div className="mb-2 text-xs font-medium text-zinc-300">{t("gpAntenna.radialAngle")}</div>
            <RadioGroup
              value={radialAngle}
              onValueChange={(v) => setRadialAngle(v as "60" | "135")}
              className="flex flex-row md:flex-col gap-3 md:gap-1.5"
            >
              {[
                { val: "60", label: t("gpAntenna.angle60") },
                { val: "135", label: t("gpAntenna.angle135") },
              ].map(({val, label}) => (
                <div key={val} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={val}
                    id={`${uniqueId}angle-${val}`}
                    className="peer size-3 border-zinc-500 data-[state=checked]:border-white data-[state=checked]:text-white"
                  />
                  <Label
                    htmlFor={`${uniqueId}angle-${val}`}
                    className="text-[11px] cursor-pointer text-zinc-400 peer-data-[state=checked]:text-white"
                  >
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="pt-2 border-t border-white/5">
            <div className="mb-2 text-xs font-medium text-zinc-300">{t("common.simulation.groundHeight")}</div>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={groundHeight}
                onChange={(e) => setGroundHeight(Number.parseFloat(e.target.value))}
                className="w-full accent-blue-500 h-1"
              />
              <span className="text-[10px] text-zinc-400 w-8 text-right font-mono">
                {groundHeight === 0 ? t("common.simulation.freeSpace") : groundHeight.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
            <div className="mb-2 text-xs font-medium text-zinc-300">{t("common.controls.speed")}</div>
            <RadioGroup
              value={speedMode}
              onValueChange={(v) => setSpeedMode(v as any)}
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
          camera={{ position: [10, 5, 10], fov: 45 }}
          frameloop={isThumbnail && !isHovered ? "demand" : "always"}
        >
          <color attach="background" args={["#111111"]} />
          <fog attach="fog" args={["#111111", 10, 50]} />

          {!isThumbnail && <ArcballControls target={[0, 3, 0]} makeDefault />}

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

          <GPAntenna radialAngle={radialAngle} mastHeight={visualMastHeight} />
          <Suspense fallback={null}>
            {showPattern && <RadiationPattern context={context} mastHeight={visualMastHeight} />}
            {showWaves && context && (
              <group position={[0, visualMastHeight, 0]}>
                <ElectricFieldNec2
                  context={context}
                  plane="XY"
                  visualScale={visualScale}
                  amplitudeScale={2.0}
                  speed={effectiveSpeed}
                  particleScale={0.6}
                />
              </group>
            )}
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
