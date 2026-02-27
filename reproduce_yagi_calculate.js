const fs = require("fs");
const path = require("path");
const { initNecWasm, NecContext } = require("./wasm/antenna/pkg/antenna");

async function main() {
  const ctx = new NecContext();
  ctx.initialize(1);
  ctx.set_frequency(430.0);

  ctx.add_wire(-0.139, 0, -0.174, -0.139, 0, 0.174, 0.003, 11, 1);
  ctx.add_wire(0, 0, -0.164, 0, 0, 0.164, 0.003, 11, 2);
  ctx.add_wire(0.105, 0, -0.153, 0.105, 0, 0.153, 0.003, 11, 3);
  ctx.add_voltage_source(2, 6, 1.0, 0.0);

  console.log("Calling calculate()...");
  try {
    ctx.calculate();
    console.log("calculate() succeeded");
  } catch (err) {
    console.error("calculate() failed:", err);
  }
}

main().catch(console.error);
