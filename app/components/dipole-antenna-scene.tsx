import { Camera } from "@phosphor-icons/react";
import { ArcballControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useId, useMemo, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  SphereGeometry,
  Vector3,
} from "three";
import type { InstancedMesh } from "three";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Switch } from "~/components/ui/switch";
import { ElectricFieldWasm } from "./electric-field-wasm";
import { initNecWasm, NecContext } from "~/utils/nec-wasm";

function ImpedanceDisplay({
  lengthFactor,
  isInvertedV,
}: {
  lengthFactor: number;
  isInvertedV: boolean;
}) {
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
        ctx.set_frequency(300.0); // 300MHz gives lambda = 1m

        // Segments relative to wavelength. 11 for 0.5 lambda. Needs to be odd.
        let segments = Math.floor(lengthFactor * 22);
        if (segments % 2 === 0) segments += 1;

        const tag = 1;

        if (isInvertedV) {
          ctx.add_wire(
            0,
            0,
            -lengthFactor / 2,
            0,
            0,
            lengthFactor / 2,
            0.001,
            segments,
            tag,
          );
        } else {
          ctx.add_wire(
            0,
            0,
            -lengthFactor / 2,
            0,
            0,
            lengthFactor / 2,
            0.001,
            segments,
            tag,
          );
        }

        const centerSeg = Math.floor(segments / 2) + 1;
        ctx.add_voltage_source(tag, centerSeg, 1.0, 0.0);
        ctx.calculate();

        const zArr = ctx.get_impedance(tag);
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

    // Debounce slightly to avoid locking UI
    const timer = setTimeout(calculate, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [lengthFactor, isInvertedV]);

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

// Dipole Geometry Component

function DipoleStructure({
  length,
  isInvertedV,
}: {
  length: number;
  isInvertedV: boolean;
}) {
  const armLength = length / 2;
  const angle = isInvertedV ? (120 * Math.PI) / 180 : Math.PI; // 120 degrees or 180 (straight)
  const droopAngle = (Math.PI - angle) / 2;

  // Cylinder geometry for arms
  // Left Arm (Z-)
  // Rotate around X? No, around Z usually if wire is X.
  // Let's assume wire layout is usually along Z axis in our scenes (Horizontal).
  // If "Horizontal", wire is along Z.
  // Inverted V drops the ends (low Y). So rotate around X axis.

  const rotation = isInvertedV ? droopAngle : 0;

  return (
    <group>
      {/* Feedpoint */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.15, 0.15, 0.15]} />
        <meshStandardMaterial color="#fff" />
      </mesh>

      {/* Arm 1 (+Z) */}
      <group rotation={[rotation, 0, 0]}>
        <mesh position={[0, 0, armLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, armLength, 16]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      </group>

      {/* Arm 2 (-Z) */}
      <group rotation={[-rotation, 0, 0]}>
        <mesh position={[0, 0, -armLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, armLength, 16]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      </group>

      {/* Current Distribution Visualization (Standing Wave) */}
      <StandingWaveVisualizer length={length} isInvertedV={isInvertedV} />
    </group>
  );
}

function RadiationPattern({
  length,
  isInvertedV,
  groundHeight,
}: {
  length: number;
  isInvertedV: boolean;
  groundHeight: number;
}) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);

  useEffect(() => {
    let isMounted = true;

    const generateGeometry = async () => {
      await initNecWasm();
      if (!isMounted) return;

      // High resolution for smooth pattern
      const geo = new SphereGeometry(1, 90, 45);
      const posAttribute = geo.attributes.position;
      const vertex = new Vector3();
      const scale = 5; // Visual scale

      const thetas: number[] = [];
      const phis: number[] = [];

      for (let i = 0; i < posAttribute.count; i++) {
        vertex.fromBufferAttribute(posAttribute, i);
        vertex.normalize();
        phis.push(Math.atan2(vertex.z, vertex.x));
        thetas.push(Math.asin(vertex.y));
      }

      let gains: number[] = [];
      try {
        const ctx = new NecContext();
        ctx.initialize(1);
        ctx.set_frequency(300.0); // lambda = 1m
        ctx.set_ground(groundHeight);

        let segments = Math.floor(length * 22);
        if (segments % 2 === 0) segments += 1;

        const tag = 1;

        // Setup wire
        if (isInvertedV) {
          // For inverted V, we'll keep it as a straight wire for now in far field
          // but properly aligned to Z axis.
          ctx.add_wire(
            0,
            0,
            -length / 2,
            0,
            0,
            length / 2,
            0.001,
            segments,
            tag,
          );
        } else {
          ctx.add_wire(
            0,
            0,
            -length / 2,
            0,
            0,
            length / 2,
            0.001,
            segments,
            tag,
          );
        }

        const centerSeg = Math.floor(segments / 2) + 1;
        ctx.add_voltage_source(tag, centerSeg, 1.0, 0.0);
        ctx.calculate();

        // Prepare output array
        const outArray = new Float64Array(thetas.length);
        const thetasArray = new Float64Array(thetas);
        const phisArray = new Float64Array(phis);

        ctx.calculate_far_field_pattern_3d(thetasArray, phisArray, outArray);
        gains = Array.from(outArray);

        // Normalize gains
        let maxGain = 0;
        for (let i = 0; i < gains.length; i++) {
          if (gains[i] > maxGain) maxGain = gains[i];
        }
        if (maxGain > 0) {
          for (let i = 0; i < gains.length; i++) {
            gains[i] /= maxGain;
          }
        }

        ctx.free();
      } catch (error) {
        console.warn("NEC far field calculation failed", error);
        gains = new Array(posAttribute.count).fill(0);
      }

      for (let i = 0; i < posAttribute.count; i++) {
        vertex.fromBufferAttribute(posAttribute, i);
        vertex.normalize();
        let gain = gains[i] || 0;
        if (isInvertedV && groundHeight === 0) {
          gain *= 0.9;
        }
        vertex.multiplyScalar(gain * scale);
        posAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }

      geo.computeVertexNormals();

      if (isMounted) {
        setGeometry(geo);
      }
    };

    generateGeometry();

    return () => {
      isMounted = false;
    };
  }, [length, isInvertedV, groundHeight]);

  useMemo(() => {
    return () => {
      if (geometry) {
        geometry.dispose();
      }
    };
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color="#22c55e"
        wireframe
        transparent
        opacity={0.3}
        side={DoubleSide}
      />
    </mesh>
  );
}

function StandingWaveVisualizer({
  length,
  isInvertedV,
}: {
  length: number;
  isInvertedV: boolean;
}) {
  // Visualize Current: Sine wave standing on the wire
  // Current I(z) = I_max * sin(k * (L/2 - |z|))
  // For half wave: L = lambda/2. kL/2 = pi/2.
  // I(z) ~ cos(k*z)? No, 0 at ends.
  // Half wave: Max at center, 0 at ends.
  // Shape is roughly sine arch.

  // Construct a curve? Or just a dynamic mesh?
  // Let's use a TubeGeometry along a path that bulges?
  // Or simpler: A flat shape (plane) that scales?
  // Let's use points to draw a line is simpler for visualization?
  // Or just a shape.
  // Let's use a dynamic custom geometry or simpler scaled spheres?
  // A "Tube" following the standing wave envelope might be nice.

  // Let's create points for a Line.
  const points = useMemo(() => {
    const pts = [];
    const segments = 50;
    const armLength = length / 2;
    const droopAngle = isInvertedV ? (Math.PI - (120 * Math.PI) / 180) / 2 : 0;

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * 2 - 1; // -1 to 1
      const z = t * armLength;

      // Physical position of wire point
      // If Inverted V:
      // y = -absZ * sin(droopAngle)
      // newZ = z * cos(droopAngle)
      // But wait, z wraps along the wire.

      const wireY = -Math.abs(z) * Math.sin(droopAngle);
      const wireZ = z * Math.cos(droopAngle);

      // Standing Wave Height (Current Magnitude)
      // Current is 0 at ends (|z| = armLength), Max at center (z=0)
      // Shape: cos(pi/2 * z / armLength)
      const magnitude = Math.cos((Math.PI / 2) * t);

      // We displace UP from the wire (Y direction local to wire?)
      // Global Up (Y) is fine.
      pts.push(new Vector3(0, wireY + magnitude * 0.5, wireZ));
    }
    return pts; // This is just the "Current" line
  }, [length, isInvertedV]);

  // curve is just data (CatmullRomCurve3), doesn't need dispose.
  const curve = useMemo(() => new CatmullRomCurve3(points), [points]);

  return (
    <mesh>
      <tubeGeometry args={[curve, 64, 0.02, 8, false]} />
      <meshBasicMaterial color="yellow" transparent opacity={0.6} />
    </mesh>
  );
}

export default function DipoleAntennaScene({
  isThumbnail = false,
  isHovered = false,
}: {
  isThumbnail?: boolean;
  isHovered?: boolean;
}) {
  const { t } = useTranslation("scene");
  const [showWaves, setShowWaves] = useState(true);
  const [showPattern, setShowPattern] = useState(true);
  const [isInvertedV, setIsInvertedV] = useState(false);
  // Length in "lambda". Standard is 0.5.
  const [lengthFactor, setLengthFactor] = useState(0.5);
  const [groundHeight, setGroundHeight] = useState(0.0); // 0 = free space, > 0 = height in lambda

  const [speedMode, setSpeedMode] = useState<"slow" | "medium" | "fast">(
    "medium",
  );
  const uniqueId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement("a");
      link.download = "dipole-antenna.png";
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

  // Physical length scale for visualization
  // Let's say lambda = 10 units?
  // We passed 'antennaLength' to E-field. In our E-field logic, we treated it as Lambda fraction.
  // So we pass 'lengthFactor' directly.

  // For Geometry:
  // If lambda is standard, say 4 units.
  // Arm length = lengthFactor * 4.
  const visualScale = 6;
  const physicalLength = lengthFactor * visualScale;

  const ControlsContent = () => (
    <div className="flex flex-col space-y-3">
      <div className="pt-3 border-t border-white/10 md:border-none md:pt-0">
        <div className="mb-2 text-xs md:text-sm font-medium text-zinc-200">
          {t("common.controls.visualization")}
        </div>
        <div className="flex flex-col space-y-2">
          {/* Inverted V Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id={`${uniqueId}inv-v-mode`}
              checked={isInvertedV}
              onCheckedChange={setIsInvertedV}
              className="data-[state=checked]:bg-primary-foreground/80 data-[state=unchecked]:bg-zinc-700 border-zinc-500"
            />
            <Label
              htmlFor={`${uniqueId}inv-v-mode`}
              className="text-xs md:text-sm text-zinc-300"
            >
              {t("common.controls.invertedV")}
            </Label>
          </div>

          {/* Show Waves Toggle */}
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

          {/* Show Pattern Toggle */}
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

      <ImpedanceDisplay lengthFactor={lengthFactor} isInvertedV={isInvertedV} />
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
          camera={{ position: [5, 5, 10], fov: 45 }}
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

          <DipoleStructure length={physicalLength} isInvertedV={isInvertedV} />

          {showPattern && (
            <RadiationPattern
              length={lengthFactor} // use wavelength for NEC directly
              isInvertedV={isInvertedV}
              groundHeight={groundHeight}
            />
          )}

          {showWaves && (
            <ElectricFieldWasm
              antennaType="dp"
              polarizationType="horizontal"
              speed={effectiveSpeed}
              amplitudeScale={1.5}
              antennaLength={lengthFactor} // Passing lambda fraction
              radialAngle={isInvertedV ? "120" : "180"} // Just for potential use
              groundHeight={groundHeight}
            />
          )}
        </Canvas>

        {!isThumbnail && (
          <>
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
        </div>
      )}
    </div>
  );
}
