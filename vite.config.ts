import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { imagetools } from "vite-imagetools";
import wasm from "vite-plugin-wasm";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    imagetools(),
    cloudflare({
      viteEnvironment: { name: "ssr" },
    }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    wasm(),
  ],
  resolve: {
    alias: {
      "node:worker_threads": "/app/mocks/worker_threads.ts",
      wasm: "/wasm",
    },
  },
  ssr: {
    noExternal: ["@react-three/fiber", "@react-three/drei", "three"],
  },
});
