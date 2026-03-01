import { Camera } from "@phosphor-icons/react";
import { ArcballControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useId, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { type BufferGeometry, SphereGeometry, Vector3 } from "three";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Switch } from "~/components/ui/switch";
import { Nec2Context } from "~/utils/nec2-c-wasm";
import { ElectricFieldNec2 } from "./electric-field-nec2";

function WindomAntenna({
  visualScale = 1.0,
  isInvertedV = false,
  length = 10.14, // meters for 14.1MHz
}: {
  visualScale?: number;
  isInvertedV?: boolean;
  length?: number;
  groundHeight?: number;
}) {
  const shortLen = length / 3;
  const longLen = length - shortLen;
  const droopAngle = isInvertedV ? (30 * Math.PI) / 180 : 0;

  // Align with NEC simulation: Wire is horizontal.
  // We'll place it along Three.js Z-axis which will map to NEC Y-axis.
  return (
    <group>
      {/* Short Leg - tilted if inverted V */}
      <group rotation={[droopAngle, 0, 0]}>
        <mesh
          position={[0, 0, (-shortLen * visualScale) / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.03, 0.03, shortLen * visualScale, 16]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      </group>
      {/* Long Leg */}
      <group rotation={[-droopAngle, 0, 0]}>
        <mesh
          position={[0, 0, (longLen * visualScale) / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.03, 0.03, longLen * visualScale, 16]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      </group>
      {/* Feed Point */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.15, 0.15, 0.15]} />
        <meshBasicMaterial color="#fff" />
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
        // Map Three.js(X,Y,Z) back to NEC(X,Y,Z)
        // Three X -> NEC X
        // Three Y -> NEC Z
        // Three Z -> NEC Y
        // Wait, for pattern calculation we need spherical coords in NEC frame
        // In NEC frame: Z is UP, X/Y are horizontal.
        // In Three frame: Y is UP, X/Z are horizontal.
        // So: Three Y <-> NEC Z, Three X <-> NEC X, Three Z <-> NEC Y.

        const theta = Math.acos(Math.max(-1, Math.min(1, vertex.y)));
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

      const maxDbi = context.get_max_gain();
      const visualBaseScale = 5.0 + Math.max(0, maxDbi) * 0.5;

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
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color="#22c55e"
          wireframe={true}
          transparent={true}
          opacity={0.2}
        />
      </mesh>
    </group>
  );
}

export default function WindomAntennaScene({
  isThumbnail = false,
  isHovered = false,
}: {
  isThumbnail?: boolean;
  isHovered?: boolean;
}) {
  const { t } = useTranslation("scene");
  const [groundHeight, setGroundHeight] = useState(0.0);
  const [material, setMaterial] = useState<string>("aluminum");
  const [showWaves, setShowWaves] = useState(true);
  const [showPattern, setShowPattern] = useState(true);
  const [isInvertedV, setIsInvertedV] = useState(false);
  const [harmonic, setHarmonic] = useState(1);
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

  const visualScale = 1.0;

  useEffect(() => {
    let active = true;
    const runSimulation = async () => {
      setIsCalculating(true);
      try {
        const ctx = new Nec2Context();
        ctx.initialize(1);

        // Use 14.1MHz as base frequency for Windom (20m band)
        const baseFreq = 14.1;
        const freq = baseFreq * harmonic;
        ctx.set_frequency(freq);
        ctx.set_material(material);

        const lambda = 299.79 / baseFreq; // Use base lambda for geometry
        const h_m = groundHeight > 0 ? groundHeight * lambda : 10;
        if (groundHeight > 0) ctx.set_ground(groundHeight);

        const totalLen = 143 / baseFreq;
        const shortLen = totalLen / 3;
        const longLen = totalLen - shortLen;

        const angle = isInvertedV ? (30 * Math.PI) / 180 : 0;
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);

        // Feed point at (0, 0, h_m)
        // Short leg along -Y and -Z (if inverted V)
        // NEC: Z is up, Y is along the wire
        ctx.add_wire(
          0,
          0,
          h_m,
          0,
          -shortLen * cosA,
          h_m - shortLen * sinA,
          0.001,
          15,
          1,
        );
        // Long leg along +Y and -Z
        ctx.add_wire(
          0,
          0,
          h_m,
          0,
          longLen * cosA,
          h_m - longLen * sinA,
          0.001,
          25,
          2,
        );

        // Voltage source at the feed point (segment 1 of wire 1)
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
  }, [groundHeight, material, isInvertedV, harmonic]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement("a");
      link.download = "windom-antenna.png";
      link.href = canvasRef.current.toDataURL("image/png");
      link.click();
    }
  };

  const effectiveSpeed =
    isThumbnail && !isHovered
      ? 0
      : { slow: 0.3, medium: 0.6, fast: 1.0 }[speedMode];
  const lambda_base = 299.79 / 14.1;
  const gridY = -groundHeight * lambda_base * visualScale;

  const LegendPanel = () => (
    <div className="p-4 bg-black/70 text-white rounded-lg md:max-w-xs h-full border border-white/5">
      <h2 className="text-lg font-bold mb-2">{t("windomAntenna.title")}</h2>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        <Trans
          ns="scene"
          i18nKey="windomAntenna.desc"
          components={{ br: <br /> }}
        />
      </p>
      <div className="space-y-1.5 text-xs border-t border-gray-600 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-sm" />
          <span>{t("windomAntenna.wire")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-white rounded-sm" />
          <span>{t("windomAntenna.feed")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-green-500 rounded-sm" />
          <span>{t("windomAntenna.pattern")}</span>
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
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-blue-600 via-green-500 via-yellow-400 to-red-600" />
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
              {t("common.controls.harmonicMode")}
            </div>
            <RadioGroup
              value={harmonic.toString()}
              onValueChange={(v) => setHarmonic(parseInt(v, 10))}
              className="grid grid-cols-2 gap-2"
            >
              {[1, 2, 3, 4].map((h) => (
                <div key={h} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={h.toString()}
                    id={`${uniqueId}h${h}`}
                    className="peer size-3 border-zinc-500 data-[state=checked]:border-white data-[state=checked]:text-white"
                  />
                  <Label
                    htmlFor={`${uniqueId}h${h}`}
                    className="text-[11px] cursor-pointer text-zinc-400 peer-data-[state=checked]:text-white"
                  >
                    {t(`common.controls.harmonic${h}` as any)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="pt-2 border-t border-white/5">
            <div className="mb-2 text-xs font-medium text-zinc-300">
              {t("common.simulation.material")}
            </div>
            <RadioGroup
              value={material}
              onValueChange={setMaterial}
              className="flex flex-row md:flex-col gap-3 md:gap-1.5"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="aluminum"
                  id={`${uniqueId}m-al`}
                  className="peer size-3 border-zinc-500 data-[state=checked]:border-white data-[state=checked]:text-white"
                />
                <Label
                  htmlFor={`${uniqueId}m-al`}
                  className="text-[11px] cursor-pointer text-zinc-400 peer-data-[state=checked]:text-white"
                >
                  {t("common.simulation.aluminum")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="stainless_steel"
                  id={`${uniqueId}m-ss`}
                  className="peer size-3 border-zinc-500 data-[state=checked]:border-white data-[state=checked]:text-white"
                />
                <Label
                  htmlFor={`${uniqueId}m-ss`}
                  className="text-[11px] cursor-pointer text-zinc-400 peer-data-[state=checked]:text-white"
                >
                  {t("common.simulation.stainlessSteel")}
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
                onChange={(e) => setGroundHeight(parseFloat(e.target.value))}
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

          <div className="pt-2 border-t border-white/5 space-y-2">
            <div className="flex items-center justify-between group">
              <Label
                htmlFor={`${uniqueId}inv-v`}
                className="text-[11px] text-zinc-400 cursor-pointer peer-data-[state=checked]:text-white order-first"
              >
                {t("common.controls.invertedV")}
              </Label>
              <Switch
                id={`${uniqueId}inv-v`}
                checked={isInvertedV}
                onCheckedChange={setIsInvertedV}
                className="peer scale-75 data-[state=unchecked]:bg-zinc-700 data-[state=checked]:bg-blue-500"
              />
            </div>
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

        <Button
          variant="secondary"
          size="sm"
          className="w-full h-8 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-none"
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
          camera={{ position: [15, 15, 20], fov: 45 }}
          frameloop={isThumbnail && !isHovered ? "demand" : "always"}
        >
          <color attach="background" args={["#111111"]} />
          <fog attach="fog" args={["#111111", 100, 1000]} />
          {!isThumbnail && <ArcballControls target={[0, 0, 0]} makeDefault />}
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 10]} intensity={1} />
          <axesHelper args={[5]} />
          <gridHelper
            args={[100, 20, 0x333333, 0x222222]}
            position={[0, gridY, 0]}
          />

          <group position={[0, 0, 0]}>
            <WindomAntenna
              visualScale={visualScale}
              isInvertedV={isInvertedV}
              length={143 / 14.1}
              groundHeight={groundHeight}
            />
            {showPattern && context && <RadiationPattern context={context} />}
            {showWaves && context && (
              <ElectricFieldNec2
                context={context}
                speed={effectiveSpeed}
                amplitudeScale={1.0}
                particleScale={0.6}
                plane="YZ"
                visualScale={visualScale}
              />
            )}
          </group>
        </Canvas>

        {!isThumbnail && (
          <div className="hidden md:block">
            <div className="absolute top-4 left-4 pointer-events-none">
              <LegendPanel />
            </div>
            <div className="absolute bottom-4 right-4 pointer-events-auto w-64">
              <ControlsPanel />
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
