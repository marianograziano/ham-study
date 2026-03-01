#!/bin/bash
set -e

# Directory containing the source code
SRC_DIR="wasm/antenna/third_party/nec2c_repo"
OUT_DIR="public/wasm"

mkdir -p $OUT_DIR

# List of source files from Makefile.am
# Note: nec2c.c is an old single-file version, we use the split version.
SOURCES="calculations.c geometry.c input.c matrix.c network.c shared.c fields.c ground.c main.c misc.c radiation.c somnec.c"

echo "Compiling NEC2 to WebAssembly..."

# Compile with Emscripten
# We use -O3 for performance.
# MODULARIZE=1 and EXPORT_NAME allows easy loading in JS.
# FORCE_FILESYSTEM=1 is needed to use FS.writeFile/readFile for input/output files.
emcc -O3 -s WASM=1 \
  -DPACKAGE_STRING=\"nec2c-1.3\" \
  -s EXPORTED_FUNCTIONS='["_main"]' \
  -s EXPORTED_RUNTIME_METHODS='["callMain", "FS"]' \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="createNec2Module" \
  -s EXPORT_ES6=1 \
  -s USE_ES6_IMPORT_META=1 \
  -s FORCE_FILESYSTEM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXIT_RUNTIME=0 \
  -I$SRC_DIR \
  $(for f in $SOURCES; do echo "$SRC_DIR/$f"; done) \
  -o $OUT_DIR/nec2c.js

echo "NEC2 WASM compilation complete!"
echo "Files generated:"
echo "  - $OUT_DIR/nec2c.js"
echo "  - $OUT_DIR/nec2c.wasm"
