// Quick verification of the Yagi array factor calculation
// Simulates the RadiationPattern code from yagi-antenna-scene.tsx

const lambda = 0.697;
const k = (2 * Math.PI) / lambda;

const xRef = -0.139;
const xDrv = 0;
const xDir = 0.105;

const Iref = { mag: 0.9, phaseDeg: 72 };
const Idrv = { mag: 1.0, phaseDeg: 0 };
const Idir = { mag: 0.8, phaseDeg: -54 };

const toRad = (deg) => (deg * Math.PI) / 180;

function computeGain(theta, phi) {
  const rx = Math.cos(theta) * Math.cos(phi);
  const ry = Math.sin(theta);
  const rz = Math.cos(theta) * Math.sin(phi);

  const cosAlpha = Math.abs(rz);
  const sinAlpha = Math.sqrt(rx * rx + ry * ry);
  let elementPattern = 0.0;
  if (sinAlpha > 0.01) {
    elementPattern = Math.cos((Math.PI / 2) * cosAlpha) / sinAlpha;
  }

  const boomCosine = rx;
  const phRef = k * xRef * boomCosine + toRad(Iref.phaseDeg);
  const phDrv = k * xDrv * boomCosine + toRad(Idrv.phaseDeg);
  const phDir = k * xDir * boomCosine + toRad(Idir.phaseDeg);

  const af_re =
    Iref.mag * Math.cos(phRef) +
    Idrv.mag * Math.cos(phDrv) +
    Idir.mag * Math.cos(phDir);
  const af_im =
    Iref.mag * Math.sin(phRef) +
    Idrv.mag * Math.sin(phDrv) +
    Idir.mag * Math.sin(phDir);
  const arrayFactor = Math.sqrt(af_re * af_re + af_im * af_im);

  return Math.abs(elementPattern) * arrayFactor;
}

console.log("=== Yagi Array Factor Verification ===\n");
console.log("--- XZ Plane (horizontal, theta=0) ---");
console.log(`Forward (+X, phi=0):   ${computeGain(0, 0).toFixed(4)}`);
console.log(`Backward (-X, phi=PI): ${computeGain(0, Math.PI).toFixed(4)}`);
console.log(`Side (+Z, phi=PI/2):   ${computeGain(0, Math.PI / 2).toFixed(4)}`);
console.log(
  `Side (-Z, phi=-PI/2):  ${computeGain(0, -Math.PI / 2).toFixed(4)}`,
);

console.log("\n--- Elevation scan, Forward direction (phi=0) ---");
for (let el = -90; el <= 90; el += 15) {
  const theta = (el * Math.PI) / 180;
  console.log(
    `  el=${el.toString().padStart(4)}: ${computeGain(theta, 0).toFixed(4)}`,
  );
}

const fwd = computeGain(0, 0);
const bkwd = computeGain(0, Math.PI);
console.log(
  `\nF/B: ${(fwd / bkwd).toFixed(2)} (${(20 * Math.log10(fwd / bkwd)).toFixed(1)} dB)`,
);
