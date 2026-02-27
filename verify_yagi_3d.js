// Verify: does cos_boom = vertex.x fix the problem?
const lambda = 0.697;
const k = (2 * Math.PI) / lambda;
const xRef = -0.139,
  xDrv = 0,
  xDir = 0.105;
const Iref = { mag: 0.9, ph: (72 * Math.PI) / 180 };
const Idrv = { mag: 1.0, ph: 0 };
const Idir = { mag: 0.8, ph: (-54 * Math.PI) / 180 };

function gain_new(vx, vy, vz) {
  // Normalize
  const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
  vx /= len;
  vy /= len;
  vz /= len;

  const cos_boom = vx;
  const pR = k * xRef * cos_boom + Iref.ph;
  const pD = k * xDrv * cos_boom + Idrv.ph;
  const pI = k * xDir * cos_boom + Idir.ph;
  const re =
    Iref.mag * Math.cos(pR) + Idrv.mag * Math.cos(pD) + Idir.mag * Math.cos(pI);
  const im =
    Iref.mag * Math.sin(pR) + Idrv.mag * Math.sin(pD) + Idir.mag * Math.sin(pI);
  const af = Math.sqrt(re * re + im * im);

  const cos_alpha = Math.abs(vz);
  const sin_alpha = Math.sqrt(vx * vx + vy * vy);
  let elem = 0;
  if (sin_alpha > 0.01) elem = Math.cos((Math.PI / 2) * cos_alpha) / sin_alpha;

  return Math.abs(elem) * af;
}

console.log("NEW method verification:");
console.log(`Forward  (+X): vx=1,vy=0,vz=0  → ${gain_new(1, 0, 0).toFixed(3)}`);
console.log(
  `Backward (-X): vx=-1,vy=0,vz=0 → ${gain_new(-1, 0, 0).toFixed(3)}`,
);
console.log(`Up       (+Y): vx=0,vy=1,vz=0  → ${gain_new(0, 1, 0).toFixed(3)}`);
console.log(
  `Down     (-Y): vx=0,vy=-1,vz=0 → ${gain_new(0, -1, 0).toFixed(3)}`,
);
console.log(`Side-Z   (+Z): vx=0,vy=0,vz=1  → ${gain_new(0, 0, 1).toFixed(3)}`);
console.log(
  `45°up-fwd    : vx=.7,vy=.7,vz=0 → ${gain_new(0.7, 0.7, 0).toFixed(3)}`,
);

console.log("\nThe problem: Up direction (+Y) has cos_boom=0");
console.log(
  "All elements have same boom_cosine → phase diffs from positions vanish",
);
console.log("AF = |0.9*e^j72° + 1.0*e^j0° + 0.8*e^-j54°|");
const r = 0.9 * Math.cos(Iref.ph) + 1.0 + 0.8 * Math.cos(Idir.ph);
const im = 0.9 * Math.sin(Iref.ph) + 0.8 * Math.sin(Idir.ph);
console.log(
  `  = |${r.toFixed(3)} + j${im.toFixed(3)}| = ${Math.sqrt(r * r + im * im).toFixed(3)}`,
);
console.log(
  "Element pattern for +Y: cos_alpha=0, sin_alpha=1 → elem = cos(0)/1 = 1.0",
);
console.log("Total = 1.0 × AF = same as forward!\n");
console.log("REAL FIX: The array factor formula IS physically correct.");
console.log(
  "The problem is that a real 3-element Yagi really does radiate almost",
);
console.log(
  "equally forward and upward in free space - the elements are all in a line",
);
console.log("along X, so they only create directionality along X, not Y.");
console.log("\nFor VISUAL DEMONSTRATION purposes, we need to either:");
console.log(
  "1. Use a simplified cardioid 3D model: gain = (1 + cos(angle_from_boom))^n",
);
console.log("2. Or add a virtual ground plane to create elevation directivity");
