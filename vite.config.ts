import { defineConfig } from "vite";
import { resolve } from "node:path";

// Multi-page build: Vite only bundles index.html by default, so every
// additional standalone page needs an explicit entry here or `vite build`
// silently drops it from dist/.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        jmkDecoder: resolve(__dirname, "jmk-decoder.html"),
        productivitySetup: resolve(__dirname, "productivity-setup.html"),
        m908: resolve(__dirname, "m908.html"),
        dpiChecker: resolve(__dirname, "dpi-checker.html"),
        sensitivityConverter: resolve(__dirname, "sensitivity-converter.html"),
      },
    },
  },
});
