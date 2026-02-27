import { Camera } from "@phosphor-icons/react";
import { ArcballControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  SphereGeometry,
  Vector3,
} from "three";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Switch } from "~/components/ui/switch";
import { initNecWasm, NecContext } from "~/utils/nec-wasm";
import { ElectricFieldWasm } from "./electric-field-wasm";

// Helper to get wire geometry points and currents
function getWireSegments(
  harmonic: number, // n = 1, 2, 3, 4...
  visualScale: number,
  isInvertedV: boolean,
) {
  const segments = 80;
  const L = visualScale;
  const feedPos = -L / 6;
  const apexZ = feedPos;

  const angle = isInvertedV ? (120 * Math.PI) / 180 : Math.PI;
  const droopAngle = (Math.PI - angle) / 2;

  const pts: { pos: Vector3; tangent: Vector3; current: number }[] = [];
  const shortLen = L / 3;

  for (let i = 0; i < segments; i++) {
    const d = (i / (segments - 1)) * L;

    let x = 0,
      y = 0,
      z = 0;
    const tangent = new Vector3();

    if (d < shortLen) {
      const distFromApex = shortLen - d;
      const nz = -Math.cos(isInvertedV ? droopAngle : 0);
      const ny = -Math.sin(isInvertedV ? droopAngle : 0);
      z = apexZ + distFromApex * nz;
      y = distFromApex * ny;
      tangent.set(0, -ny, -nz).normalize();
    } else {
      const distFromApex = d - shortLen;
      const nz = Math.cos(isInvertedV ? droopAngle : 0);
      const ny = -Math.sin(isInvertedV ? droopAngle : 0);
      z = apexZ + distFromApex * nz;
      y = distFromApex * ny;
      tangent.set(0, ny, nz).normalize();
    }

    const phase = (d / L) * (harmonic * Math.PI);
    const current = Math.sin(phase);

    pts.push({
      pos: new Vector3(x, y, z),
      tangent: tangent,
      current: current,
    });
  }

  return pts;
}

function getInvertedVTilt(harmonic: number): number {
  if (harmonic === 1) {
    return (30 * Math.PI) / 180;
  }
  let thetaMax = 90;
  if (harmonic === 2) thetaMax = 51;
  if (harmonic === 3) thetaMax = 37;
  if (harmonic >= 4) thetaMax = 30;
  const droop = 30;
  const rotDeg = thetaMax - droop;
  return (rotDeg * Math.PI) / 180;
}

function WindomStructure({
  harmonic,
  isInvertedV,
  visualScale,
}: {
  harmonic: number;
  isInvertedV: boolean;
  visualScale: number;
}) {
  const segments = useMemo(
    () => getWireSegments(harmonic, visualScale, isInvertedV),
    [harmonic, isInvertedV, visualScale],
  );

  const curvePoints = segments.map((s) => s.pos);
  const curve = useMemo(() => new CatmullRomCurve3(curvePoints), [curvePoints]);

  const wavePoints = useMemo(() => {
    return segments.map((s) => {
      return new Vector3(s.pos.x, s.pos.y + s.current * 0.5, s.pos.z);
    });
  }, [segments]);
  const waveCurve = useMemo(
    () => new CatmullRomCurve3(wavePoints),
    [wavePoints],
  );

  const feedZ = -visualScale / 6;

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 64, 0.03, 8, false]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      <mesh position={[0, 0, feedZ]}>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh>
        <tubeGeometry args={[waveCurve, 64, 0.02, 8, false]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function ImpedanceDisplay({
  harmonic,
  isInvertedV,
}: {
  harmonic: number;
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
        ctx.set_frequency(25.0 * harmonic);

        const L = 6;
        const shortLen = L / 3;
        const longLen = L - shortLen;
        const droop = isInvertedV ? Math.PI / 6 : 0;
        const sinD = Math.sin(droop);
        const cosD = Math.cos(droop);

        const d = 0.01;
        ctx.add_wire(0, 0, -d, 0, 0, d, 0.001, 1, 1);
        ctx.add_wire(
          0,
          0,
          -d,
          0,
          -(shortLen - d) * sinD,
          -d - (shortLen - d) * cosD,
          0.001,
          10,
          2,
        );
        ctx.add_wire(
          0,
          0,
          d,
          0,
          -(longLen - d) * sinD,
          d + (longLen - d) * cosD,
          0.001,
          20,
          3,
        );

        ctx.add_voltage_source(1, 1, 1.0, 0.0);
        ctx.calculate();

        const zArr = ctx.get_impedance(1);
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
  }, [harmonic, isInvertedV]);

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

function RadiationPattern({
  harmonic,
  isInvertedV,
  visualScale,
}: {
  harmonic: number;
  isInvertedV: boolean;
  visualScale: number;
}) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);

  useEffect(() => {
    let isMounted = true;

    const generateGeometry = async () => {
      await initNecWasm();
      if (!isMounted) return;

      const geo = new SphereGeometry(1, 72, 36);
      const posAttribute = geo.attributes.position;
      const vertex = new Vector3();
      const scale = 5;

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
        ctx.set_frequency(25.0 * harmonic);

        const L = 6;
        const shortLen = L / 3;
        const longLen = L - shortLen;
        const droop = isInvertedV ? Math.PI / 6 : 0;
        const sinD = Math.sin(droop);
        const cosD = Math.cos(droop);

        const d = 0.01;
        ctx.add_wire(0, 0, -d, 0, 0, d, 0.001, 1, 1);
        ctx.add_wire(
          0,
          0,
          -d,
          0,
          -(shortLen - d) * sinD,
          -d - (shortLen - d) * cosD,
          0.001,
          10,
          2,
        );
        ctx.add_wire(
          0,
          0,
          d,
          0,
          -(longLen - d) * sinD,
          d + (longLen - d) * cosD,
          0.001,
          20,
          3,
        );

        ctx.add_voltage_source(1, 1, 1.0, 0.0);
        ctx.calculate();

        const outArray = new Float64Array(thetas.length);
        const thetasArray = new Float64Array(thetas);
        const phisArray = new Float64Array(phis);

        ctx.calculate_far_field_pattern_3d(thetasArray, phisArray, outArray);
        gains = Array.from(outArray);

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
        console.warn("NEC calculation failed, using fallback", error);
      }

      for (let i = 0; i < posAttribute.count; i++) {
        vertex.fromBufferAttribute(posAttribute, i);
        vertex.normalize();

        let normalized = 0;
        if (gains.length > 0) {
          normalized = Math.min(1, gains[i] / 2.0);
        } else {
          normalized = 0.1;
        }

        const rad = normalized ** 0.8 * scale;
        vertex.multiplyScalar(rad);
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
  }, [harmonic, isInvertedV, visualScale]);

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

export default function WindomAntennaScene({
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
  const [harmonic, setHarmonic] = useState(1);
  const [speedMode, setSpeedMode] = useState<"slow" | "medium" | "fast">(
    "medium",
  );
  const uniqueId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement("a");
      link.download = "windom-antenna.png";
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

  const ControlsContent = () => (
    <div className="flex flex-col space-y-3">
      <div className="pt-3 border-t border-white/10 md:border-none md:pt-0">
        <div className="mb-2 text-xs md:text-sm font-medium text-zinc-200">
          {t("common.controls.visualization")}
        </div>
        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <Switch
              id={`${uniqueId}inv-v`}
              checked={isInvertedV}
              onCheckedChange={setIsInvertedV}
              className="data-[state=checked]:bg-primary-foreground/80 data-[state=unchecked]:bg-zinc-700 border-zinc-500"
            />
            <Label
              htmlFor={`${uniqueId}inv-v`}
              className="text-xs md:text-sm text-zinc-300"
            >
              {t("common.controls.invertedV")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id={`${uniqueId}waves`}
              checked={showWaves}
              onCheckedChange={setShowWaves}
              className="data-[state=checked]:bg-primary-foreground/80 data-[state=unchecked]:bg-zinc-700 border-zinc-500"
            />
            <Label
              htmlFor={`${uniqueId}waves`}
              className="text-xs md:text-sm text-zinc-300"
            >
              {t("common.controls.showWaves")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id={`${uniqueId}pattern`}
              checked={showPattern}
              onCheckedChange={setShowPattern}
              className="data-[state=checked]:bg-primary-foreground/80 data-[state=unchecked]:bg-zinc-700 border-zinc-500"
            />
            <Label
              htmlFor={`${uniqueId}pattern`}
              className="text-xs md:text-sm text-zinc-300"
            >
              {t("common.controls.showPattern")}
            </Label>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-white/10">
        <div className="mb-2 text-xs md:text-sm font-medium text-zinc-200">
          {t("common.controls.harmonicMode")}
        </div>
        <RadioGroup
          value={harmonic.toString()}
          onValueChange={(v) => setHarmonic(Number.parseInt(v, 10))}
          className="flex flex-wrap flex-col gap-2"
        >
          {[1, 2, 3, 4].map((h) => (
            <div key={h} className="flex items-center space-x-2">
              <RadioGroupItem
                value={h.toString()}
                id={`${uniqueId}h${h}`}
                className="border-zinc-400 text-primary-foreground data-[state=checked]:bg-transparent data-[state=checked]:border-primary-foreground data-[state=checked]:text-input"
              />
              <Label
                htmlFor={`${uniqueId}h${h}`}
                className="text-xs cursor-pointer text-zinc-300"
              >
                {t(`common.controls.harmonic${h}`)}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="pt-3 border-t border-white/10">
        <div className="mb-2 text-xs md:text-sm font-medium text-zinc-200">
          {t("common.controls.speed")}
        </div>
        <RadioGroup
          value={speedMode}
          onValueChange={(v: any) => setSpeedMode(v)}
          className="flex gap-2"
        >
          {["slow", "medium", "fast"].map((s) => (
            <div key={s} className="flex items-center space-x-2">
              <RadioGroupItem
                value={s}
                id={`${uniqueId}${s}`}
                className="border-zinc-400 text-primary-foreground"
              />
              <Label
                htmlFor={`${uniqueId}${s}`}
                className="text-xs text-zinc-300"
              >
                {t(`common.controls.${s}`)}
              </Label>
            </div>
          ))}
        </RadioGroup>
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
        <ImpedanceDisplay harmonic={harmonic} isInvertedV={isInvertedV} />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 h-full">
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

          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 10]} intensity={1} />

          <gridHelper
            args={[20, 20, 0x333333, 0x222222]}
            position={[0, -2, 0]}
          />
          <axesHelper args={[5]} />

          <WindomStructure
            harmonic={harmonic}
            isInvertedV={isInvertedV}
            visualScale={visualScale}
          />

          {showPattern && (
            <RadiationPattern
              harmonic={harmonic}
              isInvertedV={isInvertedV}
              visualScale={visualScale}
            />
          )}

          {showWaves && (
            <ElectricFieldWasm
              antennaType="windom"
              polarizationType="horizontal"
              speed={effectiveSpeed}
              amplitudeScale={1.5}
              activeHarmonic={harmonic}
              antennaLength={harmonic * 0.5}
              isInvertedV={isInvertedV}
              rotation={
                isInvertedV ? [getInvertedVTilt(harmonic), 0, 0] : [0, 0, 0]
              }
            />
          )}
        </Canvas>

        {!isThumbnail && (
          <>
            <div className="hidden md:block absolute bottom-4 right-4 p-4 bg-black/70 text-white rounded-lg">
              <ControlsContent />
            </div>
          </>
        )}
      </div>
      {!isThumbnail && (
        <div className="md:hidden p-4 bg-black/70 text-white rounded-lg">
          <ControlsContent />
        </div>
      )}
    </div>
  );
}
