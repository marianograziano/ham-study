import { Camera } from "@phosphor-icons/react";
import { ArcballControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { type BufferGeometry, SphereGeometry, Vector3 } from "three";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Switch } from "~/components/ui/switch";
import { initNecWasm, NecContext } from "~/utils/nec-wasm";
import { ElectricFieldWasm } from "./electric-field-wasm";

function YagiAntenna() {
  return (
    <group>
      {/* Boom */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 4, 16]} />
        <meshStandardMaterial color="#666" />
      </mesh>

      {/* Reflector (Back, Longest) */}
      <mesh position={[-1.5, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 3.2, 16]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>

      {/* Driven Element (Middle) */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 3, 16]} />
        <meshStandardMaterial color="#ef4444" />
        {/* Feedpoint */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color="#fff" />
        </mesh>
      </mesh>

      {/* Director (Front, Shortest) */}
      <mesh position={[1.5, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 2.8, 16]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>

      {/* Mast */}
      <mesh position={[0, -2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 4, 16]} />
        <meshStandardMaterial color="#444" />
      </mesh>
    </group>
  );
}

function ImpedanceDisplay({ groundHeight }: { groundHeight: number }) {
  const [impedance, setImpedance] = useState<{ re: number; im: number } | null>(
    null,
  );
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    let active = true;
    const calculate = async () => {
      setIsCalculating(true);
      try {
        await initNecWasm();
        if (!active) return;

        const ctx = new NecContext();
        ctx.initialize(1);
        // 430 MHz (70cm band), λ = 0.697m — standard 3-element Yagi
        ctx.set_frequency(430.0);
        if (groundHeight > 0) ctx.set_ground(groundHeight);

        // 3-element Yagi at 430 MHz
        // Boom along X-axis, elements along Z-axis
        // Reflector (Tag 1): 0.50λ = 0.349m total, at x = -0.139 (0.2λ spacing)
        ctx.add_wire(-0.139, 0, -0.174, -0.139, 0, 0.174, 0.003, 11, 1);
        // Driven (Tag 2): 0.47λ = 0.328m total, at x = 0
        ctx.add_wire(0, 0, -0.164, 0, 0, 0.164, 0.003, 11, 2);
        // Director (Tag 3): 0.44λ = 0.307m total, at x = 0.105 (0.15λ spacing)
        ctx.add_wire(0.105, 0, -0.153, 0.105, 0, 0.153, 0.003, 11, 3);

        ctx.add_voltage_source(2, 6, 1.0, 0.0); // feed at driven element center (seg 6 of 11)
        ctx.calculate();

        const zArr = ctx.get_impedance(2);
        if (zArr && zArr.length === 2 && active) {
          setImpedance({ re: zArr[0], im: zArr[1] });
        }
        ctx.free();
      } catch (err) {
        console.error("NEC Calculation Error:", err);
      } finally {
        if (active) setIsCalculating(false);
      }
    };

    const timer = setTimeout(calculate, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [groundHeight]);

  return (
    <div className="pt-3 border-t border-white/10 mt-3">
      <div className="mb-2 text-xs md:text-sm font-medium text-zinc-200">
        Live Impedance (NEC2)
      </div>
      <div className="text-xs font-mono bg-black/50 p-2 rounded text-zinc-300">
        {isCalculating ? (
          <span className="animate-pulse">Calculating Z...</span>
        ) : impedance ? (
          <span>
            Z = {impedance.re.toFixed(1)} {impedance.im >= 0 ? "+" : "-"} j
            {Math.abs(impedance.im).toFixed(1)} Ω
          </span>
        ) : (
          <span>--</span>
        )}
      </div>
    </div>
  );
}

function RadiationPattern({ groundHeight }: { groundHeight: number }) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);

  useEffect(() => {
    let active = true;

    const generateGeometry = async () => {
      try {
        await initNecWasm();
        if (!active) return;

        const geo = new SphereGeometry(1, 60, 40);
        const posAttribute = geo.attributes.position;
        const vertex = new Vector3();
        const scale = 10;

        const ctx = new NecContext();
        ctx.initialize(1);
        ctx.set_frequency(430.0);
        if (groundHeight > 0)
          Object.getPrototypeOf(ctx).set_ground
            ? ctx.set_ground(groundHeight)
            : void 0;

        // Exact geometry configuration for 3-element Yagi at 430 MHz
        ctx.add_wire(-0.139, 0, -0.174, -0.139, 0, 0.174, 0.003, 11, 1);
        ctx.add_wire(0, 0, -0.164, 0, 0, 0.164, 0.003, 11, 2);
        ctx.add_wire(0.105, 0, -0.153, 0.105, 0, 0.153, 0.003, 11, 3);
        ctx.add_voltage_source(2, 6, 1.0, 0.0);
        ctx.calculate();

        const count = posAttribute.count;
        const thetas = new Float64Array(count);
        const phis = new Float64Array(count);
        const gains = new Float64Array(count);
        const dirs: Vector3[] = new Array(count);

        for (let i = 0; i < count; i++) {
          vertex.fromBufferAttribute(posAttribute, i);
          vertex.normalize();
          dirs[i] = vertex.clone();

          // Standard spherical conversion (Y is UP)
          const r = Math.sqrt(
            vertex.x * vertex.x + vertex.y * vertex.y + vertex.z * vertex.z,
          );
          // Clamp y/r to [-1, 1] to avoid NaN from floating point inaccuracies
          const y_norm = Math.max(-1, Math.min(1, vertex.y / r));
          let theta = Math.acos(y_norm);
          let phi = Math.atan2(vertex.z, vertex.x);
          if (phi < 0) phi += 2 * Math.PI;

          thetas[i] = theta;
          phis[i] = phi;
        }

        // Use the newly corrected WASM physics engine to batch-calculate the true 3D pattern
        ctx.calculate_far_field_pattern_3d(thetas, phis, gains);

        for (let i = 0; i < count; i++) {
          // values from calculate_far_field_pattern_3d are already normalized and power-scaled
          // (or linearly scaled if square removed)
          const power = gains[i];
          const rad = (0.05 + power * 1.5) * scale;
          const dir = dirs[i];
          posAttribute.setXYZ(i, dir.x * rad, dir.y * rad, dir.z * rad);
        }

        geo.computeVertexNormals();
        ctx.free();

        if (active) {
          setGeometry(geo);
        }
      } catch (err) {
        console.error("Pattern Calculation Error:", err);
      }
    };

    generateGeometry();

    return () => {
      active = false;
    };
  }, [groundHeight]);

  if (!geometry) {
    return null;
  }

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

export default function YagiAntennaScene({
  isThumbnail = false,
  isHovered = false,
}: {
  isThumbnail?: boolean;
  isHovered?: boolean;
}) {
  const { t } = useTranslation("scene");
  /* ... inside separate component or prop ... */
  const [material, setMaterial] = useState<string>("aluminum");
  const [groundHeight, setGroundHeight] = useState(0.0);
  const [showWaves, setShowWaves] = useState(true);
  const [showPattern, setShowPattern] = useState(true);
  const [speedMode, setSpeedMode] = useState<"slow" | "medium" | "fast">(
    "medium",
  );

  const uniqueId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement("a");
      link.download = "yagi-antenna.png";
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

  const LegendContent = () => (
    <>
      <h2 className="text-lg md:text-xl font-bold mb-2">
        {t("yagiAntenna.title")}
      </h2>
      <p className="text-xs md:text-sm text-muted-foreground mb-2">
        <Trans
          ns="scene"
          i18nKey="yagiAntenna.desc"
          components={{ br: <br /> }}
        />
      </p>

      <div className="mt-3 mb-2 space-y-1.5 text-xs border-t border-gray-600 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-sm" />
          <span>{t("yagiAntenna.driven")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-sm" />
          <span>{t("yagiAntenna.passive")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-green-500 rounded-sm" />
          <span>{t("yagiAntenna.pattern")}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Gradient Legend for E-field Strength */}
          <div
            className="w-16 h-3 rounded-sm"
            style={{
              background:
                "linear-gradient(to right, #ef4444, #eab308, #22c55e, #3b82f6)",
            }}
          />
          <span>{t("yagiAntenna.strength")}</span>
        </div>
      </div>
    </>
  );

  const ControlsContent = () => (
    <div className="flex flex-col space-y-3">
      {/* ... previous controls ... */}

      <div className="pt-3 border-t border-white/10">
        <div className="mb-2 text-xs md:text-sm font-medium text-zinc-200">
          {t("common.material", "Material")}
        </div>
        <RadioGroup
          value={material}
          onValueChange={setMaterial}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="aluminum"
              id={`${uniqueId}m-al`}
              className="border-zinc-400 text-primary-foreground data-[state=checked]:bg-transparent data-[state=checked]:border-primary-foreground data-[state=checked]:text-input"
            />
            <Label
              htmlFor={`${uniqueId}m-al`}
              className="text-xs cursor-pointer text-zinc-300"
            >
              Aluminum (Standard)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="stainless_steel"
              id={`${uniqueId}m-ss`}
              className="border-zinc-400 text-primary-foreground data-[state=checked]:bg-transparent data-[state=checked]:border-primary-foreground data-[state=checked]:text-input"
            />
            <Label
              htmlFor={`${uniqueId}m-ss`}
              className="text-xs cursor-pointer text-zinc-300"
            >
              Stainless Steel (Lossy)
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="pt-3 border-t border-white/10">
        <div className="mb-2 text-xs md:text-sm font-medium text-zinc-200">
          {t("common.controls.groundHeight", "Ground Height (λ)")}
        </div>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={groundHeight}
            onChange={(e) => setGroundHeight(Number.parseFloat(e.target.value))}
            className="w-full accent-primary-foreground"
          />
          <span className="text-xs text-zinc-300 w-8 text-right font-mono">
            {groundHeight === 0 ? "Free" : groundHeight.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-white/10 md:border-none md:pt-0">
        {/* ... existing visualization toggles ... */}
        <div className="mb-2 text-xs md:text-sm font-medium text-zinc-200">
          {t("common.controls.visualization")}
        </div>
        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <Switch
              id={`${uniqueId}wave-mode`}
              checked={showWaves}
              onCheckedChange={setShowWaves}
              className="data-[state=checked]:bg-primary-foreground/80 data-[state=unchecked]:bg-zinc-700 border-zinc-500"
            />
            <Label
              htmlFor={`${uniqueId}wave-mode`}
              className="text-xs md:text-sm text-zinc-300"
            >
              {t("common.controls.showWaves")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id={`${uniqueId}pattern-mode`}
              checked={showPattern}
              onCheckedChange={setShowPattern}
              className="data-[state=checked]:bg-primary-foreground/80 data-[state=unchecked]:bg-zinc-700 border-zinc-500"
            />
            <Label
              htmlFor={`${uniqueId}pattern-mode`}
              className="text-xs md:text-sm text-zinc-300"
            >
              {t("common.controls.showPattern")}
            </Label>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-white/10">
        <div className="mb-2 text-xs md:text-sm font-medium text-zinc-200">
          {t("common.controls.speed")}
        </div>
        <RadioGroup
          defaultValue="medium"
          value={speedMode}
          onValueChange={(v) => setSpeedMode(v as "slow" | "medium" | "fast")}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="slow"
              id={`${uniqueId}r-slow`}
              className="border-zinc-400 text-primary-foreground data-[state=checked]:bg-transparent data-[state=checked]:border-primary-foreground data-[state=checked]:text-input"
            />
            <Label
              htmlFor={`${uniqueId}r-slow`}
              className="text-xs cursor-pointer text-zinc-300"
            >
              {t("common.controls.slow")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="medium"
              id={`${uniqueId}r-medium`}
              className="border-zinc-400 text-primary-foreground data-[state=checked]:bg-transparent data-[state=checked]:border-primary-foreground data-[state=checked]:text-input"
            />
            <Label
              htmlFor={`${uniqueId}r-medium`}
              className="text-xs cursor-pointer text-zinc-300"
            >
              {t("common.controls.medium")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="fast"
              id={`${uniqueId}r-fast`}
              className="border-zinc-400 text-primary-foreground data-[state=checked]:bg-transparent data-[state=checked]:border-primary-foreground data-[state=checked]:text-input"
            />
            <Label
              htmlFor={`${uniqueId}r-fast`}
              className="text-xs cursor-pointer text-zinc-300"
            >
              {t("common.controls.fast")}
            </Label>
          </div>
        </RadioGroup>
      </div>
      <div className="pt-3 border-t border-white/10">
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={handleDownload}
        >
          <Camera className="mr-2 size-4" />
          {t("common.controls.download")}
        </Button>
      </div>

      <ImpedanceDisplay groundHeight={groundHeight} />
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
          camera={{ position: [5, 10, 15], fov: 45 }}
          frameloop={isThumbnail && !isHovered ? "demand" : "always"}
        >
          <color attach="background" args={["#111111"]} />
          <fog attach="fog" args={["#111111", 10, 50]} />

          {!isThumbnail && <ArcballControls target={[0, 0, 0]} makeDefault />}

          <ambientLight intensity={0.5} color={0x404040} />
          <directionalLight
            position={[10, 10, 10]}
            intensity={1}
            color={0xffffff}
          />

          <axesHelper args={[5]} />
          <gridHelper
            args={[20, 20, 0x333333, 0x222222]}
            position={[0, -2, 0]}
          />

          <YagiAntenna />
          {showPattern && <RadiationPattern groundHeight={groundHeight} />}
          {/* Surface/Field Mode */}
          {showWaves && (
            <ElectricFieldWasm
              antennaType="yagi"
              polarizationType="horizontal"
              speed={effectiveSpeed}
              amplitudeScale={1.5}
              groundHeight={groundHeight}
            />
          )}
        </Canvas>

        {!isThumbnail && (
          <>
            <div className="hidden md:block absolute top-4 left-4 right-4 md:right-auto md:w-auto p-3 md:p-4 bg-black/70 text-white rounded-lg max-w-full md:max-w-xs pointer-events-none select-none">
              <LegendContent />
            </div>

            <div className="hidden md:block absolute bottom-4 right-4 p-4 bg-black/70 text-white rounded-lg pointer-events-auto overflow-y-auto max-h-[80%]">
              <ControlsContent />
            </div>

            <div className="absolute bottom-4 left-4 text-gray-400 text-xs pointer-events-none select-none">
              {t("common.created")}
            </div>
          </>
        )}
      </div>

      {!isThumbnail && (
        <div className="flex flex-col gap-4 md:hidden">
          {/* Mobile Controls below chart */}
          <div className="bg-zinc-900 border rounded-lg p-4">
            <ControlsContent />
          </div>

          {/* Mobile Legend below chart */}
          <div className="bg-zinc-50 dark:bg-zinc-900 border rounded-lg p-4">
            <LegendContent />
          </div>
        </div>
      )}
    </div>
  );
}
