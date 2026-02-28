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
import { YagiElectricField } from "./yagi-electric-field";

function YagiAntenna() {
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 4, 16]} />
        <meshStandardMaterial color="#666" />
      </mesh>
      <mesh position={[-1.5, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 3.2, 16]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 3, 16]} />
        <meshStandardMaterial color="#ef4444" />
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color="#fff" />
        </mesh>
      </mesh>
      <mesh position={[1.5, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 2.8, 16]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      <mesh position={[0, -2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 4, 16]} />
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
      const scale = 1.5;

      const count = posAttribute.count;
      const thetas = new Float64Array(count);
      const phis = new Float64Array(count);
      const gains = new Float64Array(count);

      for (let i = 0; i < count; i++) {
        vertex.fromBufferAttribute(posAttribute, i);
        vertex.normalize();
        let theta = Math.acos(Math.max(-1, Math.min(1, vertex.y))); 
        let phi = Math.atan2(vertex.z, vertex.x); 
        if (phi < 0) phi += 2 * Math.PI;
        thetas[i] = theta;
        phis[i] = phi;
      }

      context.calculate_far_field_pattern_3d(thetas, phis, gains);

      for (let i = 0; i < count; i++) {
        const power = gains[i];
        const rad = (0.5 + power * 1.0) * scale;
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
        <meshBasicMaterial color="#22c55e" wireframe={true} transparent={true} opacity={0.2} />
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
  const [groundHeight, setGroundHeight] = useState(0.0);
  const [material, setMaterial] = useState<string>("aluminum");
  const [showWaves, setShowWaves] = useState(true);
  const [showPattern, setShowPattern] = useState(true);
  const [speedMode, setSpeedMode] = useState<"slow" | "medium" | "fast">("medium");
  const [context, setContext] = useState<Nec2Context | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [impedance, setImpedance] = useState<{ re: number; im: number } | null>(null);
  const [maxGain, setMaxGain] = useState<number>(0);

  const uniqueId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    const runSimulation = async () => {
      setIsCalculating(true);
      try {
        const ctx = new Nec2Context();
        ctx.initialize(1);
        const freq = 430.0;
        ctx.set_frequency(freq);
        ctx.set_material(material);
        const lambda = 299.79 / freq;
        const h_m = groundHeight * lambda;
        if (groundHeight > 0) ctx.set_ground(groundHeight);

        ctx.add_wire(-0.139, -0.174, h_m, -0.139, 0.174, h_m, 0.003, 11, 1);
        ctx.add_wire(0, -0.164, h_m, 0, 0.164, h_m, 0.003, 11, 2);
        ctx.add_wire(0.105, -0.153, h_m, 0.105, 0.153, h_m, 0.003, 11, 3);
        ctx.add_voltage_source(2, 6, 1.0, 0.0);

        await ctx.calculate();

        if (active) {
          const zArr = ctx.get_impedance(2);
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
  }, [groundHeight, material]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement("a");
      link.download = "yagi-antenna.png";
      link.href = canvasRef.current.toDataURL("image/png");
      link.click();
    }
  };

  const effectiveSpeed = isThumbnail && !isHovered ? 0 : { slow: 0.3, medium: 0.6, fast: 1.0 }[speedMode];

  const LegendPanel = () => (
    <div className="p-4 bg-black/70 text-white rounded-lg md:max-w-xs h-full border border-white/5">
      <h2 className="text-lg font-bold mb-2">{t("yagiAntenna.title")}</h2>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        <Trans ns="scene" i18nKey="yagiAntenna.desc" components={{ br: <br /> }} />
      </p>
      <div className="space-y-1.5 text-xs border-t border-gray-600 pt-2">
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
      </div>
      <div className="mt-4 pt-3 border-t border-gray-600">
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">{t("yagiAntenna.strength")}</span>
          <span className="text-[9px] text-zinc-500 italic">Normalized (E·r)</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-blue-600 via-green-500 via-yellow-400 to-red-600" />
      </div>
    </div>
  );

  const ControlsPanel = () => (
    <div className="p-4 bg-black/70 text-white rounded-lg w-full h-full border border-white/5">
      <div className="flex flex-col space-y-4">
        <div className="bg-zinc-900/50 p-3 rounded border border-white/5">
          <div className="mb-2 text-[10px] uppercase font-bold tracking-wider text-zinc-500">{t("yagiAntenna.analysis")}</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] text-zinc-400 mb-0.5">{t("yagiAntenna.peakGain")}</div>
              <div className="text-xs font-mono text-green-400">{isCalculating ? "..." : `${maxGain.toFixed(2)} dBi`}</div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-400 mb-0.5">{t("yagiAntenna.impedance")}</div>
              <div className="text-xs font-mono text-zinc-300">{isCalculating ? "..." : impedance ? `${impedance.re.toFixed(1)}Ω` : "--"}</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="pt-1">
            <div className="mb-2 text-xs font-medium text-zinc-300">{t("yagiAntenna.material")}</div>
            <RadioGroup value={material} onValueChange={setMaterial} className="flex flex-row md:flex-col gap-3 md:gap-1.5">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="aluminum" id={`${uniqueId}m-al`} className="peer size-3 border-zinc-500 data-[state=checked]:border-white data-[state=checked]:text-white" />
                <Label htmlFor={`${uniqueId}m-al`} className="text-[11px] cursor-pointer text-zinc-400 peer-data-[state=checked]:text-white">{t("yagiAntenna.aluminum")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="stainless_steel" id={`${uniqueId}m-ss`} className="peer size-3 border-zinc-500 data-[state=checked]:border-white data-[state=checked]:text-white" />
                <Label htmlFor={`${uniqueId}m-ss`} className="text-[11px] cursor-pointer text-zinc-400 peer-data-[state=checked]:text-white">{t("yagiAntenna.stainlessSteel")}</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="pt-2 border-t border-white/5">
            <div className="mb-2 text-xs font-medium text-zinc-300">{t("yagiAntenna.groundHeight")}</div>
            <div className="flex items-center space-x-3">
              <input type="range" min="0" max="2" step="0.1" value={groundHeight} onChange={(e) => setGroundHeight(parseFloat(e.target.value))} className="w-full accent-blue-500 h-1" />
              <span className="text-[10px] text-zinc-400 w-8 text-right font-mono">{groundHeight === 0 ? t("yagiAntenna.freeSpace") : groundHeight.toFixed(1)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
            <div className="mb-2 text-xs font-medium text-zinc-300">{t("common.controls.speed")}</div>
            <RadioGroup value={speedMode} onValueChange={(v) => setSpeedMode(v as any)} className="flex gap-3">
              {["slow", "medium", "fast"].map((s) => (
                <div key={s} className="flex items-center space-x-1.5">
                  <RadioGroupItem value={s} id={`${uniqueId}r-${s}`} className="peer size-3 border-zinc-500 data-[state=checked]:border-white data-[state=checked]:text-white" />
                  <Label htmlFor={`${uniqueId}r-${s}`} className="text-[11px] cursor-pointer text-zinc-400 peer-data-[state=checked]:text-white">{t(`common.controls.${s}`)}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="pt-2 border-t border-white/5">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between group">
                <Label htmlFor={`${uniqueId}wave-mode`} className="text-[11px] text-zinc-400 cursor-pointer peer-data-[state=checked]:text-white order-first">{t("common.controls.showWaves")}</Label>
                <Switch 
                  id={`${uniqueId}wave-mode`} 
                  checked={showWaves} 
                  onCheckedChange={setShowWaves} 
                  className="peer scale-75 data-[state=unchecked]:bg-zinc-700 data-[state=checked]:bg-blue-500" 
                />
              </div>
              <div className="flex items-center justify-between group">
                <Label htmlFor={`${uniqueId}pattern-mode`} className="text-[11px] text-zinc-400 cursor-pointer peer-data-[state=checked]:text-white order-first">{t("common.controls.showPattern")}</Label>
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

        <Button variant="secondary" size="sm" className="w-full h-8 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-none" onClick={handleDownload}>
          <Camera className="mr-2 size-3.5" /> {t("common.controls.download")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className={`relative w-full ${isThumbnail ? "h-full" : "h-[450px] md:h-[600px]"} border rounded-lg overflow-hidden bg-black touch-none`}>
        <Canvas ref={canvasRef} gl={{ preserveDrawingBuffer: true }} camera={{ position: [5, 10, 15], fov: 45 }} frameloop={isThumbnail && !isHovered ? "demand" : "always"}>
          <color attach="background" args={["#111111"]} />
          <fog attach="fog" args={["#111111", 10, 50]} />
          {!isThumbnail && <ArcballControls target={[0, 0, 0]} makeDefault />}
          <ambientLight intensity={0.5} color={0x404040} />
          <directionalLight position={[10, 10, 10]} intensity={1} color={0xffffff} />
          <axesHelper args={[5]} />
          <gridHelper args={[20, 20, 0x333333, 0x222222]} position={[0, -2, 0]} />

          <group position={[0, groundHeight > 0 ? -2 + groundHeight * 2 : 0, 0]}>
            <YagiAntenna />
            {showPattern && context && <RadiationPattern context={context} />}
            {showWaves && context && (
              <YagiElectricField context={context} speed={effectiveSpeed} amplitudeScale={1.5} />
            )}
          </group>
        </Canvas>

        {/* Desktop View Overlays */}
        {!isThumbnail && (
          <div className="hidden md:block">
            <div className="absolute top-4 left-4 pointer-events-none select-none">
              <LegendPanel />
            </div>
            <div className="absolute bottom-4 right-4 pointer-events-auto w-64 max-h-[85%] overflow-y-auto">
              <ControlsPanel />
            </div>
          </div>
        )}
      </div>

      {/* Mobile/H5 View - Shown below the Canvas */}
      {!isThumbnail && (
        <div className="flex flex-col gap-4 md:hidden">
          <LegendPanel />
          <ControlsPanel />
        </div>
      )}
    </div>
  );
}
