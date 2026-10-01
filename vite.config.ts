import { defineConfig, type Connect, type Plugin } from "vite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// In production, Cloudflare's static assets serve every page at its
// extensionless path and 307 "/m908.html" -> "/m908", which is why links,
// canonicals, and the sitemap all use the clean form. Vite's own servers
// only know the .html file, so mirror Cloudflare locally: "/m908" serves
// m908.html. Without this, every internal link 404s in dev and preview.
function cleanUrls(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const [path = "", query = ""] = (req.url ?? "").split("?");
    if (path !== "/" && !path.includes(".") && existsSync(resolve(__dirname, `.${path}.html`))) {
      req.url = `${path}.html${query ? `?${query}` : ""}`;
    }
    next();
  };
  return {
    name: "clean-urls",
    // Braces matter: returning the middleware stack would make Vite treat
    // it as a post-setup hook and call it with the wrong arguments.
    configureServer: (server) => {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(rewrite);
    },
  };
}

// Multi-page build: Vite only bundles index.html by default, so every
// additional standalone page needs an explicit entry here or `vite build`
// silently drops it from dist/.
export default defineConfig({
  plugins: [cleanUrls()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        jmkDecoder: resolve(__dirname, "jmk-decoder.html"),
        productivitySetup: resolve(__dirname, "productivity-setup.html"),
        m913Mac: resolve(__dirname, "redragon-m913-mac.html"),
        m908: resolve(__dirname, "m908.html"),
        dpiChecker: resolve(__dirname, "dpi-checker.html"),
        sensitivityConverter: resolve(__dirname, "sensitivity-converter.html"),
      },
    },
  },
});
