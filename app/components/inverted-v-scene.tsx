import { Camera } from "@phosphor-icons/react";
import { ArcballControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useId, useMemo, useRef, useState, lazy, Suspense } from "react";
import { Trans, useTranslation } from "react-i18next";
import { type BufferGeometry, SphereGeometry, Vector3, DoubleSide } from "three";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Switch } from "~/components/ui/switch";
import { Nec2Context } from "~/utils/nec2-c-wasm";
import { ElectricFieldNec2 } from "./electric-field-nec2";

const height = 3; // Mast height base

function ImpedanceDisplay({
  lengthFactor,
  armAngleRad,
  groundHeight,
}: {
  lengthFactor: number;
  armAngleRad: number;
  groundHeight: number;
}) {
  const [impedance, setImpedance] = useState<{ re: number; im: number } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    let active = true;
    const calculate = async () => {
      setIsCalculating(true);
      try {
        const ctx = new Nec2Context();
        ctx.initialize(3);
        const freq = 300.0;
        ctx.set_frequency(freq); // lambda = 1m
        if (groundHeight > 0) ctx.set_ground(groundHeight);

        const lambda = 299.79 / freq;
        const armLength = (lengthFactor * lambda) / 2;
        const d = 0.005; // half length of center feed wire
        let armSegments = Math.floor((armLength - d) / 0.02);
        if (armSegments < 1) armSegments = 1;

        const h_m = groundHeight > 0 ? groundHeight * lambda : height * 0.1; 
        
        const yTip = (armLength - d) * Math.sin(armAngleRad); 
        const zTip = -(armLength - d) * Math.cos(armAngleRad); // Inverted-V droop

        // Mapping: Three.js [X, Y, Z] -> NEC [X, Z, Y]
        ctx.add_wire(0, -d, h_m, 0, d, h_m, 0.001, 1, 1);
        ctx.add_wire(0, d, h_m, 0, yTip + d, h_m + zTip, 0.001, armSegments, 2);
        ctx.add_wire(0, -d, h_m, 0, -yTip - d, h_m + zTip, 0.001, armSegments, 3);

        ctx.add_voltage_source(1, 1, 1.0, 0.0);
        await ctx.calculate();

        if (active) {
          const zArr = ctx.get_impedance(1);
          setImpedance({ re: zArr[0], im: zArr[1] });
        }
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
  }, [lengthFactor, armAngleRad, groundHeight]);

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

function InvertedVAntenna({ length, angle }: { length: number, angle: number }) {
  const armLength = length / 2;
  const ySign = -1;
  const zTip = armLength * Math.sin(angle);
  const yTip = ySign * armLength * Math.cos(angle);
  const droopAngle = Math.atan2(yTip, zTip);

  return (
    <group position={[0, height, 0]}>
      {/* Mast */}
      <mesh position={[0, -height / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, height, 16]} />
        <meshStandardMaterial color="#666" />
      </mesh>

      {/* Feedpoint */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.15, 0.15, 0.15]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Legs along Z axis */}
      <mesh
        position={[0, yTip / 2, -zTip / 2]}
        rotation={[-(droopAngle - Math.PI / 2), 0, 0]}
      >
        <cylinderGeometry args={[0.02, 0.02, armLength, 16]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>

      <mesh
        position={[0, yTip / 2, zTip / 2]}
        rotation={[droopAngle - Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.02, 0.02, armLength, 16]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

function RadiationPattern({
  lengthFactor,
  armAngleRad,
  groundHeight,
}: {
  lengthFactor: number;
  armAngleRad: number;
  groundHeight: number;
}) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  const [context, setContext] = useState<Nec2Context | null>(null);

  useEffect(() => {
    let isMounted = true;

    const runSimulation = async () => {
      const ctx = new Nec2Context();
      const freq = 300.0;
      ctx.set_frequency(freq);
      if (groundHeight > 0) ctx.set_ground(groundHeight);

      const lambda = 299.79 / freq;
      const armLength = (lengthFactor * lambda) / 2;
      const d = 0.005;
      let armSegments = Math.floor((armLength - d) / 0.02);
      if (armSegments < 1) armSegments = 1;

      const h_m = groundHeight > 0 ? groundHeight * lambda : height * 0.1;
      const yTip = (armLength - d) * Math.sin(armAngleRad); 
      const zTip = -(armLength - d) * Math.cos(armAngleRad);

      ctx.initialize(3);
      ctx.add_wire(0, -d, h_m, 0, d, h_m, 0.001, 1, 1);
      ctx.add_wire(0, d, h_m, 0, yTip + d, h_m + zTip, 0.001, armSegments, 2);
      ctx.add_wire(0, -d, h_m, 0, -yTip - d, h_m + zTip, 0.001, armSegments, 3);

      ctx.add_voltage_source(1, 1, 1.0, 0.0);
      await ctx.calculate();

      if (isMounted) {
        setContext(ctx);
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

        ctx.calculate_far_field_pattern_3d(thetas, phis, gains);

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
      }
    };

    runSimulation();
    return () => { isMounted = false; };
  }, [lengthFactor, armAngleRad, groundHeight]);

  if (!geometry) return null;

  return (
    <group position={[0, height, 0]}>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color="#22c55e"
          wireframe
          transparent
          opacity={0.3}
          side={DoubleSide}
        />
      </mesh>
      {context && <ElectricFieldNec2 context={context} rotation={[0, 0, 0]} />}
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
  const [speedMode, setSpeedMode] = useState<"slow" | "medium" | "fast">("medium");
  const [armAngleDeg, setArmAngleDeg] = useState(45);

  const uniqueId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
  const visualScale = 6;
  const physicalLength = lengthFactor * visualScale;
  const armAngleRad = (armAngleDeg * Math.PI) / 180;

  const LegendContent = () => (
    <>
      <h2 className="text-lg md:text-xl font-bold mb-2">
        {t("invertedVAntenna.title")}
      </h2>
      <p className="text-xs md:text-sm text-muted-foreground mb-2">
        <Trans
          ns="scene"
          i18nKey="invertedVAntenna.desc"
          components={{ br: <br /> }}
        />
      </p>

      <div className="mt-3 mb-2 space-y-1.5 text-xs border-t border-gray-600 pt-2">
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
        <div className="flex items-center gap-2">
          <div
            className="w-16 h-3 rounded-sm"
            style={{
              background:
                "linear-gradient(to right, #ef4444, #eab308, #22c55e, #3b82f6)",
            }}
          />
          <span>{t("invertedVAntenna.strength")}</span>
        </div>
      </div>
    </>
  );

  const ControlsContent = () => (
    <div className="flex flex-col space-y-3">
      <div className="pt-3 border-t border-white/10 md:border-none md:pt-0">
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
          {t("common.controls.length")}
        </div>
        <RadioGroup
          defaultValue="0.5"
          value={lengthFactor.toString()}
          onValueChange={(v) => setLengthFactor(Number.parseFloat(v))}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="0.5"
              id={`${uniqueId}l-half`}
              className="border-zinc-400 text-primary-foreground data-[state=checked]:bg-transparent data-[state=checked]:border-primary-foreground data-[state=checked]:text-input"
            />
            <Label
              htmlFor={`${uniqueId}l-half`}
              className="text-xs cursor-pointer text-zinc-300"
            >
              0.5λ
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="1.0"
              id={`${uniqueId}l-full`}
              className="border-zinc-400 text-primary-foreground data-[state=checked]:bg-transparent data-[state=checked]:border-primary-foreground data-[state=checked]:text-input"
            />
            <Label
              htmlFor={`${uniqueId}l-full`}
              className="text-xs cursor-pointer text-zinc-300"
            >
              1.0λ
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="1.5"
              id={`${uniqueId}l-1.5`}
              className="border-zinc-400 text-primary-foreground data-[state=checked]:bg-transparent data-[state=checked]:border-primary-foreground data-[state=checked]:text-input"
            />
            <Label
              htmlFor={`${uniqueId}l-1.5`}
              className="text-xs cursor-pointer text-zinc-300"
            >
              1.5λ
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="pt-3 border-t border-white/10">
        <div className="mb-2 text-xs md:text-sm font-medium text-zinc-200">
          V-Angle: {armAngleDeg}°
        </div>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="30"
            max="150"
            step="5"
            value={armAngleDeg}
            onChange={(e) => setArmAngleDeg(Number.parseFloat(e.target.value))}
            className="w-full accent-primary-foreground"
          />
        </div>
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

      <ImpedanceDisplay lengthFactor={lengthFactor} armAngleRad={armAngleRad} groundHeight={groundHeight} />
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
          camera={{ position: [10, 8, 10], fov: 45 }}
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
            position={[0, 0, 0]}
          />

          <InvertedVAntenna length={physicalLength} angle={armAngleRad} />
          <Suspense fallback={null}>
            {showPattern && <RadiationPattern lengthFactor={lengthFactor} armAngleRad={armAngleRad} groundHeight={groundHeight} />}
          </Suspense>
        </Canvas>

        {!isThumbnail && (
          <>
            <div className="hidden md:block absolute top-4 left-4 right-4 md:right-auto md:w-auto p-3 md:p-4 bg-black/70 text-white rounded-lg max-w-full md:max-w-xs pointer-events-none select-none">
              <LegendContent />
            </div>

            <div className="hidden md:block absolute bottom-4 right-4 p-4 bg-black/70 text-white rounded-lg pointer-events-auto">
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
          <div className="bg-zinc-900 border rounded-lg p-4">
            <ControlsContent />
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-900 border rounded-lg p-4">
            <LegendContent />
          </div>
        </div>
      )}
    </div>
  );
}
