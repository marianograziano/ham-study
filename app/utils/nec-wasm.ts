/**
 * Utility for using the Rust NEC Engine via WebAssembly
 */

import initWasm, { NecContext } from "wasm/antenna/pkg/antenna";

let wasmInitialized = false;
let initPromise: Promise<void> | null = null;

export async function initNecWasm(): Promise<void> {
  if (wasmInitialized) return;
  if (initPromise) return initPromise;

  initPromise = initWasm().then(() => {
    wasmInitialized = true;
  });
  return initPromise;
}

export { NecContext };
